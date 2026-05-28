import type { AgentRuntimeJobSlug, CortexJobName } from '@tavern/api';
import { runCortexJob } from '../cortex/jobs';
import { createCortexVectorDatabase } from '../cortex/vector-db/native-vector-db';
import { getDb } from '../db/connection';
import type { RuntimeJobDefinition } from './types';

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
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

export const cortexIngestJob = createCortexJob({
    description: 'Imports queued Cortex source files and folders into the knowledgebase.',
    displayName: 'Ingest Knowledge',
    everyMs: dayMs,
    job: 'ingest',
    slug: 'cortex-ingest',
});

export const cortexLintJob = createCortexJob({
    description: 'Checks Cortex pages for broken links, stale data, and missing source coverage.',
    displayName: 'Lint Cortex Knowledgebase',
    everyMs: dayMs,
    job: 'lint',
    slug: 'cortex-lint',
});

export const cortexMaintenanceJob = createCortexJob({
    description: 'Repairs derived Cortex state, markdown mirrors, and searchable indexes.',
    displayName: 'Cortex Maintenance',
    everyMs: dayMs,
    job: 'maintenance',
    requiredCapabilities: ['embeddingModel'],
    slug: 'cortex-maintenance',
});

export const runtimeJobDefinitions = [
    runtimeCapabilitiesRefreshJob,
    cortexGenerateEmbeddingsJob,
    cortexIngestJob,
    cortexLintJob,
    cortexMaintenanceJob,
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
