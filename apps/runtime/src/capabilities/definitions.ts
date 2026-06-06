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
import { listRuntimeJobRuns } from '../jobs/history';
import { getRuntimeJobBinding } from '../jobs/manager';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings';
import { getManagedOpenClawState } from '../openclaw/state';
import {
    getStoredOpenClawModels,
    getStoredOpenClawModelsSnapshotStatus,
} from '../tavern/openclaw-snapshots-store';

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
const expectedCortexToolNames = [
    'cortex_search',
    'cortex_get_page',
    'cortex_capture',
    'cortex_edit',
    'cortex_ingest',
    'cortex_import',
    'cortex_recall',
    'cortex_list_backlinks',
];
const cortexJobSlugs = [
    'cortex-generate-embeddings',
    'cortex-sync',
    'cortex-lint',
    'cortex-repair-derived-state',
    'cortex-chat-ingestion',
    'cortex-dream',
] as const;

export const runtimeCapabilityDefinitions: RuntimeCapabilityDefinition[] = [
    healthyCapability('agentFiles', 'agent files'),
    healthyCapability('agentTurns', 'agent turns'),
    healthyCapability('agents', 'agents'),
    healthyCapability('chats', 'chats'),
    healthyCapability('chatTargets', 'chat targets'),
    healthyCapability('computerUse', 'computer use', 10 * minuteMs),
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
    {
        check() {
            return checkCortexAgentToolsCapability();
        },
        displayName: 'Cortex agent tools',
        id: 'cortexAgentTools',
        refresh: {
            intervalMs: 5 * minuteMs,
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
    healthyCapability('cron', 'cron'),
    healthyCapability('cronRuns', 'cron runs'),
    healthyCapability('events', 'events'),
    healthyCapability('knowledgebase', 'knowledgebase'),
    healthyCapability('logs', 'logs'),
    healthyCapability('mentions', 'mentions'),
    healthyCapability('messages', 'messages'),
    healthyCapability('sessionEvents', 'session events'),
    healthyCapability('sessions', 'sessions'),
    gatewayBackedCapability('skills', 'skills', 'Skill inventory may be stale.'),
    healthyCapability('skillMaterialization', 'skill materialization'),
    healthyCapability('status', 'runtime'),
    healthyCapability('tasks', 'tasks'),
    {
        check() {
            const managedOpenClaw = getManagedOpenClawState();
            return managedOpenClaw.tavernPluginPath
                ? { state: 'healthy' }
                : {
                      reason: 'Managed OpenClaw has not installed the Tavern plugin.',
                      state: 'unavailable',
                  };
        },
        displayName: 'tavernPlugin',
        id: 'tavernPlugin',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return getManagedOpenClawState().gatewayReady === false
                ? {
                      reason: 'Managed OpenClaw Gateway is not ready.',
                      state: 'unavailable',
                  }
                : { state: 'healthy' };
        },
        displayName: 'gateway',
        id: 'gateway',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return getManagedOpenClawState().gatewayReady === false
                ? {
                      reason: 'Managed OpenClaw Gateway is not ready; memory may be stale.',
                      state: 'degraded',
                  }
                : { state: 'healthy' };
        },
        displayName: 'memory',
        id: 'memory',
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
        check() {
            if (getManagedOpenClawState().gatewayReady === false) {
                return {
                    reason: 'Managed OpenClaw Gateway is not ready; model inventory may be stale.',
                    state: 'degraded',
                };
            }
            const snapshot = getStoredOpenClawModelsSnapshotStatus();
            const models = getStoredOpenClawModels();
            if (hasUsableModelInventory(models)) {
                return {
                    metadata: {
                        models: models.models.length,
                    },
                    state: 'healthy',
                };
            }

            return snapshot.hasSnapshot
                ? {
                      reason: 'Runtime synced an empty model inventory.',
                      state: 'degraded',
                  }
                : {
                      reason: 'Runtime has not synced model inventory yet.',
                      state: 'unknown',
                  };
        },
        displayName: 'models',
        id: 'models',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
];

function hasUsableModelInventory(models: { models: unknown[] }) {
    return models.models.length > 0;
}

function healthyCapability(
    id: AgentRuntimeCapabilityHealthId,
    displayName: string,
    intervalMs = 5 * minuteMs
): RuntimeCapabilityDefinition {
    return {
        check() {
            return { state: 'healthy' };
        },
        displayName,
        id,
        refresh: {
            intervalMs,
            runOnStart: true,
        },
    };
}

function gatewayBackedCapability(
    id: AgentRuntimeCapabilityHealthId,
    displayName: string,
    degradedReason: string,
    intervalMs = 5 * minuteMs
): RuntimeCapabilityDefinition {
    return {
        check() {
            return getManagedOpenClawState().gatewayReady === false
                ? {
                      reason: `Managed OpenClaw Gateway is not ready; ${degradedReason}`,
                      state: 'degraded',
                  }
                : { state: 'healthy' };
        },
        displayName,
        id,
        refresh: {
            intervalMs,
            runOnStart: true,
        },
    };
}

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

function checkCortexAgentToolsCapability(): RuntimeCapabilityCheckResult {
    const managedOpenClaw = getManagedOpenClawState();
    if (managedOpenClaw.gatewayReady === false) {
        return {
            reason: 'Managed OpenClaw Gateway is not ready.',
            state: 'unavailable',
        };
    }
    if (!managedOpenClaw.cortexPluginPath) {
        return {
            reason: 'Managed OpenClaw has not installed the Cortex plugin.',
            state: 'unavailable',
        };
    }

    try {
        const manifestPath = path.join(managedOpenClaw.cortexPluginPath, 'openclaw.plugin.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            contracts?: { tools?: unknown };
        };
        const tools = Array.isArray(manifest.contracts?.tools)
            ? manifest.contracts.tools.filter((tool): tool is string => typeof tool === 'string')
            : [];
        const missing = expectedCortexToolNames.filter((tool) => !tools.includes(tool));
        if (missing.length > 0) {
            return {
                metadata: {
                    available: tools.length,
                    expected: expectedCortexToolNames.length,
                    missing,
                },
                reason: 'Cortex plugin does not declare every expected tool.',
                state: 'unavailable',
            };
        }
        return {
            metadata: {
                available: tools.length,
                expected: expectedCortexToolNames.length,
                pluginPath: managedOpenClaw.cortexPluginPath,
            },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Cortex plugin manifest could not be checked.',
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
