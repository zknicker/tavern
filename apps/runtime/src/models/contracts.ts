import type { AgentRuntimeModelName } from '@tavern/api';

export type AgentModelProvider = 'claude' | 'codex' | 'e2e' | 'openai' | 'openai-compatible';

export const defaultOpenAiModel = 'gpt-4.1-mini';
export const defaultE2eModel = 'tavern-e2e-tools';
export const defaultCodexModel = 'gpt-5.5';
export const defaultClaudeModel = 'claude-sonnet-4-6';

export function isAgentModelProvider(value: string): value is AgentModelProvider {
    return (
        value === 'claude' ||
        value === 'codex' ||
        value === 'e2e' ||
        value === 'openai' ||
        value === 'openai-compatible'
    );
}

export function modelRef(model: AgentRuntimeModelName) {
    return `${model.provider}/${model.model}`;
}
