import {
    type AgentRuntimeCron,
    type AgentRuntimeCronRun,
    isTavernManagedCronName,
} from '@tavern/api';
import {
    cronJobRunSchema,
    cronJobSchema,
    cronJobSummarySchema,
    cronSyncStateSchema,
} from './contracts.ts';

export function mapCronJob(record: AgentRuntimeCron) {
    return cronJobSchema.parse({
        ...record,
        managed: isTavernManagedCronName(record.name),
        syncedAt: record.updatedAt,
    });
}

export function mapCronJobSummary(
    record: Pick<
        AgentRuntimeCron,
        'agentId' | 'description' | 'enabled' | 'id' | 'name' | 'schedule' | 'state' | 'updatedAt'
    >
) {
    return cronJobSummarySchema.parse({
        ...record,
        managed: isTavernManagedCronName(record.name),
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
