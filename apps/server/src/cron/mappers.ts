import type { AgentRuntimeCron, AgentRuntimeCronRun } from '@tavern/api';
import {
    cronJobRunSchema,
    cronJobSchema,
    cronJobSummarySchema,
    cronSyncStateSchema,
} from './contracts.ts';

export function mapCronJob(record: AgentRuntimeCron) {
    return cronJobSchema.parse({
        ...record,
        // Derive from the payload: cached raw records synced before script
        // mode shipped have no mode field of their own.
        mode: record.payload.kind,
        syncedAt: record.updatedAt,
    });
}

export function mapCronJobSummary(
    record: Pick<
        AgentRuntimeCron,
        | 'agentId'
        | 'description'
        | 'enabled'
        | 'id'
        | 'name'
        | 'payload'
        | 'schedule'
        | 'state'
        | 'updatedAt'
    >
) {
    return cronJobSummarySchema.parse({
        ...record,
        mode: record.payload.kind,
    });
}

export function createDefaultCronSyncState() {
    return cronSyncStateSchema.parse({
        lastAttemptedAt: null,
        lastError: null,
        lastSuccessfulAt: null,
    });
}

export function mapCronJobRun(record: AgentRuntimeCronRun) {
    return cronJobRunSchema.parse(record);
}
