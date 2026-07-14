import type {
    AgentRuntimeCreateCron,
    AgentRuntimeCron,
    AgentRuntimeCronRun,
    AgentRuntimeCronRunStatus,
    AgentRuntimeCronRunTrigger,
    AgentRuntimeCronState,
    AgentRuntimeUpdateCron,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { createCronRunId } from './ids.ts';
import {
    type CronJobRow,
    type CronRunRow,
    cronRowToJob,
    cronRowToSummary,
    cronRunRowToRun,
} from './rows.ts';

export function createCronJob(input: AgentRuntimeCreateCron, db: Database = getDb()) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO cron_jobs (
            id, agent_id, name, description, enabled, schedule_json, delivery_json, payload_json,
            delete_after_run, consecutive_errors, created_at, updated_at
         )
         VALUES (
            $id, $agentId, $name, $description, $enabled, $scheduleJson, $deliveryJson,
            $payloadJson, $deleteAfterRun, 0, $now, $now
         )`
    ).run(
        namedParams({
            agentId: input.agentId,
            deleteAfterRun: input.deleteAfterRun ? 1 : 0,
            deliveryJson: JSON.stringify(input.delivery),
            description: input.description ?? null,
            enabled: (input.enabled ?? true) ? 1 : 0,
            id: input.id,
            name: input.name,
            now,
            payloadJson: JSON.stringify(input.payload),
            scheduleJson: JSON.stringify(input.schedule),
        })
    );
    return getCronJobOrThrow(input.id, db);
}

export function updateCronJob(
    id: string,
    input: AgentRuntimeUpdateCron,
    db: Database = getDb()
): AgentRuntimeCron | null {
    const existing = getCronJob(id, db);
    if (!existing) {
        return null;
    }
    const merged = { ...existing, ...input };
    const now = new Date().toISOString();
    db.prepare(
        `UPDATE cron_jobs
         SET agent_id = $agentId,
             name = $name,
             description = $description,
             enabled = $enabled,
             schedule_json = $scheduleJson,
             delivery_json = $deliveryJson,
             payload_json = $payloadJson,
             delete_after_run = $deleteAfterRun,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            agentId: merged.agentId,
            deleteAfterRun: merged.deleteAfterRun ? 1 : 0,
            deliveryJson: JSON.stringify(merged.delivery),
            description: merged.description,
            enabled: merged.enabled ? 1 : 0,
            id,
            name: merged.name,
            now,
            payloadJson: JSON.stringify(merged.payload),
            scheduleJson: JSON.stringify(merged.schedule),
        })
    );
    return getCronJobOrThrow(id, db);
}

export function deleteCronJob(id: string, db: Database = getDb()): boolean {
    const result = db.prepare('DELETE FROM cron_jobs WHERE id = $id').run(namedParams({ id }));
    return result.changes > 0;
}

export function listCronJobs(db: Database = getDb()) {
    const rows = db
        .prepare('SELECT * FROM cron_jobs ORDER BY updated_at DESC, id ASC')
        .all() as CronJobRow[];
    return rows.map((row) => cronRowToSummary(row));
}

export function listFullCronJobs(db: Database = getDb()): AgentRuntimeCron[] {
    const rows = db
        .prepare('SELECT * FROM cron_jobs ORDER BY updated_at DESC, id ASC')
        .all() as CronJobRow[];
    return rows.map(cronRowToJob);
}

export function getCronJob(id: string, db: Database = getDb()): AgentRuntimeCron | null {
    const row = db
        .prepare('SELECT * FROM cron_jobs WHERE id = $id')
        .get(namedParams({ id })) as CronJobRow | null;
    return row ? cronRowToJob(row) : null;
}

export function getCronJobOrThrow(id: string, db: Database = getDb()): AgentRuntimeCron {
    const job = getCronJob(id, db);
    if (!job) {
        throw new Error(`Missing cron job ${id}.`);
    }
    return job;
}

export function setCronJobNextRunAt(
    id: string,
    nextRunAtMs: number | null,
    db: Database = getDb()
): void {
    db.prepare(
        `UPDATE cron_jobs
         SET next_run_at_ms = $nextRunAtMs, updated_at = $now
         WHERE id = $id`
    ).run(namedParams({ id, nextRunAtMs, now: new Date().toISOString() }));
}

export function markCronJobRunning(id: string, runningAtMs: number, db: Database = getDb()) {
    db.prepare(
        `UPDATE cron_jobs
         SET running_at_ms = $runningAtMs, updated_at = $now
         WHERE id = $id`
    ).run(namedParams({ id, runningAtMs, now: new Date().toISOString() }));
}

