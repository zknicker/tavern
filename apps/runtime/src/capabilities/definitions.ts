import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import { loadCodexCredentials } from '@tavern/codex-usage/credentials';
import { resolveCortexWikiPath } from '../cortex/read';
import { getCortexSettings } from '../cortex/settings';
import { getDb } from '../db/connection';
import { listRuntimeJobRuns } from '../jobs/history';
import { getManagedOpenClawState } from '../openclaw/state';
import { getStoredOpenClawModels } from '../tavern/openclaw-snapshots-store';

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
    cortexDatabaseCapability(),
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
            const models = getStoredOpenClawModels();
            return models.agents.length > 0
                ? { state: 'healthy' }
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
        check() {
            try {
                const missingTables = [
                    'cortex_pages',
                    'cortex_sources',
                    'cortex_chunks',
                    'cortex_links',
                    'cortex_timeline_entries',
                    'cortex_audit_events',
                    'cortex_signal_cursors',
                ].filter((tableName) => !hasSqliteTable(tableName));
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

function hasSqliteTable(tableName: string): boolean {
    const row = getDb()
        .prepare(
            `SELECT COUNT(*) AS count
             FROM sqlite_master
             WHERE type = 'table' AND name = ?`
        )
        .get(tableName) as { count: number };
    return row.count > 0;
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
        const credentials = await loadCodexCredentials({ environment: process.env });
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
    const settings = getCortexSettings(getDb()).embedding;
    if (!(settings.apiKeyConfigured && settings.apiKey)) {
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
