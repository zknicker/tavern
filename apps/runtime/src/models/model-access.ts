import { resolveCliCommand } from '../agent-engine/cli-command.ts';
import { defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { readConfigValue } from '../config.ts';
import { resolveAgentModelSelection, resolveConfiguredProvider } from './selection-service.ts';

export function resolveAgentModelSummary() {
    return resolveAgentModelSelection({ agentId: defaultAgentEngineAgentId });
}

export function hasConfiguredAgentModelAccess() {
    const provider = resolveConfiguredProvider();

    if (provider === 'openai') {
        return Boolean(
            readConfigValue('OPENAI_API_KEY') ??
                readConfigValue('TAVERN_AGENT_API_KEY') ??
                readConfigValue('AI_GATEWAY_API_KEY') ??
                readConfigValue('VERCEL_OIDC_TOKEN')
        );
    }
    if (provider === 'openai-compatible') {
        return Boolean(readConfigValue('TAVERN_AGENT_BASE_URL'));
    }
    if (provider === 'claude') {
        return Boolean(
            resolveCliCommand(readConfigValue('TAVERN_AGENT_CLAUDE_CODE_COMMAND') ?? 'claude')
        );
    }
    if (provider === 'codex') {
        return Boolean(
            resolveCliCommand(readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex')
        );
    }
    return false;
}
