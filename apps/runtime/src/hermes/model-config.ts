import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME, readConfigValue } from '../config';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings';
import { getOpenAiApiKey } from '../model-access/openai-settings';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings';
import { resolveAgentEnvEntries } from './agent-env';
import { syncHermesCodexAuth } from './auth-store';
import { resolveConnectorsDomain } from './connectors';
import { quoteEnvValue, readEnvEntries, readManagedHermesEnvValue } from './env';
import { getHermesExecutionSettings } from './execution-settings';
import { type HermesModelDomain, mergeHermesGeneratedConfig } from './generated-config';
import { prepareManagedWikiIntegration } from './managed-wiki';
import { ensureManagedMnemosynePackage, ensureManagedMnemosynePlugin } from './mnemosyne';
import { resolveConfiguredPermissionsDomain } from './permission-settings';
import { ensureManagedTavernSkill } from './tavern-skill';

export interface HermesModelConfig extends HermesModelDomain {
    openAiApiKey: string | null;
    openRouterApiKey: string | null;
}

export const managedMnemosyneEnv = {
    MNEMOSYNE_HOST_LLM_ENABLED: 'true',
} as const;

interface ManagedHermesModelConfigInput {
    hermesBinary?: string;
}

export interface ManagedHermesModelRouteInput {
    codexCredentialsAvailable: boolean;
    codexModel: null | string;
    explicitApiKey: null | string;
    explicitBaseUrl: null | string;
    explicitModel: null | string;
    explicitProvider: null | string;
    openAiApiKey: null | string;
    openRouterApiKey: null | string;
}

export async function resolveManagedHermesModelConfig(): Promise<HermesModelConfig> {
    const openRouterApiKey =
        readConfigValue('OPENROUTER_API_KEY') ??
        (await readManagedHermesEnvValue('OPENROUTER_API_KEY')) ??
        getOpenRouterApiKey();
    const openAiApiKey =
        readConfigValue('OPENAI_API_KEY') ??
        (await readManagedHermesEnvValue('OPENAI_API_KEY')) ??
        getOpenAiApiKey();
    const explicitProvider = readConfigValue('TAVERN_HERMES_PROVIDER');
    const explicitModel = readConfigValue('TAVERN_HERMES_MODEL');
    const explicitBaseUrl = readConfigValue('TAVERN_HERMES_BASE_URL');
    const explicitApiKey = readConfigValue('TAVERN_HERMES_API_KEY');
    const codexModel = readConfigValue('CODEX_MODEL');
    const codexCredentials = await loadVaultBackedCodexCredentials().catch(() => null);

    return resolveManagedHermesModelRoute({
        codexCredentialsAvailable: codexCredentials !== null,
        codexModel,
        explicitApiKey,
        explicitBaseUrl,
        explicitModel,
        explicitProvider,
        openAiApiKey,
        openRouterApiKey,
    });
}

export function resolveManagedHermesModelRoute(
    input: ManagedHermesModelRouteInput
): HermesModelConfig {
    if (input.explicitProvider && input.explicitModel) {
        return {
            apiKey: input.explicitApiKey,
            baseUrl: input.explicitBaseUrl,
            model: input.explicitModel,
            openAiApiKey: input.openAiApiKey,
            openRouterApiKey: input.openRouterApiKey,
            provider: input.explicitProvider,
        };
    }

    if (input.codexCredentialsAvailable) {
        return {
            apiKey: input.explicitApiKey,
            baseUrl: input.explicitBaseUrl,
            model: input.explicitModel ?? input.codexModel ?? 'gpt-5.4-mini',
            openAiApiKey: input.openAiApiKey,
            openRouterApiKey: input.openRouterApiKey,
            provider: input.explicitProvider ?? 'openai-codex',
        };
    }

    if (input.openAiApiKey) {
        return {
            apiKey: input.explicitApiKey,
            baseUrl: input.explicitBaseUrl ?? 'https://api.openai.com/v1',
            model: input.explicitModel ?? input.codexModel ?? 'gpt-5.4-mini',
            openAiApiKey: input.openAiApiKey,
            openRouterApiKey: input.openRouterApiKey,
            provider: input.explicitProvider ?? 'openai',
        };
    }

    if (input.openRouterApiKey) {
        return {
            apiKey: input.explicitApiKey,
            baseUrl: input.explicitBaseUrl,
            model: input.explicitModel ?? 'moonshotai/kimi-k2.5',
            openAiApiKey: input.openAiApiKey,
            openRouterApiKey: input.openRouterApiKey,
            provider: input.explicitProvider ?? 'openrouter',
        };
    }

    return {
        apiKey: input.explicitApiKey,
        baseUrl: input.explicitBaseUrl,
        model: input.explicitModel ?? null,
        openAiApiKey: input.openAiApiKey,
        openRouterApiKey: input.openRouterApiKey,
        provider: input.explicitProvider ?? null,
    };
}

