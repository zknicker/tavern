import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import { getCortexDb } from '../cortex/db';
import { resolveCortexWikiPath } from '../cortex/read';
import {
    getCortexEmbeddingConfig,
    getCortexSettings,
    resolveCortexOpenAiApiKey,
} from '../cortex/settings';
import { createLocalHermesClient } from '../hermes/local-client';
import { listRuntimeJobRuns } from '../jobs/history';
import { getRuntimeJobBinding } from '../jobs/manager';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings';

export interface RuntimeCapabilityCheckResult {
    metadata?: Record<string, unknown>;
    reason?: string | null;
    state: AgentRuntimeCapabilityHealthState;
    technicalMessage?: string | null;
}

export interface RuntimeCapabilityDefinition {
    check(): Promise<RuntimeCapabilityCheckResult> | RuntimeCapabilityCheckResult;
    displayName: string;
    id: AgentRuntimeCapabilityHealthId;
    refresh: {
        intervalMs: number;
        runOnStart: boolean;
    };
}

const minuteMs = 60 * 1000;
const cortexJobSlugs = [
    'cortex-generate-embeddings',
    'cortex-sync',
    'cortex-lint',
    'cortex-repair-derived-state',
    'cortex-chat-ingestion',
    'cortex-dream',
] as const;

export const runtimeCapabilityDefinitions: RuntimeCapabilityDefinition[] = [
    {
        async check() {
            return await checkCodexModelAccessCapability();
        },
        displayName: 'Codex OAuth',
        id: 'codexOAuth',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    cortexDatabaseCapability(),
    {
        async check() {
            return await checkCortexImportProcessorsCapability();
        },
        displayName: 'Cortex import processors',
        id: 'cortexImportProcessors',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkCortexJobsCapability();
        },
        displayName: 'Cortex jobs',
        id: 'cortexJobs',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkCortexModelAccessCapability();
        },
        displayName: 'Cortex model access',
        id: 'cortexModelAccess',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkCortexWikiCapability();
        },
        displayName: 'Cortex wiki',
        id: 'cortexWiki',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.getStatus();
                },
                metadata: { endpoint: '/api/status' },
                unavailableReason: 'Managed Hermes dashboard server is not reachable.',
            });
        },
        displayName: 'Hermes dashboard server',
        id: 'dashboardServer',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.assertApiReady();
                },
                metadata: { endpoint: '/api/sessions' },
                unavailableReason: 'Managed Hermes API server is not reachable.',
            });
        },
        displayName: 'Hermes API server',
        id: 'apiServer',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.assertGatewayReady();
                },
                metadata: { endpoint: '/api/ws' },
                unavailableReason: 'Managed Hermes Gateway is not reachable.',
            });
        },
        displayName: 'Hermes Gateway',
        id: 'gateway',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkEmbeddingModelCapability();
        },
        displayName: 'embedding model',
        id: 'embeddingModel',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.getModels();
                },
                metadata: { endpoint: '/api/model/options' },
                unavailableReason: 'Hermes model inventory is not reachable.',
            });
        },
        displayName: 'models',
        id: 'models',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.listSkills();
                },
                metadata: { endpoint: '/api/skills' },
                unavailableReason: 'Hermes skill inventory is not reachable.',
            });
        },
        displayName: 'skills',
        id: 'skills',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
];

function cortexDatabaseCapability(): RuntimeCapabilityDefinition {
    return {
        async check() {
            try {
                const expectedTables = [
                    'cortex_pages',
                    'cortex_sources',
                    'cortex_chunks',
                    'cortex_links',
                    'cortex_timeline_entries',
                    'cortex_audit_events',
                    'cortex_chat_ingestion_cursors',
                ];
                const missingTables: string[] = [];
                for (const tableName of expectedTables) {
                    if (!(await hasCortexTable(tableName))) {
                        missingTables.push(tableName);
                    }
                }
                if (missingTables.length > 0) {
                    return {
                        metadata: { missingTables },
                        reason: 'Cortex database schema is incomplete.',
                        state: 'unavailable',
                    };
                }
                return { state: 'healthy' };
            } catch (error) {
                return {
                    reason: 'Cortex database could not be checked.',
                    state: 'unavailable',
                    technicalMessage: error instanceof Error ? error.message : String(error),
                };
            }
        },
        displayName: 'Cortex database',
        id: 'cortexDatabase',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    };
}

