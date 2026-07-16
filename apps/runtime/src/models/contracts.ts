import type { AgentRuntimeModelName } from '@tavern/api';

export type AgentModelProvider = 'anthropic' | 'claude' | 'codex' | 'openai' | 'openai-compatible';

export const defaultOpenAiModel = 'gpt-4.1-mini';
export const defaultCodexModel = 'gpt-5.5';
export const defaultClaudeModel = 'claude-sonnet-4-6';

export function isAgentModelProvider(value: string): value is AgentModelProvider {
    return (
        value === 'anthropic' ||
        value === 'claude' ||
        value === 'codex' ||
        value === 'openai' ||
        value === 'openai-compatible'
    );
}

export function modelRef(model: AgentRuntimeModelName) {
    return `${model.provider}/${model.model}`;
}
