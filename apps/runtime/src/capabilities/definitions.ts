import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import { parseDocument } from 'yaml';
import { HERMES_HOME } from '../config.ts';
import { readEnvEntries } from '../hermes/env.ts';
import { managedMnemosyneConfig, managedMnemosyneEnv } from '../hermes/generated-config.ts';
import { createLocalHermesClient } from '../hermes/local-client.ts';
import { getManagedVaultSkillPath } from '../hermes/managed-vault.ts';
import { getManagedMnemosynePluginPath } from '../hermes/mnemosyne.ts';
import { getManagedHermesState } from '../hermes/state.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { resolveVaultConfig } from '../vault/store.ts';

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
            return await checkVaultCapability();
        },
        displayName: 'Vault',
        id: 'vault',
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
                unavailableReason: 'The agent engine is not running.',
            });
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
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.assertApiReady();
                },
                metadata: { endpoint: '/api/sessions' },
                unavailableReason: 'The agent engine is not accepting requests.',
            });
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
            return await checkManagedHermesCapability({
                check: async (client) => {
                    await client.assertGatewayReady();
                },
                metadata: { endpoint: '/api/ws' },
                unavailableReason: 'The live connection to your agent is unavailable.',
            });
        },
        displayName: 'Agent connection',
        id: 'gateway',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkMnemosyneMemoryCapability();
        },
        displayName: 'Assistant memory',
        id: 'mnemosyneMemory',
        refresh: {
            intervalMs: 5 * minuteMs,
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
                unavailableReason: "The assistant's model inventory is not reachable.",
            });
        },
        displayName: 'Models',
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
                unavailableReason: "The assistant's skill inventory is not reachable.",
            });
        },
        displayName: 'Skills',
        id: 'skills',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
];

async function checkVaultCapability(): Promise<RuntimeCapabilityCheckResult> {
    const config = await resolveVaultConfig();
    const vaultPath = config.vaultPath;
    const skillPath = getManagedVaultSkillPath();
    const metadata = {
        configSource: config.source,
        skillPath,
        vaultPath,
    };
    try {
        const skillReady = fs.existsSync(path.join(skillPath, 'SKILL.md'));
        if (fs.existsSync(vaultPath)) {
            const stat = fs.statSync(vaultPath);
            if (!stat.isDirectory()) {
                return {
                    reason: 'Vault path is not a directory.',
                    state: 'unavailable',
                    technicalMessage: vaultPath,
                };
            }
            fs.accessSync(vaultPath, fs.constants.R_OK);
            const writable = canAccess(vaultPath, fs.constants.W_OK);
            const existingMetadata = { ...metadata, writable };
            return skillReady
                ? { metadata: existingMetadata, state: 'healthy' }
                : {
                      metadata: existingMetadata,
                      reason: 'The managed Vault skill has not been prepared yet.',
                      state: 'degraded',
                  };
        }

        fs.accessSync(path.dirname(vaultPath), fs.constants.R_OK | fs.constants.W_OK);
        return {
            metadata: { ...metadata, missing: true },
            reason: skillReady ? null : 'The managed Vault skill has not been prepared yet.',
            state: skillReady ? 'healthy' : 'degraded',
        };
    } catch (error) {
        return {
            reason: 'Vault path is not readable.',
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

function checkMnemosyneMemoryCapability(): RuntimeCapabilityCheckResult {
    const configPath = path.join(HERMES_HOME, 'config.yaml');
    const envPath = path.join(HERMES_HOME, '.env');
    const pluginPath = getManagedMnemosynePluginPath();
    const metadata = {
        configPath,
        envPath,
        pluginPath,
        sleepThreshold: managedMnemosyneConfig.sleepThreshold,
    };

    if (!fs.existsSync(configPath)) {
        return {
            metadata,
            reason: 'Assistant memory has not been configured yet.',
            state: 'unavailable',
            technicalMessage: configPath,
        };
    }

    const config = parseHermesConfig(configPath);
    if (config instanceof Error) {
        return {
            metadata,
            reason: 'Assistant memory settings could not be read.',
            state: 'degraded',
            technicalMessage: config.message,
        };
    }

    const memory = readRecord(readRecord(config).memory);
    const mnemosyne = readRecord(memory.mnemosyne);
    const ignorePatterns = readStringArray(mnemosyne.ignore_patterns);
    const env = readEnvEntries(fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '');
    const missingConfig = [
        memory.provider === 'mnemosyne' ? null : 'memory.provider',
        memory.memory_enabled === false ? null : 'memory.memory_enabled',
        memory.user_profile_enabled === false ? null : 'memory.user_profile_enabled',
        mnemosyne.auto_sleep === managedMnemosyneConfig.autoSleep
            ? null
            : 'memory.mnemosyne.auto_sleep',
        mnemosyne.sleep_threshold === managedMnemosyneConfig.sleepThreshold
            ? null
            : 'memory.mnemosyne.sleep_threshold',
        sameStringArray(ignorePatterns, [...managedMnemosyneConfig.ignorePatterns])
            ? null
            : 'memory.mnemosyne.ignore_patterns',
        env.get('MNEMOSYNE_HOST_LLM_ENABLED') === managedMnemosyneEnv.MNEMOSYNE_HOST_LLM_ENABLED
            ? null
            : 'MNEMOSYNE_HOST_LLM_ENABLED',
    ].filter((item): item is string => item !== null);

    if (missingConfig.length > 0) {
        return {
            metadata: { ...metadata, missingConfig },
            reason: 'Assistant memory settings need to be refreshed.',
            state: 'degraded',
            technicalMessage: missingConfig.join(', '),
        };
    }

    if (
        !(
            fs.existsSync(path.join(pluginPath, 'plugin.yaml')) &&
            fs.existsSync(path.join(pluginPath, '__init__.py'))
        )
    ) {
        return {
            metadata,
            reason: 'Assistant memory provider has not been prepared yet.',
            state: 'unavailable',
            technicalMessage: pluginPath,
        };
    }

    return { metadata, state: 'healthy' };
}

async function checkManagedHermesCapability(input: {
    check(client: ReturnType<typeof createLocalHermesClient>): Promise<void>;
    metadata?: Record<string, unknown>;
    unavailableReason: string;
}): Promise<RuntimeCapabilityCheckResult> {
    const bootstrap = getManagedHermesState().bootstrap;
    if (bootstrap.phase === 'installing') {
        return {
            metadata: { ...input.metadata, bootstrap: 'installing' },
            reason: 'Tavern is setting up the agent engine. First-time setup can take a few minutes.',
            state: 'unavailable',
        };
    }
    if (bootstrap.phase === 'failed') {
        return {
            metadata: { ...input.metadata, bootstrap: 'failed' },
            reason: bootstrap.message ?? 'The agent engine could not be set up.',
            state: 'unavailable',
        };
    }

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

function parseHermesConfig(configPath: string): Error | unknown {
    try {
        return parseDocument(fs.readFileSync(configPath, 'utf8')).toJS() as unknown;
    } catch (error) {
        return error instanceof Error ? error : new Error(String(error));
    }
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : [];
}

function sameStringArray(left: string[], right: string[]) {
    return left.length === right.length && left.every((entry, index) => entry === right[index]);
}