export async function prepareManagedHermesModelConfig(
    input: ManagedHermesModelConfigInput = {}
): Promise<HermesModelConfig> {
    const config = await writeManagedHermesConfigFile();
    await syncHermesCodexAuth(
        path.join(HERMES_HOME, 'auth.json'),
        await loadVaultBackedCodexCredentials().catch(() => null)
    );
    await prepareManagedWikiIntegration();
    await ensureManagedTavernSkill();
    await ensureManagedMnemosynePlugin();
    if (input.hermesBinary) {
        await ensureManagedMnemosynePackage({ hermesBinary: input.hermesBinary });
    }
    return config;
}

/**
 * Rewrite the generated config and env files from current Runtime state. Used
 * at startup and whenever a Tavern-owned config domain (execution settings,
 * permissions, connectors) changes at runtime.
 */
export async function writeManagedHermesConfigFile(): Promise<HermesModelConfig> {
    const config = await resolveManagedHermesModelConfig();
    const agentEnv = resolveAgentEnvEntries();
    const connectors = resolveConnectorsDomain();
    await fs.mkdir(HERMES_HOME, { recursive: true });
    await mergeHermesGeneratedConfig(path.join(HERMES_HOME, 'config.yaml'), {
        connectors: connectors.domain,
        execution: getHermesExecutionSettings(),
        model: config,
        permissions: await resolveConfiguredPermissionsDomain(),
    });
    await mergeHermesEnvFile(path.join(HERMES_HOME, '.env'), {
        agentEnvEntries: agentEnv.envEntries,
        agentEnvStaleNames: agentEnv.staleNames,
        config,
        connectorEnvEntries: connectors.envEntries,
    });
    return config;
}

export async function mergeHermesEnvFile(
    filePath: string,
    input: {
        agentEnvEntries?: Map<string, string>;
        agentEnvStaleNames?: string[];
        config: HermesModelConfig;
        connectorEnvEntries?: Map<string, string>;
    }
) {
    const agentEnvEntries = input.agentEnvEntries ?? new Map();
    const connectorEnvEntries = input.connectorEnvEntries ?? new Map();
    const entries = readEnvEntries(await fs.readFile(filePath, 'utf8').catch(() => ''));

    // Connector secrets are fully managed: stale TAVERN_MCP_* entries go away.
    for (const key of [...entries.keys()]) {
        if (key.startsWith('TAVERN_MCP_')) {
            entries.delete(key);
        }
    }
    for (const [key, value] of connectorEnvEntries) {
        entries.set(key, value);
    }

    for (const key of input.agentEnvStaleNames ?? []) {
        entries.delete(key);
    }
    for (const [key, value] of agentEnvEntries) {
        entries.set(key, value);
    }

    for (const [key, value] of Object.entries(managedMnemosyneEnv)) {
        entries.set(key, value);
    }

    if (input.config.openAiApiKey) {
        entries.set('OPENAI_API_KEY', input.config.openAiApiKey);
    }
    if (input.config.openRouterApiKey) {
        entries.set('OPENROUTER_API_KEY', input.config.openRouterApiKey);
    }

    if (entries.size === 0) {
        await fs.unlink(filePath).catch(() => undefined);
        return;
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
        filePath,
        `${[...entries].map(([key, value]) => `${key}=${quoteEnvValue(value)}`).join('\n')}\n`,
        { mode: 0o600 }
    );
    await fs.chmod(filePath, 0o600).catch(() => undefined);
}
