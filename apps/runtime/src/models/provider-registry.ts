import { isCliCommandAvailable } from '../agent-engine/cli-command.ts';
import { readConfigValue } from '../config.ts';
import { getAnthropicApiKey } from '../model-access/anthropic-settings.ts';
import { hasClaudeCredentials } from '../model-access/claude-settings.ts';
import { hasHostClaudeLogin } from '../model-access/host-claude-login.ts';
import { hasKimiCredentials } from '../model-access/kimi-settings.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';
import { resolveClaudeModelCatalog } from './provider-sources/claude.ts';
import { resolveCodexModelCatalog } from './provider-sources/codex.ts';
import { resolveKimiModelCatalog } from './provider-sources/kimi.ts';
import { resolveOpenAiModelCatalog } from './provider-sources/openai.ts';
import type {
    AgentRuntimeModelProviderEntry,
    ModelCatalogProvider,
    ModelCatalogResult,
} from './provider-sources/shared.ts';

export interface ModelCatalogProviderSpec {
    authenticated: () => boolean;
    authType: AgentRuntimeModelProviderEntry['authType'];
    keyEnv: null | string;
    oauthFlow: AgentRuntimeModelProviderEntry['oauthFlow'];
    provider: ModelCatalogProvider;
    resolveCatalog: () => ModelCatalogResult | Promise<ModelCatalogResult>;
}

export const codexProvider = {
    id: 'codex',
    label: 'Codex',
} as const satisfies ModelCatalogProvider;

export const claudeProvider = {
    id: 'claude',
    label: 'Claude Code',
} as const satisfies ModelCatalogProvider;

export const anthropicProvider = {
    id: 'anthropic',
    label: 'Anthropic',
} as const satisfies ModelCatalogProvider;

export const openAiProvider = {
    id: 'openai',
    label: 'OpenAI',
} as const satisfies ModelCatalogProvider;

export const kimiProvider = {
    id: 'kimi',
    label: 'Kimi Code',
} as const satisfies ModelCatalogProvider;

export function modelCatalogProviderSpecs(): ModelCatalogProviderSpec[] {
    const codexCommand = readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex';
    const claudeCommand = readConfigValue('TAVERN_AGENT_CLAUDE_CODE_COMMAND') ?? 'claude';

    return [
        {
            authenticated: () => Boolean(readOpenAiApiKey()),
            authType: 'api_key',
            keyEnv: 'OPENAI_API_KEY',
            oauthFlow: null,
            provider: openAiProvider,
            resolveCatalog: () =>
                resolveOpenAiModelCatalog({
                    apiKey: readOpenAiApiKey(),
                    provider: openAiProvider,
                }),
        },
        {
            authenticated: () => isCliCommandAvailable(codexCommand),
            authType: 'oauth_external',
            keyEnv: null,
            oauthFlow: 'external',
            provider: codexProvider,
            resolveCatalog: () =>
                resolveCodexModelCatalog({
                    command: codexCommand,
                    provider: codexProvider,
                }),
        },
        {
            // Claude Code signs in through the runtime's own code-paste PKCE
            // flow (Model access), or rides a detected host Claude Code login
            // with zero setup. API-key access is the separate anthropic
            // provider, the way OpenAI is separate from Codex.
            authenticated: () => hasClaudeCredentials() || hasHostClaudeLogin(),
            authType: 'oauth_device_code',
            keyEnv: null,
            oauthFlow: 'pkce',
            provider: claudeProvider,
            resolveCatalog: () =>
                resolveClaudeModelCatalog({
                    command: claudeCommand,
                    provider: claudeProvider,
                }),
        },
        {
            authenticated: () => Boolean(readAnthropicApiKey()),
            authType: 'api_key',
            keyEnv: 'ANTHROPIC_API_KEY',
            oauthFlow: null,
            provider: anthropicProvider,
            resolveCatalog: () =>
                resolveClaudeModelCatalog({
                    command: claudeCommand,
                    provider: anthropicProvider,
                }),
        },
        {
            // Kimi Code signs in through the runtime's OAuth device flow;
            // turns run on the pi harness against the subscription endpoint.
            authenticated: () => hasKimiCredentials(),
            authType: 'oauth_device_code',
            keyEnv: null,
            oauthFlow: 'device_code',
            provider: kimiProvider,
            resolveCatalog: () => resolveKimiModelCatalog(kimiProvider),
        },
    ];
}

export function readAnthropicApiKey() {
    return readConfigValue('ANTHROPIC_API_KEY') ?? getAnthropicApiKey();
}

function readOpenAiApiKey() {
    return (
        readConfigValue('OPENAI_API_KEY') ??
        readConfigValue('TAVERN_AGENT_API_KEY') ??
        getOpenAiApiKey()
    );
}
