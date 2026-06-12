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
        `Use the wiki skill. Work exactly one todo record in the ${todo.topic} topic wiki: ${todo.path} ("${todo.title}").`,
        todo.question ? `Its next action: ${todo.question}` : null,
        'Do not start any other todo work — file anything new you notice as its own proposed record, and do not park work on the user.',
        'Complete the next action fully per references/todos.md: research, ingest, compile, dedup, or profile as the record calls for.',
        'On completion: append a log.md entry "## [YYYY-MM-DD] todo | <record title> — <one-line outcome>", update todos/_index.md, and delete the record file. The log entry is the durable history.',
        'Give up instead of retrying: if an external source fails twice or a claim cannot be corroborated from available material, keep the file, set status: blocked with the reason in the record body, and mark affected article claims with lowered confidence or verified: false so answers hedge.',
        'Re-score any articles you changed in .librarian/scan-results.json per the partial re-score protocol in references/librarian.md.',
        'Finish with a one-line summary.',
    ]
        .filter((line) => line !== null)
        .join('\n');
}
