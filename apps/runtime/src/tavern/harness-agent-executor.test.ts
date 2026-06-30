import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { afterEach, describe, expect, it } from 'vitest';
import {
    claudeCodeAuthOptions,
    formatHarnessExecutionError,
    piAuthOptions,
} from './harness-agent-executor.ts';

const now = '2026-06-29T12:00:00.000Z';
const originalClaudeToken = process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN;
const originalAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN;
const originalAgentApiKey = process.env.TAVERN_AGENT_API_KEY;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalAgentBaseUrl = process.env.TAVERN_AGENT_BASE_URL;

afterEach(() => {
    restoreEnv('TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN', originalClaudeToken);
    restoreEnv('ANTHROPIC_AUTH_TOKEN', originalAnthropicToken);
    restoreEnv('TAVERN_AGENT_API_KEY', originalAgentApiKey);
    restoreEnv('OPENAI_API_KEY', originalOpenAiApiKey);
    restoreEnv('TAVERN_AGENT_BASE_URL', originalAgentBaseUrl);
});

describe('harness agent executor', () => {
    it('passes a Tavern-configured Claude auth token into the Claude harness', () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN = 'tavern-token';
        process.env.ANTHROPIC_AUTH_TOKEN = '';

        expect(claudeCodeAuthOptions()).toEqual({
            anthropic: { authToken: 'tavern-token' },
        });
    });

    it('falls back to an Anthropic auth token loaded by Runtime config', () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN = '';
        process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token';

        expect(claudeCodeAuthOptions()).toEqual({
            anthropic: { authToken: 'anthropic-token' },
        });
    });

    it('passes OpenAI API-key auth into the Pi harness', () => {
        process.env.TAVERN_AGENT_API_KEY = '';
        process.env.OPENAI_API_KEY = 'openai-token';

        expect(piAuthOptions('openai')).toEqual({
            customEnv: { OPENAI_API_KEY: 'openai-token' },
        });
    });

    it('passes OpenAI-compatible endpoint auth into the Pi harness', () => {
        process.env.TAVERN_AGENT_API_KEY = '';
        process.env.TAVERN_AGENT_BASE_URL = 'http://127.0.0.1:8080/v1';

        expect(piAuthOptions('openai-compatible')).toEqual({
            customEnv: {
                OPENAI_API_KEY: 'tavern-local',
                OPENAI_BASE_URL: 'http://127.0.0.1:8080/v1',
            },
        });
    });

    it('adds Claude-specific recovery guidance to auth failures', () => {
        const error = formatHarnessExecutionError(
            executorInput({ model: 'claude-opus-4-8', provider: 'claude' }),
            new Error('Failed to authenticate. API Error: 401 Invalid authentication credentials')
        );

        expect(error.message).toContain('Claude Code failed to authenticate');
        expect(error.message).toContain('claude setup-token');
        expect(error.message).toContain('Original error: Failed to authenticate');
    });

    it('adds Pi-specific recovery guidance to API-key failures', () => {
        const error = formatHarnessExecutionError(
            executorInput({ model: 'gpt-4.1-mini', provider: 'openai' }),
            new Error('No API key found for provider openai')
        );

        expect(error.message).toContain('Pi failed to authenticate');
        expect(error.message).toContain('OPENAI_API_KEY');
        expect(error.message).toContain('Original error: No API key found');
    });

    it('does not rewrite non-Claude harness errors', () => {
        const original = new Error('Codex Exec exited with code 1');

        expect(
            formatHarnessExecutionError(
                executorInput({ model: 'gpt-5.5', provider: 'codex' }),
                original
            )
        ).toBe(original);
    });
});

function executorInput(model: AgentRuntimeModelName) {
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
        } satisfies AgentRuntimeAgent,
        agentSession: {
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            archivedAt: null,
            chatId: 'cht_general',
            createdAt: now,
            effectiveModel: model,
            generation: 1,
            id: 'ags_cht_general_agt_primary_1',
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        } satisfies AgentRuntimeAgentSession,
        attachments: [],
        chatId: 'cht_general',
        content: 'hello',
        requestMessageId: 'msg_1',
        responseId: 'rsp_run_1',
        runId: 'run_1',
    };
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}
