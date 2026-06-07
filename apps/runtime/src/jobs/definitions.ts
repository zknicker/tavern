import type { AgentRuntimeJobSlug, CortexJobName } from '@tavern/api';
import { getCortexDb } from '../cortex/db';
import { runCortexJob } from '../cortex/jobs';
import { generateTavernHighlights } from '../highlights/highlights';
import type { RuntimeJobDefinition } from './types';

const emptyRuntimeJobInputSchema = {
    parse(input: unknown) {
        const record = readRuntimeJobInputRecord(input);
        const keys = Object.keys(record);
        if (keys.length > 0) {
            throw new Error(`Unexpected Runtime job input field: ${keys[0]}`);
        }
        return {};
    },
};

const cortexGenerateEmbeddingsInputSchema = {
    parse(input: unknown) {
        const record = readRuntimeJobInputRecord(input);
        const keys = Object.keys(record);
        const unexpectedKey = keys.find((key) => key !== 'stale');
        if (unexpectedKey) {
            throw new Error(`Unexpected Runtime job input field: ${unexpectedKey}`);
        }
        const stale = record.stale ?? true;
        if (typeof stale !== 'boolean') {
            throw new Error('Runtime job input field "stale" must be a boolean.');
        }
        return { stale };
    },
};

const cortexMaintenanceInputSchema = {
    parse(input: unknown) {
        const record = readRuntimeJobInputRecord(input);
        const keys = Object.keys(record);
        const unexpectedKey = keys.find((key) => key !== 'dryRun');
        if (unexpectedKey) {
            throw new Error(`Unexpected Runtime job input field: ${unexpectedKey}`);
        }
        const dryRun = record.dryRun ?? false;
        if (typeof dryRun !== 'boolean') {
            throw new Error('Runtime job input field "dryRun" must be a boolean.');
        }
        return { dryRun };
    },
};

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
    inputSchema: emptyRuntimeJobInputSchema,
    async run(context) {
        const { refreshRuntimeCapabilities } = await import('../capabilities/store');
        const { reconcileRuntimeJobSchedules } = await import('./manager');
        const capabilities = await refreshRuntimeCapabilities({
            onlyDue: true,
            publishUpdated: true,
        });
        await reconcileRuntimeJobSchedules();
        await context.log(`Refreshed ${capabilities.length} Runtime capability health row(s).`);
    },
    schedule: {
        everyMs: runtimeCapabilitiesRefreshIntervalMs,
        kind: 'interval',
        runOnStart: true,
    },
    slug: 'refresh-runtime-capabilities',
};

export const tavernHighlightsJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description: 'Generates hourly Tavern homepage highlights from recent Runtime activity.',
    disabledReason() {
        return null;
    },
    displayName: 'Generate Tavern Highlights',
    inputSchema: emptyRuntimeJobInputSchema,
    async run(context) {
        const result = await generateTavernHighlights();
        await context.log(`Generated ${result.highlights.length} active Tavern highlight(s).`);
    },
    schedule: {
        everyMs: hourMs,
        kind: 'interval',
        runOnStart: true,
    },
    slug: 'tavern-highlights',
};

export const cortexGenerateEmbeddingsJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: { stale: true },
    description: 'Generates embeddings for missing or stale Cortex chunks.',
    disabledReason() {
        return null;
    },
    displayName: 'Generate Cortex Embeddings',
    inputSchema: cortexGenerateEmbeddingsInputSchema,
    requiredCapabilities: ['embeddingModel'],
    async run(context) {
        const input = cortexGenerateEmbeddingsInputSchema.parse(context.input);
        const run = await runCortexJob(getCortexDb(), 'generate-embeddings', {
            stale: input.stale,
        });
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
    description: 'Syncs canonical Cortex markdown into the PGLite projection.',
    displayName: 'Sync Cortex',
    everyMs: dayMs,
    job: 'sync',
    runOnStart: true,
    slug: 'cortex-sync',
});

export const cortexLintJob = createCortexJob({
    description: 'Checks Cortex pages for broken links, stale data, and missing source coverage.',
    displayName: 'Lint Cortex Knowledgebase',
    everyMs: dayMs,
    job: 'lint',
    slug: 'cortex-lint',
});

export const cortexRepairDerivedStateJob = createCortexJob({
    description: 'Repairs deterministic Cortex derived links, chunks, and orphan rows.',
    displayName: 'Repair Cortex Derived State',
    everyMs: dayMs,
    inputSchema: cortexMaintenanceInputSchema,
    job: 'repair-derived-state',
    slug: 'cortex-repair-derived-state',
});

export const cortexChatIngestionJob = createCortexJob({
    description: 'Reviews per-chat message backlog and captures durable Cortex memory.',
    displayName: 'Cortex Chat Ingestion',
    everyMs: fiveMinutesMs,
    job: 'chat-ingestion',
    requiredCapabilities: ['codexOAuth'],
    slug: 'cortex-chat-ingestion',
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
    tavernHighlightsJob,
    cortexGenerateEmbeddingsJob,
    cortexSyncJob,
    cortexLintJob,
    cortexRepairDerivedStateJob,
    cortexChatIngestionJob,
    cortexDreamJob,
] as const;

export function getRuntimeJobDefinition(slug: RuntimeJobDefinition['slug']): RuntimeJobDefinition {
    const definition = runtimeJobDefinitions.find((job) => job.slug === slug);
    if (!definition) {
        throw new Error(`Unknown Runtime job: ${slug}`);
    }
    return definition;
}

function readRuntimeJobInputRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Runtime job input must be an object.');
    }
    return input as Record<string, unknown>;
}

function createCortexJob(input: {
    description: string;
    displayName: string;
    everyMs: number;
    inputSchema?: RuntimeJobDefinition['inputSchema'];
    job: CortexJobName;
    requiredCapabilities?: RuntimeJobDefinition['requiredCapabilities'];
    runOnStart?: boolean;
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
        inputSchema: input.inputSchema ?? emptyRuntimeJobInputSchema,
        requiredCapabilities: input.requiredCapabilities,
        async run(context) {
            const parsed = (input.inputSchema ?? emptyRuntimeJobInputSchema).parse(
                context.input
            ) as Record<string, unknown>;
            const run = await runCortexJob(getCortexDb(), input.job, {
                dryRun: typeof parsed.dryRun === 'boolean' ? parsed.dryRun : undefined,
            });
            await context.log(run.summary);
        },
        schedule: {
            everyMs: input.everyMs,
            kind: 'interval',
            runOnStart: input.runOnStart ?? false,
        },
        slug: input.slug,
    };
}
