import type { AgentRuntimeJobSlug, CortexJobName } from '@tavern/api';
import { runCortexJob } from '../cortex/jobs';
import { createCortexVectorDatabase } from '../cortex/vector-db/native-vector-db';
import { getDb } from '../db/connection';
import type { RuntimeJobDefinition } from './types';

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const fiveMinutesMs = 5 * 60 * 1000;
export const cortexEmbeddingIntervalMs = 15 * 60 * 1000;
export const runtimeCapabilitiesRefreshIntervalMs = 60 * 1000;

export const runtimeCapabilitiesRefreshJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description: 'Refreshes Runtime capability health so dependent features know what is ready.',
    disabledReason() {
        return null;
    },
    displayName: 'Refresh Runtime Capabilities',
    async run(context) {
        const { refreshRuntimeCapabilities } = await import('../capabilities/store');
        const capabilities = await refreshRuntimeCapabilities({ onlyDue: true });
        await context.log(`Refreshed ${capabilities.length} Runtime capability health row(s).`);
    },
    schedule: {
        everyMs: runtimeCapabilitiesRefreshIntervalMs,
        kind: 'interval',
        runOnStart: true,
    },
    slug: 'refresh-runtime-capabilities',
};

export const cortexGenerateEmbeddingsJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description: 'Generates embeddings for missing or stale Cortex chunks.',
    disabledReason() {
        return null;
    },
    displayName: 'Generate Cortex Embeddings',
    requiredCapabilities: ['embeddingModel'],
    async run(context) {
        const run = await runCortexJob(
            getDb(),
            'generate-embeddings',
            createCortexVectorDatabase()
        );
        await context.log(run.summary);
    },
    schedule: {
        everyMs: cortexEmbeddingIntervalMs,
        kind: 'interval',
        runOnStart: true,
    },
    slug: 'cortex-generate-embeddings',
};

export const cortexSyncJob = createCortexJob({
    description: 'Syncs canonical Cortex markdown into the SQLite projection.',
    displayName: 'Sync Cortex',
    everyMs: dayMs,
    job: 'sync',
    slug: 'cortex-sync',
});

export const cortexLintJob = createCortexJob({
    description: 'Checks Cortex pages for broken links, stale data, and missing source coverage.',
    displayName: 'Lint Cortex Knowledgebase',
    everyMs: dayMs,
    job: 'lint',
    slug: 'cortex-lint',
});

export const cortexMaintenanceJob = createCortexJob({
    description: 'Repairs deterministic Cortex derived links, chunks, and orphan rows.',
    displayName: 'Cortex Maintenance',
    everyMs: dayMs,
    job: 'maintenance',
    slug: 'cortex-maintenance',
});

export const cortexSignalJob = createCortexJob({
    description: 'Reviews per-chat message backlog and captures durable Cortex memory.',
    displayName: 'Cortex Signal',
    everyMs: fiveMinutesMs,
    job: 'signal',
    requiredCapabilities: ['codexOAuth'],
    slug: 'cortex-signal',
});

export const cortexDreamJob = createCortexJob({
    description: 'Reviews bounded source material and writes validated Cortex memory updates.',
    displayName: 'Cortex Dream',
    everyMs: dayMs,
    job: 'dream',
    requiredCapabilities: ['codexOAuth'],
    slug: 'cortex-dream',
});

export const runtimeJobDefinitions = [
    runtimeCapabilitiesRefreshJob,
    cortexGenerateEmbeddingsJob,
    cortexSyncJob,
    cortexLintJob,
    cortexMaintenanceJob,
    cortexSignalJob,
    cortexDreamJob,
] as const;

export function getRuntimeJobDefinition(slug: RuntimeJobDefinition['slug']): RuntimeJobDefinition {
    const definition = runtimeJobDefinitions.find((job) => job.slug === slug);
    if (!definition) {
        throw new Error(`Unknown Runtime job: ${slug}`);
    }
    return definition;
}

function createCortexJob(input: {
    description: string;
    displayName: string;
    everyMs: number;
    job: CortexJobName;
    requiredCapabilities?: RuntimeJobDefinition['requiredCapabilities'];
    slug: AgentRuntimeJobSlug;
}): RuntimeJobDefinition {
    return {
        concurrency: 1,
        defaultInput: {},
        description: input.description,
        disabledReason() {
            return null;
        },
        displayName: input.displayName,
        requiredCapabilities: input.requiredCapabilities,
        async run(context) {
            const run = await runCortexJob(getDb(), input.job, createCortexVectorDatabase());
            await context.log(run.summary);
        },
        schedule: {
            everyMs: input.everyMs,
            kind: 'interval',
            runOnStart: false,
        },
        slug: input.slug,
    };
}
