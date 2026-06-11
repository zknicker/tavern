import type { CortexTodo, CortexTodoProcessing } from '@tavern/api';
import { getDb } from '../db/connection';
import { type Database, namedParams } from '../db/sqlite';
import { listWikiTodos, nextDrainableTodo } from './todos';

export const todoDrainCooldownMs = 45 * 60 * 1000;
const todoDrainSessionKey = 'tavern-wiki-todos';
const lastDrainKey = 'wiki_todo_last_drain_at';

let runningTodo: { path: string; topic: string } | null = null;

export interface TodoDrainClient {
    streamChat(input: {
        content: string;
        sessionKey: string;
        title?: null | string;
    }): AsyncIterable<{ data?: unknown; event: string }>;
}

export type TodoDrainOutcome =
    | { kind: 'cooling'; nextAtMs: number }
    | { kind: 'drained'; path: string; summary: null | string; topic: string }
    | { kind: 'idle' };

/**
 * Works exactly one todo per run: the agent completes the record's next
 * action, advances its status, and stops. Cadence comes from the cooldown —
 * the 15-minute job just checks the queue, so a deep queue drains steadily
 * one focused agent run at a time and an empty queue costs nothing.
 */
export async function runWikiTodoDrain(
    client: TodoDrainClient,
    db: Database = getDb(),
    nowMs: number = Date.now()
): Promise<TodoDrainOutcome> {
    const todo = nextDrainableTodo(await listWikiTodos());
    if (!todo) {
        return { kind: 'idle' };
    }
    const lastRunAtMs = readLastDrainAtMs(db);
    if (lastRunAtMs !== null && nowMs - lastRunAtMs < todoDrainCooldownMs) {
        return { kind: 'cooling', nextAtMs: lastRunAtMs + todoDrainCooldownMs };
    }

    runningTodo = { path: todo.path, topic: todo.topic };
    try {
        let summary: null | string = null;
        for await (const event of client.streamChat({
            content: buildTodoDrainPrompt(todo),
            sessionKey: todoDrainSessionKey,
            title: 'Cortex todos',
        })) {
            if (event.event === 'assistant.completed') {
                summary = readCompletedContent(event.data);
            }
        }
        writeLastDrainAtMs(db, nowMs);
        return { kind: 'drained', path: todo.path, summary, topic: todo.topic };
    } finally {
        runningTodo = null;
    }
}

/** Processing state for the health surface; nextRunAtMs is filled in by the caller. */
export function getWikiTodoProcessing(db: Database = getDb()): CortexTodoProcessing {
    return {
        lastRunAtMs: readLastDrainAtMs(db),
        nextRunAtMs: null,
        runningPath: runningTodo?.path ?? null,
        runningTopic: runningTodo?.topic ?? null,
    };
}

export function buildTodoDrainPrompt(todo: CortexTodo): string {
    return [
        `Use the wiki skill. Work exactly one inventory record in the ${todo.topic} topic`,
        `wiki: ${todo.path} ("${todo.title}").`,
        todo.question ? `Its next action: ${todo.question}` : null,
        'Complete that next action fully per references/inventory.md — research, ingest,',
        'compile, dedup, or profile as the record calls for — then move its status',
        'forward, append a short outcome note to the record body, update its updated',
        'date, and append a log.md entry. If the record shows prior failed attempts or',
        'the work needs the user (claim verification, retraction calls, paid or private',
        'access), set owner: user with next_action rewritten as one short question, or',
        'set status: blocked with the reason — do not retry endlessly. Do not start any',
        'other inventory work. Finish with a one-line summary.',
    ]
        .filter((line) => line !== null)
        .join(' ');
}

function readLastDrainAtMs(db: Database): null | number {
    const row = db
        .prepare('SELECT value FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: lastDrainKey })) as { value: string } | null;
    if (!row) {
        return null;
    }
    const parsed = Date.parse(row.value);
    return Number.isNaN(parsed) ? null : parsed;
}

function writeLastDrainAtMs(db: Database, nowMs: number): void {
    const timestamp = new Date(nowMs).toISOString();
    db.prepare(
        `INSERT INTO runtime_metadata (key, value, updated_at)
         VALUES ($key, $value, $updatedAt)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at`
    ).run(namedParams({ key: lastDrainKey, updatedAt: timestamp, value: timestamp }));
}

function readCompletedContent(data: unknown): null | string {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const content = (data as { content?: unknown }).content;
    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }
    const firstLine = content.trim().split('\n', 1)[0] ?? '';
    return firstLine.slice(0, 300) || null;
}
