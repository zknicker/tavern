import type { CortexTodo, CortexTodoProcessing } from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import {
    readWikiRunTimestamp,
    runWikiAgentTurn,
    type WikiAgentClient,
    writeWikiRunTimestamp,
} from './agent-run';
import { listWikiTodos, nextDrainableTodo } from './todos';

export const todoDrainCooldownMs = 45 * 60 * 1000;
const todoDrainSessionKey = 'tavern-wiki-todos';
const lastDrainKey = 'wiki_todo_last_drain_at';

let runningTodo: { path: string; topic: string } | null = null;

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
    client: WikiAgentClient,
    db: Database = getDb(),
    nowMs: number = Date.now()
): Promise<TodoDrainOutcome> {
    const todo = nextDrainableTodo(await listWikiTodos());
    if (!todo) {
        return { kind: 'idle' };
    }
    const lastRunAtMs = readWikiRunTimestamp(db, lastDrainKey);
    if (lastRunAtMs !== null && nowMs - lastRunAtMs < todoDrainCooldownMs) {
        return { kind: 'cooling', nextAtMs: lastRunAtMs + todoDrainCooldownMs };
    }

    runningTodo = { path: todo.path, topic: todo.topic };
    try {
        const summary = await runWikiAgentTurn(client, {
            content: buildTodoDrainPrompt(todo),
            runName: 'todo',
            sessionKey: todoDrainSessionKey,
            title: 'Cortex todos',
        });
        writeWikiRunTimestamp(db, lastDrainKey, nowMs);
        return { kind: 'drained', path: todo.path, summary, topic: todo.topic };
    } finally {
        runningTodo = null;
    }
}

/** Processing state for the health surface; nextRunAtMs is filled in by the caller. */
export function getWikiTodoProcessing(db: Database = getDb()): CortexTodoProcessing {
    return {
        lastRunAtMs: readWikiRunTimestamp(db, lastDrainKey),
        nextRunAtMs: null,
        runningPath: runningTodo?.path ?? null,
        runningTopic: runningTodo?.topic ?? null,
    };
}

export function buildTodoDrainPrompt(todo: CortexTodo): string {
    return [
        `Use the wiki skill. Work exactly one todo record in the ${todo.topic} topic`,
        `wiki: ${todo.path} ("${todo.title}").`,
        todo.question ? `Its next action: ${todo.question}` : null,
        'Complete that next action fully per references/todos.md — research, ingest,',
        'compile, dedup, or profile as the record calls for — then move its status',
        'forward, append a short outcome note to the record body, update its updated',
        'date, and append a log.md entry. If you cannot complete it — a source is',
        'unreachable or paywalled, a claim cannot be corroborated, the work depends on',
        'something that does not exist yet — set status: blocked with the reason in the',
        'record body, and mark any affected article claims with lowered confidence or',
        'verified: false so answers hedge accordingly. Do not retry endlessly and do',
        'not park work on the user. Do not start any other todo work; if you',
        'notice new work, file it as its own proposed record. Re-score any articles you',
        'changed in .librarian/scan-results.json per references/librarian.md, updating',
        'their entries and the summary counts. Finish with a one-line summary.',
    ]
        .filter((line) => line !== null)
        .join(' ');
}
