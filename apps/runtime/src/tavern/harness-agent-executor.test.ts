import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { afterEach, describe, expect, it } from 'vitest';
import { claudeCodeAuthOptions, formatHarnessExecutionError } from './harness-agent-executor.ts';

const now = '2026-06-29T12:00:00.000Z';
const originalClaudeToken = process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN;
const originalAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN;

afterEach(() => {
    restoreEnv('TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN', originalClaudeToken);
    restoreEnv('ANTHROPIC_AUTH_TOKEN', originalAnthropicToken);
});

describe('harness agent executor', () => {
    it('passes a Tavern-configured Claude auth token into the Claude harness', () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN = 'tavern-token';
        process.env.ANTHROPIC_AUTH_TOKEN = undefined;

        expect(claudeCodeAuthOptions()).toEqual({
            anthropic: { authToken: 'tavern-token' },
        });
    });

    it('falls back to an Anthropic auth token loaded by Runtime config', () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN = undefined;
        process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token';

        expect(claudeCodeAuthOptions()).toEqual({
            anthropic: { authToken: 'anthropic-token' },
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
