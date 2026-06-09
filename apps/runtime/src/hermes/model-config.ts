import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { HERMES_HOME, readConfigValue } from '../config';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings';
import { getOpenAiApiKey } from '../model-access/openai-settings';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings';
import { syncHermesCodexAuth } from './auth-store';
import { quoteEnvValue, readEnvEntries, readManagedHermesEnvValue } from './env';
import { prepareManagedLlmWikiIntegration } from './llm-wiki';
import { ensureManagedMnemosynePackage, ensureManagedMnemosynePlugin } from './mnemosyne';
import { tavernMessengerPluginName } from './tavern-messenger-plugin';

interface HermesModelConfig {
    apiKey: string | null;
    baseUrl: null | string;
    model: string;
    openAiApiKey: string | null;
    openRouterApiKey: string | null;
    provider: string;
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
    const config = await resolveManagedHermesModelConfig();
    await fs.mkdir(HERMES_HOME, { recursive: true });
    await mergeHermesConfigFile(path.join(HERMES_HOME, 'config.yaml'), config);
    await mergeHermesEnvFile(path.join(HERMES_HOME, '.env'), config);
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

export async function mergeHermesConfigFile(filePath: string, config: HermesModelConfig) {
    const existing = await fs.readFile(filePath, 'utf8').catch(() => '');
    const doc = parseDocument(existing || '{}');

    doc.setIn(['model', 'default'], config.model);
    doc.setIn(['model', 'provider'], config.provider);
    if (config.baseUrl) {
        doc.setIn(['model', 'base_url'], config.baseUrl);
    } else {
        doc.deleteIn(['model', 'base_url']);
    }
    if (config.apiKey) {
        doc.setIn(['model', 'api_key'], config.apiKey);
    } else {
        doc.deleteIn(['model', 'api_key']);
    }
    ensureMnemosyneMemoryProvider(doc);
    ensurePluginEnabled(doc, tavernMessengerPluginName());

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, doc.toString(), { mode: 0o600 });
    await fs.chmod(filePath, 0o600).catch(() => undefined);
}

export async function mergeHermesEnvFile(filePath: string, config: HermesModelConfig) {
    const entries = readEnvEntries(await fs.readFile(filePath, 'utf8').catch(() => ''));

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

function ensurePluginEnabled(doc: ReturnType<typeof parseDocument>, pluginName: string) {
    const enabled = (doc.toJS() as { plugins?: { enabled?: unknown } } | null)?.plugins?.enabled;
    const values = Array.isArray(enabled)
        ? enabled.filter((item): item is string => typeof item === 'string')
        : [];

    if (values.includes(pluginName)) {
        return;
    }

    doc.setIn(['plugins', 'enabled'], [...values, pluginName]);
}

function ensureMnemosyneMemoryProvider(doc: ReturnType<typeof parseDocument>) {
    doc.setIn(['memory', 'provider'], 'mnemosyne');
    doc.setIn(['memory', 'memory_enabled'], false);
    doc.setIn(['memory', 'user_profile_enabled'], false);
}
