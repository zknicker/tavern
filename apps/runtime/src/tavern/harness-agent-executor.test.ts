import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createChat, createMessage } from './chat-api/index.ts';
import {
    claudeCodeAuthOptions,
    formatHarnessExecutionError,
    harnessPrompt,
    piAuthOptions,
} from './harness-agent-executor.ts';

const now = '2026-06-29T12:00:00.000Z';
const originalClaudeToken = process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN;
const originalAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN;
const originalAgentApiKey = process.env.TAVERN_AGENT_API_KEY;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalAgentBaseUrl = process.env.TAVERN_AGENT_BASE_URL;

beforeEach(() => {
    ensureRuntimeSchema(initTestDb());
});

afterEach(() => {
    closeDb();
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

    it('does not replay prior DM transcript messages into the harness prompt', () => {
        seedPromptChat({ chatId: 'cht_dm', kind: 'dm' });
        createPromptMessage('cht_dm', {
            authorId: 'usr_alice',
            content: 'older dm question',
            id: 'msg_dm_old_user',
            role: 'user',
        });
        createPromptMessage('cht_dm', {
            authorId: 'agt_primary',
            content: 'older dm answer',
            id: 'msg_dm_old_agent',
            role: 'assistant',
        });
        createPromptMessage('cht_dm', {
            authorId: 'usr_alice',
            content: 'current dm question',
            id: 'msg_dm_current',
            role: 'user',
        });

        const prompt = harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_dm',
                    content: 'current dm question',
                    requestMessageId: 'msg_dm_current',
                }
            )
        );

        expect(prompt).not.toContain('older dm question');
        expect(prompt).not.toContain('older dm answer');
        expect(prompt.match(/current dm question/g)).toHaveLength(1);
    });

    it('includes only channel messages after the session prompt cursor', () => {
        seedPromptChat({ chatId: 'cht_channel', kind: 'channel' });
        createPromptMessage('cht_channel', {
            authorId: 'usr_alice',
            content: 'before cursor',
            id: 'msg_channel_old',
            role: 'user',
        });
        createPromptMessage('cht_channel', {
            authorId: 'usr_alice',
            content: 'ambient channel note',
            id: 'msg_channel_ambient',
            role: 'user',
        });
        createPromptMessage('cht_channel', {
            authorId: 'agt_primary',
            content: 'own prior answer',
            id: 'msg_channel_own_answer',
            role: 'assistant',
        });
        createPromptMessage('cht_channel', {
            authorId: 'usr_bob',
            content: 'current channel ask',
            id: 'msg_channel_current',
            role: 'user',
        });

        const prompt = harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_channel',
                    content: 'current channel ask',
                    promptContextSequence: 1,
                    requestMessageId: 'msg_channel_current',
                }
            )
        );

        expect(prompt).toContain('ambient channel note');
        expect(prompt).not.toContain('before cursor');
        expect(prompt).not.toContain('own prior answer');
        expect(prompt.match(/current channel ask/g)).toHaveLength(1);
    });

    it('adds reply parent context when the cursor delta does not include it', () => {
        seedPromptChat({ chatId: 'cht_reply', kind: 'channel' });
        createPromptMessage('cht_reply', {
            authorId: 'usr_alice',
            content: 'root context',
            id: 'msg_reply_root',
            role: 'user',
        });
        createPromptMessage('cht_reply', {
            authorId: 'usr_alice',
            content: 'parent message context',
            id: 'msg_reply_parent',
            parentMessageId: 'msg_reply_root',
            role: 'user',
        });
        createPromptMessage('cht_reply', {
            authorId: 'usr_bob',
            content: 'current follow-up',
            id: 'msg_reply_current',
            parentMessageId: 'msg_reply_parent',
            role: 'user',
        });

        const prompt = harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_reply',
                    content: 'current follow-up',
                    promptContextSequence: 2,
                    requestMessageId: 'msg_reply_current',
                }
            )
        );

        expect(prompt).toContain('Reply context:');
        expect(prompt).toContain('parent message context');
        expect(prompt).not.toContain('root context');
        expect(prompt.match(/current follow-up/g)).toHaveLength(1);
    });
});

function executorInput(
    model: AgentRuntimeModelName,
    input: {
        chatId?: string;
        content?: string;
        promptContextSequence?: number;
        requestMessageId?: string;
    } = {}
) {
    const chatId = input.chatId ?? 'cht_general';
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
            chatId,
            createdAt: now,
            effectiveModel: model,
            generation: 1,
            id: `ags_${chatId}_agt_primary_1`,
            promptContextSequence: input.promptContextSequence ?? 0,
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        } satisfies AgentRuntimeAgentSession,
        attachments: [],
        chatId,
        content: input.content ?? 'hello',
        requestMessageId: input.requestMessageId ?? 'msg_1',
        responseId: 'rsp_run_1',
        runId: 'run_1',
    };
}

function seedPromptChat(input: { chatId: string; kind: 'channel' | 'dm' }) {
    createChat({
        id: input.chatId,
        kind: input.kind,
        participants: [
            {
                id: 'usr_alice',
                kind: 'user',
                label: 'Alice',
                metadata: {},
            },
            ...(input.kind === 'channel'
                ? [
                      {
                          id: 'usr_bob',
                          kind: 'user' as const,
                          label: 'Bob',
                          metadata: {},
                      },
                  ]
                : []),
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: input.chatId,
    });
}

function createPromptMessage(
    chatId: string,
    input: {
        authorId: string;
        content: string;
        id: string;
        parentMessageId?: string;
        role: 'assistant' | 'user';
    }
) {
    return createMessage(chatId, {
        author_id: input.authorId,
        content: input.content,
        id: input.id,
        ...(input.parentMessageId ? { parent_message_id: input.parentMessageId } : {}),
        role: input.role,
    });
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}