async function hasCortexTable(tableName: string): Promise<boolean> {
    const row = await getCortexDb()
        .prepare(
            `SELECT COUNT(*) AS count
             FROM pg_tables
             WHERE schemaname = 'public' AND tablename = ?`
        )
        .get<{ count: number }>(tableName);
    return (row?.count ?? 0) > 0;
}

function checkCortexWikiCapability(): RuntimeCapabilityCheckResult {
    const wikiPath = resolveCortexWikiPath();
    try {
        if (fs.existsSync(wikiPath)) {
            const stat = fs.statSync(wikiPath);
            if (!stat.isDirectory()) {
                return {
                    reason: 'Cortex wiki path is not a directory.',
                    state: 'unavailable',
                    technicalMessage: wikiPath,
                };
            }
            fs.accessSync(wikiPath, fs.constants.R_OK | fs.constants.W_OK);
            return { metadata: { wikiPath }, state: 'healthy' };
        }

        fs.accessSync(path.dirname(wikiPath), fs.constants.R_OK | fs.constants.W_OK);
        return { metadata: { missing: true, wikiPath }, state: 'healthy' };
    } catch (error) {
        return {
            reason: 'Cortex wiki path is not readable and writable.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

function checkCortexJobsCapability(): RuntimeCapabilityCheckResult {
    const missing = cortexJobSlugs.filter((slug) => !getRuntimeJobBinding(slug));
    if (missing.length > 0) {
        return {
            metadata: {
                expected: cortexJobSlugs.length,
                missing,
                registered: cortexJobSlugs.length - missing.length,
            },
            reason: 'Cortex Runtime jobs are not registered.',
            state: 'unavailable',
        };
    }
    return {
        metadata: {
            expected: cortexJobSlugs.length,
            registered: cortexJobSlugs.length,
        },
        state: 'healthy',
    };
}

async function checkCortexModelAccessCapability(): Promise<RuntimeCapabilityCheckResult> {
    try {
        const settings = await getCortexSettings(getCortexDb());
        const refs = {
            audioTranscription: settings.models.audioTranscription,
            chatIngestion: settings.models.chatIngestion,
            dream: settings.models.dream,
            ocr: settings.models.ocr,
            queryExpansion: settings.models.queryExpansion,
        };
        const providers = uniqueModelProviders(Object.values(refs));
        const missing: string[] = [];

        if (providers.includes('codex')) {
            const codex = await checkCodexModelAccessCapability();
            if (codex.state !== 'healthy') {
                missing.push('codex');
            }
        }
        if (providers.includes('openai') && !(await resolveCortexOpenAiApiKey())) {
            missing.push('openai');
        }
        if (providers.includes('openrouter') && !getOpenRouterApiKey()) {
            missing.push('openrouter');
        }

        if (missing.length > 0) {
            return {
                metadata: { missing, providers, refs },
                reason: `Cortex model access is missing ${missing.join(', ')}.`,
                state: 'unavailable',
            };
        }

        return {
            metadata: { providers, refs },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Cortex model access could not be checked.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

async function checkCortexImportProcessorsCapability(): Promise<RuntimeCapabilityCheckResult> {
    const missing: string[] = [];
    if (typeof fetch !== 'function') {
        missing.push('fetch');
    }
    if (!(await resolveCortexOpenAiApiKey())) {
        missing.push('openai');
    }

    if (missing.length > 0) {
        return {
            metadata: {
                missing,
                supportedKinds: ['article', 'audio', 'image', 'pdf', 'podcast', 'repo', 'video'],
            },
            reason: `Cortex rich import processors are missing ${missing.join(', ')}.`,
            state: 'unavailable',
        };
    }

    return {
        metadata: {
            supportedKinds: ['article', 'audio', 'image', 'pdf', 'podcast', 'repo', 'video'],
        },
        state: 'healthy',
    };
}

function uniqueModelProviders(refs: string[]): string[] {
    return Array.from(new Set(refs.map((ref) => ref.split('/')[0]).filter(Boolean))).sort();
}

async function checkManagedHermesCapability(input: {
    check(client: ReturnType<typeof createLocalHermesClient>): Promise<void>;
    metadata?: Record<string, unknown>;
    unavailableReason: string;
}): Promise<RuntimeCapabilityCheckResult> {
    const client = createLocalHermesClient();
    try {
        await input.check(client);
        return { metadata: input.metadata, state: 'healthy' };
    } catch (error) {
        return {
            metadata: input.metadata,
            reason: input.unavailableReason,
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    } finally {
        client.close();
    }
}

export function getRuntimeCapabilityDefinition(id: AgentRuntimeCapabilityHealthId) {
    const definition = runtimeCapabilityDefinitions.find((capability) => capability.id === id);
    if (!definition) {
        throw new Error(`Unknown Runtime capability: ${id}`);
    }
    return definition;
}

export function getExpectedRuntimeCapability(
    definition: RuntimeCapabilityDefinition
): AgentRuntimeCapabilityHealth {
    return {
        checkedAt: null,
        displayName: definition.displayName,
        healthy: false,
        id: definition.id,
        lastHealthyAt: null,
        metadata: {},
        nextCheckAt: null,
        reason: 'Capability has not been checked yet.',
        state: 'unknown',
        technicalMessage: null,
        updatedAt: null,
    };
}

async function checkCodexModelAccessCapability(): Promise<RuntimeCapabilityCheckResult> {
    try {
        if (!canRunCommand('codex')) {
            return {
                reason: 'Codex CLI is not available to Tavern Runtime.',
                state: 'unavailable',
            };
        }
        const credentials = await loadVaultBackedCodexCredentials();
        if (!credentials) {
            return {
                reason: 'Codex OAuth credentials are not configured.',
                state: 'unauthorized',
            };
        }
        return {
            metadata: {
                accountId: credentials.credentials.accountId,
                source: credentials.source,
            },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Codex OAuth credentials could not be loaded.',
            state: 'unauthorized',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

function canRunCommand(command: string) {
    const result = spawnSync(command, ['--version'], {
        env: process.env,
        stdio: 'ignore',
    });

    return !result.error && result.status === 0;
}

async function checkEmbeddingModelCapability(): Promise<RuntimeCapabilityCheckResult> {
    const settings = await getCortexEmbeddingConfig(getCortexDb());
    if (!settings.apiKey) {
        return {
            reason: 'OpenAI API key is not configured for Cortex embeddings.',
            state: 'unavailable',
        };
    }

    const latestError = getLatestCortexEmbeddingError();
    if (latestError) {
        return {
            reason: describeEmbeddingFailure(latestError),
            state: 'degraded',
            technicalMessage: latestError,
        };
    }

    const modelCheck = await checkOpenAiModelVisibility({
        apiKey: settings.apiKey,
        model: settings.model,
    });
    if (!modelCheck.ok) {
        return modelCheck;
    }

    return {
        metadata: {
            model: settings.model,
            provider: settings.provider,
            quotaVerified: false,
        },
        state: 'healthy',
    };
}

function getLatestCortexEmbeddingError() {
    const latestRun = listRuntimeJobRuns('cortex-generate-embeddings', 1)[0] ?? null;
    return latestRun?.state === 'failed' ? latestRun.error?.trim() || null : null;
}

function describeEmbeddingFailure(error: string) {
    if (error.includes('insufficient_quota')) {
        return 'OpenAI embeddings are failing because the API project has insufficient quota.';
    }
    if (error.includes('429')) {
        return 'OpenAI embeddings are failing because OpenAI returned 429. Check API quota or rate limits.';
    }
    return `OpenAI embeddings are failing: ${error}`;
}

async function checkOpenAiModelVisibility(input: { apiKey: string; model: string }) {
    const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
            Authorization: `Bearer ${input.apiKey}`,
        },
        signal: AbortSignal.timeout(3000),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = extractOpenAiErrorMessage(payload);
        const authFailure = response.status === 401 || response.status === 403;

        return {
            ok: false as const,
            reason: authFailure
                ? 'OpenAI API key could not be authenticated.'
                : 'OpenAI embedding model visibility check failed.',
            state: authFailure ? ('unauthorized' as const) : ('degraded' as const),
            technicalMessage: message
                ? `OpenAI model list check failed (${response.status}): ${message}`
                : `OpenAI model list check failed (${response.status}).`,
        };
    }

    if (!parseOpenAiModelIds(payload).has(input.model)) {
        return {
            ok: false as const,
            reason: `${input.model} is not visible to this OpenAI API key.`,
            state: 'degraded' as const,
            technicalMessage: null,
        };
    }

    return { ok: true as const };
}

function extractOpenAiErrorMessage(payload: unknown) {
    if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
    ) {
        return payload.error.message;
    }

    return null;
}

function parseOpenAiModelIds(payload: unknown) {
    if (
        !payload ||
        typeof payload !== 'object' ||
        !('data' in payload) ||
        !Array.isArray(payload.data)
    ) {
        return new Set<string>();
    }

    return new Set(
        payload.data.flatMap((model) =>
            model && typeof model === 'object' && 'id' in model && typeof model.id === 'string'
                ? [model.id]
                : []
        )
    );
}
