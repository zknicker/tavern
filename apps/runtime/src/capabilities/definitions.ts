import fs from 'node:fs';
import path from 'node:path';
import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import {
    googleCalendarPluginHealthCapabilityId,
    googlePluginManifest,
} from '@tavern/api/plugins/google';
import {
    merchbasePluginHealthCapabilityId,
    merchbasePluginManifest,
} from '@tavern/api/plugins/merchbase';
import { fallbackBinDirectories, findExecutable } from '../cli-path.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { isRuntimeCronReady } from '../cron/scheduler.ts';
import { getDb, hasTable } from '../db/connection.ts';
import { auditRecallIndex, getRecallProvisioningStatus } from '../memory/recall/recall-index.ts';
import { resolveSemanticMemoryConfig } from '../memory/semantic/store.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { createLanguageModelForRuntime } from '../models/language-model.ts';
import { resolveAgentModelSummary } from '../models/model-access.ts';
import { checkGoogleCalendarCapability } from '../plugins/google.ts';
import { checkMerchbaseCapability } from '../plugins/merchbase.ts';
import { isDevToolkitEnabled } from '../tavern/development-turn-simulator.ts';

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
        async check() {
            return await checkSemanticMemoryCapability();
        },
        displayName: 'Memory',
        id: 'semanticMemory',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkMemoryWorkersCapability();
        },
        displayName: 'Memory updates',
        id: 'memoryWorkers',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkMemoryRecallCapability();
        },
        displayName: 'Memory recall',
        id: 'memoryRecall',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'engine' });
        },
        displayName: 'Agent engine',
        id: 'dashboardServer',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'api' });
        },
        displayName: 'Agent engine API',
        id: 'apiServer',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'gateway' });
        },
        displayName: 'Agent connection',
        id: 'gateway',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkModelExecutionCapability();
        },
        displayName: 'Model execution',
        id: 'modelExecution',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'skills' });
        },
        displayName: 'Skills',
        id: 'skills',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkCronCapability();
        },
        displayName: 'Cron',
        id: 'cron',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkDevToolkitCapability();
        },
        displayName: 'Dev toolkit',
        id: 'devToolkit',
        refresh: {
            intervalMs: 60 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkMerchbaseCapability();
        },
        displayName: merchbasePluginManifest.displayName,
        id: merchbasePluginHealthCapabilityId,
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkGoogleCalendarCapability();
        },
        displayName: `${googlePluginManifest.displayName} Calendar`,
        id: googleCalendarPluginHealthCapabilityId,
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
];

