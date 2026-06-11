import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME, readConfigValue } from '../config';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings';
import { getOpenAiApiKey } from '../model-access/openai-settings';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings';
import { syncHermesCodexAuth } from './auth-store';
import { resolveConnectorsDomain } from './connectors';
import { quoteEnvValue, readEnvEntries, readManagedHermesEnvValue } from './env';
import { getHermesExecutionSettings } from './execution-settings';
import { type HermesModelDomain, mergeHermesGeneratedConfig } from './generated-config';
import { prepareManagedLlmWikiIntegration } from './llm-wiki';
import { ensureManagedMnemosynePackage, ensureManagedMnemosynePlugin } from './mnemosyne';
import { resolveConfiguredPermissionsDomain } from './permission-settings';

interface HermesModelConfig extends HermesModelDomain {
    openAiApiKey: string | null;
    openRouterApiKey: string | null;
}

interface ManagedHermesModelConfigInput {
    hermesBinary?: string;
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

    if (explicitProvider && explicitModel) {
        return {
            apiKey: explicitApiKey,
            baseUrl: explicitBaseUrl,
            model: explicitModel,
            openAiApiKey,
            openRouterApiKey,
            provider: explicitProvider,
        };
    }

    if (openRouterApiKey && !openAiApiKey) {
        return {
            apiKey: explicitApiKey,
            baseUrl: explicitBaseUrl,
            model: explicitModel ?? 'moonshotai/kimi-k2.5',
            openAiApiKey,
            openRouterApiKey,
            provider: explicitProvider ?? 'openrouter',
        };
    }

    return {
        apiKey: explicitApiKey,
        baseUrl: explicitBaseUrl,
        model: explicitModel ?? codexModel ?? 'gpt-5.4-mini',
        openAiApiKey,
        openRouterApiKey,
        provider: explicitProvider ?? 'openai-codex',
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
    await prepareManagedLlmWikiIntegration();
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
    const connectors = resolveConnectorsDomain();
    await fs.mkdir(HERMES_HOME, { recursive: true });
    await mergeHermesGeneratedConfig(path.join(HERMES_HOME, 'config.yaml'), {
        connectors: connectors.domain,
        execution: getHermesExecutionSettings(),
        model: config,
        permissions: await resolveConfiguredPermissionsDomain(),
    });
    await mergeHermesEnvFile(path.join(HERMES_HOME, '.env'), config, connectors.envEntries);
    return config;
}

export async function mergeHermesEnvFile(
    filePath: string,
    config: HermesModelConfig,
    connectorEnvEntries: Map<string, string> = new Map()
) {
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

    if (config.openAiApiKey) {
        entries.set('OPENAI_API_KEY', config.openAiApiKey);
    }
    if (config.openRouterApiKey) {
        entries.set('OPENROUTER_API_KEY', config.openRouterApiKey);
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
