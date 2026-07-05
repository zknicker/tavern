import type {
    AgentRuntimeCron,
    AgentRuntimeCronRun,
    AgentRuntimeCronRunStatus,
    AgentRuntimeCronRunTrigger,
    AgentRuntimeCronState,
    AgentRuntimeCronSummary,
} from '@tavern/api';
import {
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeCronSummarySchema,
} from '@tavern/api';

export interface CronJobRow {
    agent_id: string;
    consecutive_errors: number | null;
    created_at: string;
    delete_after_run: 0 | 1;
    delivery_json: string;
    description: string | null;
    enabled: 0 | 1;
    id: string;
    last_duration_ms: number | null;
    last_error_code: AgentRuntimeCronState['lastErrorCode'] | null;
    last_error_message: string | null;
    last_run_at_ms: number | null;
    last_run_status: AgentRuntimeCronRunStatus | null;
    name: string;
    next_run_at_ms: number | null;
    payload_json: string;
    running_at_ms: number | null;
    schedule_json: string;
    updated_at: string;
}

export interface CronRunRow {
    chat_id: string | null;
    execution_error_code: AgentRuntimeCronRun['executionErrorCode'];
    execution_error_message: string | null;
    finished_at: string | null;
    id: string;
    job_id: string;
    scheduled_for: string;
    started_at: string | null;
    status: AgentRuntimeCronRunStatus;
    trigger: AgentRuntimeCronRunTrigger;
    turn_id: string | null;
}

export function cronRowToJob(row: CronJobRow): AgentRuntimeCron {
    return agentRuntimeCronSchema.parse({
        ...cronRowToSummary(row),
        createdAt: row.created_at,
        deleteAfterRun: Boolean(row.delete_after_run),
        delivery: JSON.parse(row.delivery_json),
        payload: JSON.parse(row.payload_json),
    });
}

export function cronRowToSummary(row: CronJobRow): AgentRuntimeCronSummary {
    return agentRuntimeCronSummarySchema.parse({
        agentId: row.agent_id,
        description: row.description,
        enabled: Boolean(row.enabled),
        id: row.id,
        name: row.name,
        schedule: JSON.parse(row.schedule_json),
        state: cronStateFromRow(row),
        updatedAt: row.updated_at,
    });
}

export function cronRunRowToRun(row: CronRunRow): AgentRuntimeCronRun {
    return agentRuntimeCronRunSchema.parse({
        chatId: row.chat_id,
        executionErrorCode: row.execution_error_code,
        executionErrorMessage: row.execution_error_message,
        finishedAt: row.finished_at,
        id: row.id,
        jobId: row.job_id,
        scheduledFor: row.scheduled_for,
        startedAt: row.started_at,
        status: row.status,
        trigger: row.trigger,
        turnId: row.turn_id,
    });
}

function cronStateFromRow(row: CronJobRow): AgentRuntimeCronState {
    return {
        consecutiveErrors: row.consecutive_errors ?? undefined,
        lastDurationMs: row.last_duration_ms ?? undefined,
        lastErrorCode: row.last_error_code ?? undefined,
        lastErrorMessage: row.last_error_message ?? undefined,
        lastRunAtMs: row.last_run_at_ms ?? undefined,
        lastRunStatus: row.last_run_status ?? undefined,
        nextRunAtMs: row.next_run_at_ms ?? undefined,
        runningAtMs: row.running_at_ms ?? undefined,
    };
}
