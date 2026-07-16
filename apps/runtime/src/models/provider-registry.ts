import { isCliCommandAvailable } from '../agent-engine/cli-command.ts';
import { readConfigValue } from '../config.ts';
import { hasClaudeCredentials } from '../model-access/claude-settings.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';
import { resolveClaudeModelCatalog } from './provider-sources/claude.ts';
import { resolveCodexModelCatalog } from './provider-sources/codex.ts';
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

export const openAiProvider = {
    id: 'openai',
    label: 'OpenAI',
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
            // Claude signs in through the runtime's own code-paste PKCE flow
            // (Model access); an Anthropic API key is the fallback.
            authenticated: () => hasClaudeCredentials(),
            authType: 'oauth_device_code',
            keyEnv: 'ANTHROPIC_API_KEY',
            oauthFlow: 'pkce',
            provider: claudeProvider,
            resolveCatalog: () =>
                resolveClaudeModelCatalog({
                    command: claudeCommand,
                    provider: claudeProvider,
                }),
        },
    ];
}

function readOpenAiApiKey() {
    return (
        readConfigValue('OPENAI_API_KEY') ??
        readConfigValue('TAVERN_AGENT_API_KEY') ??
        getOpenAiApiKey()
    );
}
