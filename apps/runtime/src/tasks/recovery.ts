import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import {
    clearTaskDispatchRun,
    getTaskByDispatchRun,
    settleTaskDispatchFailure,
    stopTaskDispatch,
} from './dispatch-store.ts';
import { publishTaskUpdated } from './events.ts';

export type DispatchTurnSettlement =
    | { status: 'cancelled' }
    | { error?: string; status: 'failed' }
    | { status: 'completed' };

export function recoverTaskDispatchForTurn(
    runId: string,
    settlement: DispatchTurnSettlement,
    db: Database = getDb()
) {
    const task = getTaskByDispatchRun(runId, db);
    if (!task) {
        return null;
    }

    const recovered = recoverMatchedTask(task.id, task.status, settlement, db);
    if (recovered) {
        publishTaskUpdated(recovered.id);
    }
    return recovered;
}

export function recoverSettledTaskDispatches(db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT tasks.active_dispatch_run_id AS run_id,
                    agent_turns.id AS turn_id,
                    agent_turns.status,
                    agent_turns.metadata_json
             FROM tasks
             LEFT JOIN agent_turns ON agent_turns.id = tasks.active_dispatch_run_id
             WHERE tasks.active_dispatch_run_id IS NOT NULL
               AND (agent_turns.id IS NULL OR agent_turns.status IN ('completed', 'failed', 'cancelled'))`
        )
        .all() as Array<{
        metadata_json: string | null;
        run_id: string;
        status: string | null;
        turn_id: string | null;
    }>;

    for (const row of rows) {
        recoverTaskDispatchForTurn(
            row.run_id,
            row.status === 'failed' || !row.turn_id
                ? {
                      error: row.turn_id
                          ? readTurnError(row.metadata_json)
                          : 'Dispatched turn was not created before Runtime stopped.',
                      status: 'failed',
                  }
                : { status: row.status as 'cancelled' | 'completed' },
            db
        );
    }
    return rows.length;
}

function recoverMatchedTask(
    taskId: string,
    taskStatus: string,
    settlement: DispatchTurnSettlement,
    db: Database
) {
    if (['blocked', 'review', 'done', 'canceled'].includes(taskStatus)) {
        return clearTaskDispatchRun(taskId, db);
    }
    if (settlement.status === 'cancelled') {
        return stopTaskDispatch(taskId, db);
    }
    if (settlement.status === 'failed') {
        return settleTaskDispatchFailure(
            {
                detail: `Dispatched turn failed: ${settlement.error ?? 'Agent turn failed.'}`,
                taskId,
            },
            db
        );
    }
    if (taskStatus === 'in_progress') {
        return settleTaskDispatchFailure(
            {
                detail: 'Protocol violation: dispatched turn completed while the task was still in_progress.',
                taskId,
            },
            db
        );
    }
    return clearTaskDispatchRun(taskId, db);
}

function readTurnError(metadataJson: string | null) {
    if (!metadataJson) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
        return typeof parsed.error === 'string' ? parsed.error : undefined;
    } catch {
        return undefined;
    }
}