function checkCronCapability(): RuntimeCapabilityCheckResult {
    try {
        const db = getDb();
        const storageReady = hasTable(db, 'cron_jobs') && hasTable(db, 'cron_runs');
        if (!storageReady) {
            return {
                reason: 'Cron storage is not ready.',
                state: 'unavailable',
            };
        }
        if (!isRuntimeCronReady()) {
            return {
                reason: 'Cron scheduler is not running.',
                state: 'unavailable',
            };
        }
        return { state: 'healthy' };
    } catch (error) {
        return {
            reason: 'Cron is not ready.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Extraction and dreaming run as headless model calls, so they need at least
 * one direct model connection (OpenAI, OpenRouter, or an OpenAI-compatible
 * endpoint). Harness-only setups can chat but cannot run Memory updates.
 */
async function checkMemoryWorkersCapability(): Promise<RuntimeCapabilityCheckResult> {
    const categories = [
        { category: 'fast', model: resolveModelCategorySelection('fast') },
        { category: 'standard', model: resolveModelCategorySelection('standard') },
    ] as const;
    const metadata = Object.fromEntries(
        categories.map((entry) => [entry.category, `${entry.model.provider}/${entry.model.model}`])
    );

    for (const entry of categories) {
        try {
            await createLanguageModelForRuntime(entry.model);
        } catch (error) {
            return {
                metadata,
                reason: 'Memory updates need a direct model connection. Add an OpenAI or OpenRouter key, or choose background models in Settings → Models.',
                state: 'unavailable',
                technicalMessage:
                    error instanceof Error
                        ? `${entry.category}: ${error.message}`
                        : `${entry.category}: model unavailable`,
            };
        }
    }

    return { metadata, state: 'healthy' };
}

async function checkSemanticMemoryCapability(): Promise<RuntimeCapabilityCheckResult> {
    const config = await resolveSemanticMemoryConfig();
    const memoryPath = config.memoryPath;
    const metadata = {
        configSource: config.source,
        memoryPath,
    };
    try {
        if (fs.existsSync(memoryPath)) {
            const stat = fs.statSync(memoryPath);
            if (!stat.isDirectory()) {
                return {
                    reason: 'Memory path is not a directory.',
                    state: 'unavailable',
                    technicalMessage: memoryPath,
                };
            }
            fs.accessSync(memoryPath, fs.constants.R_OK);
            const writable = canAccess(memoryPath, fs.constants.W_OK);
            return { metadata: { ...metadata, writable }, state: 'healthy' };
        }

        fs.accessSync(path.dirname(memoryPath), fs.constants.R_OK | fs.constants.W_OK);
        return {
            metadata: { ...metadata, missing: true },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Memory path is not readable.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

// Per-turn recall readiness: the recall index over Semantic Memory pages plus
// its locally provisioned embedding model. Progress rides capability metadata
// so the app can render a provisioning bar without a contract shape change.
// The ready-state check is an active drift audit: recall that silently fell
// behind the pages (lost watcher events) reports pending work, not healthy.
async function checkMemoryRecallCapability(): Promise<RuntimeCapabilityCheckResult> {
    if (!isMemoryEnabled()) {
        return {
            reason: 'Memory is off.',
            state: 'unavailable',
        };
    }

    const status = getRecallProvisioningStatus();
    const percent = status.progress === null ? null : `${Math.round(status.progress * 100)}%`;
    const metadata = {
        phase: status.phase,
        ...(status.progress === null ? {} : { progress: status.progress }),
    };

    switch (status.phase) {
        case 'ready':
            return await auditReadyMemoryRecall(metadata);
        case 'downloading-model':
            return {
                metadata,
                reason: `Downloading the recall model${percent ? ` (${percent})` : ''}.`,
                state: 'degraded',
            };
        case 'embedding':
            return {
                metadata,
                reason: `Indexing Memory pages for recall${percent ? ` (${percent})` : ''}.`,
                state: 'degraded',
            };
        case 'updating':
            return {
                metadata,
                reason: 'Preparing the recall index.',
                state: 'degraded',
            };
        case 'degraded':
            return {
                metadata,
                reason: 'Recall is keyword-only; semantic recall is unavailable.',
                state: 'degraded',
                technicalMessage: status.reason,
            };
        default:
            return {
                metadata,
                reason: 'Recall has not been provisioned yet.',
                state: 'degraded',
            };
    }
}

async function auditReadyMemoryRecall(
    metadata: Record<string, unknown>
): Promise<RuntimeCapabilityCheckResult> {
    try {
        const audit = await auditRecallIndex();
        const auditMetadata = {
            ...metadata,
            pendingEmbeddings: audit.pendingEmbeddings,
            totalPages: audit.totalPages,
        };
        if (audit.pendingEmbeddings > 0) {
            return {
                metadata: auditMetadata,
                reason: `Indexing ${audit.pendingEmbeddings} changed ${audit.pendingEmbeddings === 1 ? 'page' : 'pages'} for recall.`,
                state: 'degraded',
            };
        }
        return { metadata: auditMetadata, state: 'healthy' };
    } catch (error) {
        return {
            metadata,
            reason: 'Recall index could not be audited.',
            state: 'degraded',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

function canAccess(targetPath: string, mode: number): boolean {
    try {
        fs.accessSync(targetPath, mode);
        return true;
    } catch {
        return false;
    }
}

// Dev-stack-only helpers (simulated turns). Healthy only when the runtime
// was started by the development stack.
function checkDevToolkitCapability(): RuntimeCapabilityCheckResult {
    if (isDevToolkitEnabled()) {
        return { state: 'healthy' };
    }

    return {
        reason: 'The dev toolkit is only available on the development stack.',
        state: 'unavailable',
    };
}

function checkAgentEngineCapability(input: {
    capability: 'api' | 'engine' | 'gateway' | 'skills';
}): RuntimeCapabilityCheckResult {
    const model = resolveAgentModelSummary();
    const metadata = {
        capability: input.capability,
        model: model.model,
        provider: model.provider,
        workspace: AGENT_WORKSPACE,
    };

    return { metadata, state: 'healthy' };
}

async function checkModelExecutionCapability(): Promise<RuntimeCapabilityCheckResult> {
    const models = await listAgentModels();
    const available = models.models.filter((model) => model.availability === 'available');
    const metadata = {
        modelCount: models.models.length,
        providerCount: models.providers.length,
        providers: models.providers.map((provider) => provider.id),
    };

    if (available.length === 0) {
        return {
            metadata,
            reason: 'No executable agent model is configured.',
            state: 'unavailable',
        };
    }

    return { metadata, state: 'healthy' };
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
        if (!findExecutable('codex')) {
            return {
                reason: 'Codex CLI is not available to Tavern Runtime. Install codex or set TAVERN_AGENT_CODEX_CLI_COMMAND.',
                state: 'unavailable',
                technicalMessage: `Searched PATH and ${fallbackBinDirectories().join(', ')}.`,
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
