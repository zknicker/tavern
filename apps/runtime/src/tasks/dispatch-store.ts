import type { AgentRuntimeTaskDispatchTrigger } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { getTask } from './store.ts';

export function claimTaskDispatch(
    input: {
        agentId: string;
        expectedUpdatedAt: string;
        taskId: string;
        trigger: AgentRuntimeTaskDispatchTrigger;
    },
    db: Database = getDb()
) {
    const autoCondition = input.trigger === 'auto' ? "AND status = 'todo'" : '';
    const result = db
        .prepare(
            `UPDATE tasks
         SET status = 'in_progress',
             blocked_reason_kind = NULL,
             blocked_reason_message = NULL,
             assignee_kind = 'agent',
             assignee_agent_id = $agentId,
             dispatch_trigger = $trigger,
             dispatch_attempts = dispatch_attempts + 1,
             updated_at = $now
         WHERE id = $taskId
           AND updated_at = $expectedUpdatedAt
           AND active_dispatch_run_id IS NULL
           ${autoCondition}
           AND ($trigger = 'manual' OR (
               assignee_kind = 'agent' AND assignee_agent_id = $agentId
           ))`
        )
        .run(namedParams({ ...input, now: new Date().toISOString() }));
    return result.changes === 1 ? getTask(input.taskId, db) : null;
}

export function recordTaskDispatchRun(
    input: { runId: string; taskId: string },
    db: Database = getDb()
) {
    const result = db
        .prepare(
            `UPDATE tasks
         SET active_dispatch_run_id = $runId,
             updated_at = $now
         WHERE id = $taskId
           AND status = 'in_progress'
           AND active_dispatch_run_id IS NULL`
        )
        .run(namedParams({ ...input, now: new Date().toISOString() }));
    return result.changes === 1 ? getTask(input.taskId, db) : null;
}

export function getTaskByDispatchRun(runId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT id FROM tasks WHERE active_dispatch_run_id = $runId LIMIT 1')
        .get(namedParams({ runId })) as { id: string } | null;
    return row ? getTask(row.id, db) : null;
}

export function isTaskDispatchRun(runId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT 1 AS hit FROM tasks WHERE active_dispatch_run_id = $runId LIMIT 1')
        .get(namedParams({ runId })) as { hit: number } | null;
    return row !== null;
}

export function clearTaskDispatchRun(taskId: string, db: Database = getDb()) {
    db.prepare(
        'UPDATE tasks SET active_dispatch_run_id = NULL, updated_at = $now WHERE id = $taskId'
    ).run(namedParams({ now: new Date().toISOString(), taskId }));
    return getTask(taskId, db);
}

export function settleTaskDispatchFailure(
    input: { detail: string; taskId: string },
    db: Database = getDb()
) {
    const task = getTask(input.taskId, db);
    if (!task) {
        return null;
    }
    const retry = task.dispatchAttempts === 1;
    db.prepare(
        `UPDATE tasks
         SET status = $status,
             blocked_reason_kind = $blockedReasonKind,
             blocked_reason_message = $blockedReasonMessage,
             active_dispatch_run_id = NULL,
             updated_at = $now
         WHERE id = $taskId`
    ).run(
        namedParams({
            blockedReasonKind: retry ? null : 'error',
            blockedReasonMessage: retry ? null : input.detail,
            now: new Date().toISOString(),
            status: retry ? 'todo' : 'blocked',
            taskId: input.taskId,
        })
    );
    return getTask(input.taskId, db);
}

export function stopTaskDispatch(taskId: string, db: Database = getDb()) {
    db.prepare(
        `UPDATE tasks
         SET status = 'blocked',
             blocked_reason_kind = 'needs_input',
             blocked_reason_message = 'Stopped by user.',
             active_dispatch_run_id = NULL,
             updated_at = $now
         WHERE id = $taskId`
    ).run(namedParams({ now: new Date().toISOString(), taskId }));
    return getTask(taskId, db);
}
