import type { CortexPage, CortexTodo, CortexTodoCompletion } from '@tavern/api';
import { readWikiLogEntries } from './log';
import { getCortexPage, listCortexPages, listCortexTopics } from './store';

const statusRank: Record<string, number> = {
    proposed: 0,
    blocked: 1,
};

/**
 * Todo records under `todos/`. The lifecycle is lean: `proposed` records get
 * worked and then deleted — `log.md` keeps the completion history — and
 * `blocked` records persist as the memory of what was tried and why it
 * stalled. Records without a `status` are notes, not todos, and are skipped.
 * Sorted proposed-first, then by priority (p0 best), then most recently
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

/** The next todo the agent should work: the highest-priority proposed record. */
export function nextDrainableTodo(todos: CortexTodo[]): CortexTodo | null {
    return todos.find((todo) => todo.status === 'proposed') ?? null;
}

/**
 * Recent completions, read from each topic's `log.md` — completed todo
 * records are deleted, so the log's `todo` entries are the durable history.
 */
export async function listWikiTodoCompletions(limit = 5): Promise<CortexTodoCompletion[]> {
    try {
        const { topics } = await listCortexTopics();
        const perTopic = await Promise.all(
            topics.map(async (topic) => {
                const entries = await readWikiLogEntries(topic.path);
                return entries
                    .filter((entry) => entry.op === 'todo' && entry.rest)
                    .map((entry, index) => ({
                        date: entry.date,
                        detail: entry.rest,
                        index,
                        topic: topic.slug,
                    }));
            })
        );
        return perTopic
            .flat()
            .sort((left, right) => right.date.localeCompare(left.date) || right.index - left.index)
            .slice(0, limit)
            .map(({ index: _index, ...completion }) => completion);
    } catch {
        return [];
    }
}

function toTodo(page: CortexPage): CortexTodo | null {
    const status = readValue(page.frontmatter.status);
    if (!status) {
        return null;
    }
    return {
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
    const statusDelta = (statusRank[left.status] ?? 2) - (statusRank[right.status] ?? 2);
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
