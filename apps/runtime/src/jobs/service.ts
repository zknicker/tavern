import type {
    AgentRuntimeJobDetail,
    AgentRuntimeJobList,
    AgentRuntimeJobSlug,
    AgentRuntimeJobSummary,
    AgentRuntimeRunJob,
} from '@tavern/api';
import { runtimeJobDefinitions } from './definitions';
import { listRuntimeJobRunCounts, listRuntimeJobRuns } from './history';
import {
    enqueueRuntimeJob,
    ensureRuntimeJobRegistered,
    getRuntimeJobDisabledReason,
    getRuntimeJobScheduleNextRunAt,
} from './manager';
import type { RuntimeJobDefinition } from './types';

export async function listRuntimeJobs(): Promise<AgentRuntimeJobList> {
    return {
        jobs: await Promise.all(
            runtimeJobDefinitions.map((definition) => summarizeJob(definition))
        ),
    };
}

export async function getRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeJobDetail> {
    const definition = ensureRuntimeJobRegistered(slug);
    const summary = await summarizeJob(definition);
    return {
        ...summary,
        recentRuns: listRuntimeJobRuns(definition.slug),
    };
}

export async function runRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeRunJob> {
    ensureRuntimeJobRegistered(slug);
    const jobId = await enqueueRuntimeJob(slug, { trigger: 'manual' });
    return { jobId };
}

async function summarizeJob(definition: RuntimeJobDefinition): Promise<AgentRuntimeJobSummary> {
    const disabledReason = await getRuntimeJobDisabledReason(definition);
    const recentRuns = listRuntimeJobRuns(definition.slug);
    const latestRun = recentRuns[0] ?? null;
    const enabled = !disabledReason;

    return {
        availability: enabled ? 'enabled' : 'disabled',
        counts: listRuntimeJobRunCounts(definition.slug),
        description: definition.description,
        disabledReason,
        displayName: definition.displayName,
        latestRun,
        queueName: definition.slug,
        schedule: {
            everyMs: definition.schedule.everyMs,
            kind: 'interval',
            nextRunAt: enabled ? await getRuntimeJobScheduleNextRunAt(definition.slug) : null,
            runOnStart: definition.schedule.runOnStart,
        },
        slug: definition.slug,
    };
}