export function settleCronJobRunState(
    input: {
        durationMs: number;
        errorCode?: AgentRuntimeCronState['lastErrorCode'] | null;
        errorMessage?: string | null;
        id: string;
        runAtMs: number;
        status: AgentRuntimeCronRunStatus;
    },
    db: Database = getDb()
) {
    const error = input.status === 'error';
    db.prepare(
        `UPDATE cron_jobs
         SET running_at_ms = NULL,
             last_run_at_ms = $runAtMs,
             last_run_status = $status,
             last_duration_ms = $durationMs,
             last_error_code = $errorCode,
             last_error_message = $errorMessage,
             consecutive_errors = CASE WHEN $error THEN COALESCE(consecutive_errors, 0) + 1 ELSE 0 END,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            durationMs: input.durationMs,
            error,
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
            id: input.id,
            now: new Date().toISOString(),
            runAtMs: input.runAtMs,
            status: input.status,
        })
    );
}

export function settleOrphanedCronRuns(db: Database = getDb()): number {
    const now = new Date().toISOString();
    const result = db
        .prepare(
            `UPDATE cron_runs
             SET status = 'error',
                 execution_error_code = 'control_plane_restarted',
                 execution_error_message = 'Runtime restarted before the run finished.',
                 finished_at = $now,
                 updated_at = $now
             WHERE status IN ('queued', 'running')`
        )
        .run(namedParams({ now }));
    db.prepare(
        `UPDATE cron_jobs
         SET running_at_ms = NULL, updated_at = $now
         WHERE running_at_ms IS NOT NULL`
    ).run(namedParams({ now }));
    return result.changes;
}

export function createCronRun(
    input: { jobId: string; scheduledFor: string; trigger: AgentRuntimeCronRunTrigger },
    db: Database = getDb()
): AgentRuntimeCronRun {
    const now = new Date().toISOString();
    const id = createCronRunId();
    db.prepare(
        `INSERT INTO cron_runs
         (id, job_id, trigger, status, scheduled_for, created_at, updated_at)
         VALUES ($id, $jobId, $trigger, 'queued', $scheduledFor, $now, $now)`
    ).run(
        namedParams({
            id,
            jobId: input.jobId,
            now,
            scheduledFor: input.scheduledFor,
            trigger: input.trigger,
        })
    );
    return getCronRunOrThrow(id, db);
}

export function updateCronRun(
    id: string,
    input: Partial<
        Pick<
            AgentRuntimeCronRun,
            | 'chatId'
            | 'executionErrorCode'
            | 'executionErrorMessage'
            | 'finishedAt'
            | 'quiet'
            | 'scriptExitCode'
            | 'scriptStderr'
            | 'startedAt'
            | 'status'
            | 'turnId'
        >
    >,
    db: Database = getDb()
): AgentRuntimeCronRun {
    const current = getCronRunOrThrow(id, db);
    const next = {
        chatId: input.chatId ?? current.chatId,
        executionErrorCode: input.executionErrorCode ?? current.executionErrorCode,
        executionErrorMessage: input.executionErrorMessage ?? current.executionErrorMessage,
        finishedAt: input.finishedAt ?? current.finishedAt,
        quiet: input.quiet ?? current.quiet,
        scriptExitCode: input.scriptExitCode ?? current.scriptExitCode,
        scriptStderr: input.scriptStderr ?? current.scriptStderr,
        startedAt: input.startedAt ?? current.startedAt,
        status: input.status ?? current.status,
        turnId: input.turnId ?? current.turnId,
    };
    db.prepare(
        `UPDATE cron_runs
         SET chat_id = $chatId,
             turn_id = $turnId,
             status = $status,
             started_at = $startedAt,
             finished_at = $finishedAt,
             execution_error_code = $errorCode,
             execution_error_message = $errorMessage,
             quiet = $quiet,
             script_exit_code = $scriptExitCode,
             script_stderr = $scriptStderr,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            chatId: next.chatId,
            errorCode: next.executionErrorCode,
            errorMessage: next.executionErrorMessage,
            finishedAt: next.finishedAt,
            id,
            now: new Date().toISOString(),
            quiet: next.quiet ? 1 : 0,
            scriptExitCode: next.scriptExitCode,
            scriptStderr: next.scriptStderr,
            startedAt: next.startedAt,
            status: next.status,
            turnId: next.turnId,
        })
    );
    return getCronRunOrThrow(id, db);
}

export function listCronRuns(jobId?: string, db: Database = getDb()): AgentRuntimeCronRun[] {
    const rows = (
        jobId
            ? db
                  .prepare(
                      'SELECT * FROM cron_runs WHERE job_id = $jobId ORDER BY created_at DESC, id ASC'
                  )
                  .all(namedParams({ jobId }))
            : db.prepare('SELECT * FROM cron_runs ORDER BY created_at DESC, id ASC').all()
    ) as CronRunRow[];
    return rows.map(cronRunRowToRun);
}

export function getCronRun(id: string, db: Database = getDb()): AgentRuntimeCronRun | null {
    const row = db
        .prepare('SELECT * FROM cron_runs WHERE id = $id')
        .get(namedParams({ id })) as CronRunRow | null;
    return row ? cronRunRowToRun(row) : null;
}

export function getCronRunOrThrow(id: string, db: Database = getDb()): AgentRuntimeCronRun {
    const run = getCronRun(id, db);
    if (!run) {
        throw new Error(`Missing cron run ${id}.`);
    }
    return run;
}
