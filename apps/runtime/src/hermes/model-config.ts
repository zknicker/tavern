import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME, readConfigValue } from '../config.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings.ts';
import { resolveAgentEnvEntries } from './agent-env.ts';
import { syncHermesCodexAuth } from './auth-store.ts';
import { resolveConnectorsDomain } from './connectors.ts';
import { quoteEnvValue, readEnvEntries, readManagedHermesEnvValue } from './env.ts';
import { getHermesExecutionSettings } from './execution-settings.ts';
import { mergeHermesGeneratedConfig } from './generated-config.ts';
import { prepareManagedVaultPackage, resolveManagedVaultPath } from './managed-vault.ts';
import { ensureManagedMerchbaseSkill } from './merchbase-skill.ts';
import { ensureManagedMerchbaseToolsetPlugin } from './merchbase-toolset-plugin.ts';
import { resolveConfiguredPermissionsDomain } from './permission-settings.ts';
import { removeRetiredManagedSkillCopies } from './retired-managed-skills.ts';
import { ensureManagedTavernSkill } from './tavern-skill.ts';

export interface HermesModelConfig {
    apiKey: string | null;
    baseUrl: null | string;
    model: null | string;
    openAiApiKey: string | null;
    openRouterApiKey: string | null;
    provider: null | string;
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

export function hasExplicitManagedHermesModelSelection() {
    return Boolean(
        readConfigValue('TAVERN_HERMES_PROVIDER') && readConfigValue('TAVERN_HERMES_MODEL')
    );
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

    const route = resolveManagedHermesModelRoute({
        codexCredentialsAvailable: codexCredentials !== null,
        codexModel,
        explicitApiKey,
        explicitBaseUrl,
        explicitModel,
        explicitProvider,
        openAiApiKey,
        openRouterApiKey,
    });

    return route;
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

export async function prepareManagedHermesModelConfig(): Promise<HermesModelConfig> {
    const config = await writeManagedHermesConfigFile();
    await syncHermesCodexAuth(
        path.join(HERMES_HOME, 'auth.json'),
        await loadVaultBackedCodexCredentials().catch(() => null)
    );
    await removeRetiredManagedSkillCopies();
    await prepareManagedVaultPackage();
    await ensureManagedTavernSkill();
    await ensureManagedMerchbaseSkill();
    await ensureManagedMerchbaseToolsetPlugin();
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

    entries.set('TAVERN_VAULT_PATH', resolveManagedVaultPath());
    entries.delete('MNEMOSYNE_HOST_LLM_ENABLED');

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
