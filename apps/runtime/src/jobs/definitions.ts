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

export const wikiCompileJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description:
        'Compiles pending wiki sources into articles when enough pile up or one waits too long.',
    disabledReason() {
        return null;
    },
    displayName: 'Compile Wiki Sources',
    inputSchema: emptyRuntimeJobInputSchema,
    requiredCapabilities: ['gateway'],
    async run(context) {
        const { createLocalHermesClient } = await import('../hermes/local-client');
        const { runWikiCompile } = await import('../wiki/compile-run');
        const client = createLocalHermesClient();
        try {
            const outcome = await runWikiCompile(client);
            if (outcome.kind === 'idle') {
                await context.log('No topics have compile-worthy pending sources.');
                return;
            }
            if (outcome.kind === 'cooling') {
                await context.log(
                    `Waiting out the cooldown; next compile runs after ${new Date(outcome.nextAtMs).toISOString()}.`
                );
                return;
            }
            await context.log(
                `Compiled pending sources in ${outcome.topics.join(', ')}${outcome.summary ? `: ${outcome.summary}` : '.'}`
            );
        } finally {
            client.close();
        }
    },
    schedule: {
        everyMs: 15 * 60 * 1000,
        kind: 'interval',
        runOnStart: false,
    },
    slug: 'wiki-compile',
};

export const wikiLibrarianJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description:
        'Weekly librarian pass: scores articles, repairs what is mechanical, files the rest as todos.',
    disabledReason() {
        return null;
    },
    displayName: 'Run Wiki Librarian',
    inputSchema: emptyRuntimeJobInputSchema,
    requiredCapabilities: ['gateway'],
    async run(context) {
        const { createLocalHermesClient } = await import('../hermes/local-client');
        const { runWikiLibrarian } = await import('../wiki/librarian-run');
        const client = createLocalHermesClient();
        try {
            const outcome = await runWikiLibrarian(client);
            if (outcome.kind === 'no-topics') {
                await context.log('Skipped librarian pass: the wiki hub has no active topics.');
                return;
            }
            await context.log(
                `Librarian pass finished${outcome.summary ? `: ${outcome.summary}` : '.'}`
            );
        } finally {
            client.close();
        }
    },
    schedule: {
        everyMs: 7 * 24 * hourMs,
        kind: 'interval',
        runOnStart: false,
    },
    slug: 'wiki-librarian',
};

export const wikiTodoDrainJob: RuntimeJobDefinition = {
    concurrency: 1,
    defaultInput: {},
    description: 'Works wiki todos one at a time: the agent completes the top record and stops.',
    disabledReason() {
        return null;
    },
    displayName: 'Process Wiki Todos',
    inputSchema: emptyRuntimeJobInputSchema,
    requiredCapabilities: ['gateway'],
    async run(context) {
        const { createLocalHermesClient } = await import('../hermes/local-client');
        const { runWikiTodoDrain } = await import('../wiki/todo-drain');
        const client = createLocalHermesClient();
        try {
            const outcome = await runWikiTodoDrain(client);
            if (outcome.kind === 'idle') {
                await context.log('No open todos to work.');
                return;
            }
            if (outcome.kind === 'cooling') {
                await context.log(
                    `Waiting out the cooldown; next todo runs after ${new Date(outcome.nextAtMs).toISOString()}.`
                );
                return;
            }
            await context.log(
                `Worked todo ${outcome.topic}/${outcome.path}${outcome.summary ? `: ${outcome.summary}` : '.'}`
            );
        } finally {
            client.close();
        }
    },
    schedule: {
        everyMs: 15 * 60 * 1000,
        kind: 'interval',
        runOnStart: false,
    },
    slug: 'wiki-todo-drain',
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
    tavernHighlightsJob,
    wikiCompileJob,
    wikiHealthHistoryJob,
    wikiLibrarianJob,
    wikiTodoDrainJob,
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
