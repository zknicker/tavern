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

const hourMs = 60 * 60 * 1000;
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

export const syncManagedCronsJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description:
        'Keeps Tavern-managed default cron automations (wiki maintenance) in sync with their definitions.',
    disabledReason() {
        return null;
    },
    displayName: 'Sync Managed Automations',
    inputSchema: emptyRuntimeJobInputSchema,
    requiredCapabilities: ['gateway'],
    async run(context) {
        const { createLocalHermesClient } = await import('../hermes/local-client');
        const { syncManagedCrons } = await import('../hermes/managed-crons');
        const client = createLocalHermesClient();
        try {
            const result = await syncManagedCrons(client);
            if (result.skippedReason === 'no-active-topics') {
                await context.log(
                    'Skipped managed automation creation: the wiki hub has no active topics yet.'
                );
                return;
            }
            await context.log(
                `Managed automations in sync (${result.created.length} created, ${result.updated.length} updated, ${result.removed.length} removed).`
            );
        } finally {
            client.close();
        }
    },
    schedule: {
        everyMs: hourMs,
        kind: 'interval',
        runOnStart: true,
    },
    slug: 'sync-managed-crons',
};

export const wikiHealthHistoryJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description: 'Samples wiki health stats (staleness, quality, escalations) into history.',
    disabledReason() {
        return null;
    },
    displayName: 'Record Wiki Health History',
    inputSchema: emptyRuntimeJobInputSchema,
    async run(context) {
        const { recordWikiHealthSamples } = await import('../wiki/history');
        const recorded = await recordWikiHealthSamples();
        await context.log(`Recorded ${recorded} wiki health sample(s).`);
    },
    schedule: {
        everyMs: hourMs,
        kind: 'interval',
        runOnStart: true,
    },
    slug: 'wiki-health-history',
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

export const runtimeJobDefinitions = [
    runtimeCapabilitiesRefreshJob,
    syncManagedCronsJob,
    tavernHighlightsJob,
    wikiHealthHistoryJob,
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
