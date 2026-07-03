import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import {
    merchbasePluginHealthCapabilityId,
    merchbasePluginManifest,
} from '@tavern/api/plugins/merchbase';
import { AGENT_WORKSPACE } from '../config.ts';
import { resolveSemanticMemoryConfig } from '../memory/semantic/store.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import { resolveAgentModelSummary } from '../models/model-access.ts';
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
];

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
