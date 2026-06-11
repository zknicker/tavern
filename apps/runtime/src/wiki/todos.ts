import type { CortexPage, CortexTodo } from '@tavern/api';
import { getCortexPage, listCortexPages } from './store';

const statusRank: Record<string, number> = {
    proposed: 0,
    active: 1,
    blocked: 2,
};
const doneStatuses = new Set(['ingested', 'superseded', 'archived']);

/**
 * Inventory records projected as todos — Tavern's product name for llm-wiki's
 * work queue. Records without a `status` are notes, not todos, and are
 * skipped. Sorted open-first, then by priority (p0 best), then most recently
 * updated.
 */
export async function listWikiTodos(): Promise<CortexTodo[]> {
    try {
        const { pages } = await listCortexPages({});
        const records = pages.filter(
            (page) => page.section === 'todos' && !page.path.endsWith('_index.md')
        );
        const details = await Promise.all(
            records.map((page) => getCortexPage({ path: page.path, topic: page.topic }))
        );
        return details
            .filter((page): page is NonNullable<typeof page> => Boolean(page))
            .map(toTodo)
            .filter((todo): todo is CortexTodo => Boolean(todo))
            .sort(compareTodos);
    } catch {
        return [];
    }
}

/** A todo parked on the user — llm-wiki's `status: proposed` + `owner: user`. */
export function isUserTodo(todo: CortexTodo): boolean {
    return todo.owner === 'user' && todo.status === 'proposed';
}

/** The next todo the agent should work: highest-priority open record not parked on the user. */
export function nextDrainableTodo(todos: CortexTodo[]): CortexTodo | null {
    return todos.find((todo) => todo.status === 'proposed' && todo.owner !== 'user') ?? null;
}

export function isDoneTodo(todo: CortexTodo): boolean {
    return doneStatuses.has(todo.status);
}

function toTodo(page: CortexPage): CortexTodo | null {
    const status = readValue(page.frontmatter.status);
    if (!status) {
        return null;
    }
    return {
        owner: readValue(page.frontmatter.owner),
        path: page.path,
        priority: readValue(page.frontmatter.priority),
        question: readText(page.frontmatter.next_action) ?? readText(page.frontmatter.summary),
        status,
        title: page.title,
        topic: page.topic,
        updatedAt: page.updatedAt,
    };
}

function compareTodos(left: CortexTodo, right: CortexTodo): number {
    const statusDelta = (statusRank[left.status] ?? 3) - (statusRank[right.status] ?? 3);
    if (statusDelta !== 0) {
        return statusDelta;
    }
    const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
    if (priorityDelta !== 0) {
        return priorityDelta;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
}

function priorityRank(priority: null | string): number {
    const match = /^p(?<level>\d)$/u.exec(priority ?? '');
    return match?.groups?.level ? Number(match.groups.level) : 9;
}

function readValue(value: unknown): null | string {
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function readText(value: unknown): null | string {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
