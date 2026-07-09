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
import { isMemoryEnabled } from '../memory/settings.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { createLanguageModelForRuntime } from '../models/language-model.ts';
import { resolveAgentModelSummary } from '../models/model-access.ts';
import { checkGoogleCalendarCapability } from '../plugins/google.ts';
import { checkMerchbaseCapability } from '../plugins/merchbase.ts';
import { isTaskDispatcherReady } from '../tasks/dispatcher.ts';
import { listStoredAgents } from '../tavern/agents-store.ts';
import { isDevToolkitEnabled } from '../tavern/development-turn-simulator.ts';
import { auditRecallIndex, getRecallProvisioningStatus } from '../wiki/recall/recall-index.ts';
import { resolveWikiConfig } from '../wiki/store.ts';

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
            return await checkMemoryCapability();
        },
        displayName: 'Memory',
        id: 'memory',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkWikiCapability();
        },
        displayName: 'Wiki',
        id: 'wiki',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkMemoryModelCapability('fast', 'Memory extraction');
        },
        displayName: 'Memory extraction',
        id: 'memoryExtraction',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkMemoryModelCapability('standard', 'Memory dreaming');
        },
        displayName: 'Memory dreaming',
        id: 'memoryDreaming',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkWikiRecallCapability();
        },
        displayName: 'Wiki recall',
        id: 'wikiRecall',
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
            return checkAutoDispatchCapability();
        },
        displayName: 'Auto-dispatch',
        id: 'autoDispatch',
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

function checkAutoDispatchCapability(): RuntimeCapabilityCheckResult {
    try {
        if (!hasTable(getDb(), 'tasks')) {
            return { reason: 'Task storage is not ready.', state: 'unavailable' };
        }
        return isTaskDispatcherReady()
            ? { state: 'healthy' }
            : { reason: 'Task dispatcher is not running.', state: 'unavailable' };
    } catch (error) {
        return {
            reason: 'Auto-dispatch is not ready.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

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

async function checkMemoryModelCapability(
    category: 'fast' | 'standard',
    displayName: string
): Promise<RuntimeCapabilityCheckResult> {
    if (!isMemoryEnabled()) {
        return {
            metadata: { enabled: false },
            reason: 'Memory is off.',
            state: 'unavailable',
        };
    }

    const model = resolveModelCategorySelection(category);
    const metadata = { [category]: `${model.provider}/${model.model}` };

    try {
        await createLanguageModelForRuntime(model);
    } catch (error) {
        return {
            metadata,
            reason: `${displayName} needs a direct model connection. Add an OpenAI or OpenRouter key, or choose a background model in Settings → Models.`,
            state: 'unavailable',
            technicalMessage:
                error instanceof Error
                    ? `${category}: ${error.message}`
                    : `${category}: model unavailable`,
        };
    }

    return { metadata, state: 'healthy' };
}

async function checkMemoryCapability(): Promise<RuntimeCapabilityCheckResult> {
    const enabled = isMemoryEnabled();
    const agents = listStoredAgents().agents;
    const metadata = {
        agentCount: agents.length,
        enabled,
    };

    if (!enabled) {
        return {
            metadata,
            reason: 'Memory is off.',
            state: 'unavailable',
        };
    }

    const inaccessible = agents.find((agent) => !canUseWorkspaceForMemory(agent.workspaceFolder));
    if (inaccessible) {
        return {
            metadata: {
                ...metadata,
                workspaceFolder: inaccessible.workspaceFolder,
            },
            reason: `Memory workspace for ${inaccessible.name} is not readable, writable, and traversable.`,
            state: 'unavailable',
            technicalMessage: inaccessible.workspaceFolder,
        };
    }

    return { metadata, state: 'healthy' };
}

async function checkWikiCapability(): Promise<RuntimeCapabilityCheckResult> {
    const config = await resolveWikiConfig();
    const wikiPath = config.wikiPath;
    const metadata = {
        configSource: config.source,
        wikiPath,
    };
    try {
        if (fs.existsSync(wikiPath)) {
            const stat = fs.statSync(wikiPath);
            if (!stat.isDirectory()) {
                return {
                    reason: 'Wiki path is not a directory.',
                    state: 'unavailable',
                    technicalMessage: wikiPath,
                };
            }
            fs.accessSync(wikiPath, fs.constants.R_OK);
            const writable = canAccess(wikiPath, fs.constants.W_OK);
            return { metadata: { ...metadata, writable }, state: 'healthy' };
        }

        fs.accessSync(path.dirname(wikiPath), fs.constants.R_OK | fs.constants.W_OK);
        return {
            metadata: { ...metadata, missing: true },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Wiki path is not readable.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

// Per-turn recall readiness: the recall index over Wiki pages plus
// its locally provisioned embedding model. Progress rides capability metadata
// so the app can render a provisioning bar without a contract shape change.
// The ready-state check is an active drift audit: recall that silently fell
// behind the pages (lost watcher events) reports pending work, not healthy.
async function checkWikiRecallCapability(): Promise<RuntimeCapabilityCheckResult> {
    const status = getRecallProvisioningStatus();
    const percent = status.progress === null ? null : `${Math.round(status.progress * 100)}%`;
    const metadata = {
        phase: status.phase,
        ...(status.progress === null ? {} : { progress: status.progress }),
    };

    switch (status.phase) {
        case 'ready':
            return await auditReadyWikiRecall(metadata);
        case 'downloading-model':
            return {
                metadata,
                reason: `Downloading the recall model${percent ? ` (${percent})` : ''}.`,
                state: 'degraded',
            };
        case 'embedding':
            return {
                metadata,
                reason: `Indexing Wiki pages for recall${percent ? ` (${percent})` : ''}.`,
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

async function auditReadyWikiRecall(
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

function canUseWorkspaceForMemory(workspaceFolder: string): boolean {
    try {
        const targetPath = path.resolve(workspaceFolder);
        const memoryDirectoryMode = fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK;
        if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            return stat.isDirectory() && canAccess(targetPath, memoryDirectoryMode);
        }

        return canAccess(nearestExistingParent(targetPath), memoryDirectoryMode);
    } catch {
        return false;
    }
}

function nearestExistingParent(targetPath: string): string {
    let current = path.dirname(targetPath);
    while (!(fs.existsSync(current) || path.dirname(current) === current)) {
        current = path.dirname(current);
    }
    return current;
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
