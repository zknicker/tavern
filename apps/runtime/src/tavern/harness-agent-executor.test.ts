import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    createChat,
    createMessage,
    getMessage,
    getResponse,
    getResponseActivity,
    upsertResponse,
} from './chat-api/index.ts';
import {
    claudeCodeAuthOptions,
    createHarnessAgentExecutor,
    formatHarnessExecutionError,
    harnessPrompt,
    piAuthOptions,
    setHarnessAgentFactoryForTesting,
} from './harness-agent-executor.ts';
import { messageActivityIdForRun, toolActivityIdForRun } from './harness-turn-stream.ts';

const now = '2026-06-29T12:00:00.000Z';
const originalClaudeToken = process.env.TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN;
const originalAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN;
const originalClaudeBaseUrl = process.env.TAVERN_AGENT_CLAUDE_CODE_BASE_URL;
const originalAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
const originalAgentApiKey = process.env.TAVERN_AGENT_API_KEY;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalAgentBaseUrl = process.env.TAVERN_AGENT_BASE_URL;

beforeEach(() => {
    process.env.TAVERN_AGENT_CLAUDE_CODE_BASE_URL = '';
    process.env.ANTHROPIC_BASE_URL = '';
    ensureRuntimeSchema(initTestDb());
});

afterEach(() => {
    closeDb();
    restoreEnv('TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN', originalClaudeToken);
    restoreEnv('ANTHROPIC_AUTH_TOKEN', originalAnthropicToken);
    restoreEnv('TAVERN_AGENT_CLAUDE_CODE_BASE_URL', originalClaudeBaseUrl);
    restoreEnv('ANTHROPIC_BASE_URL', originalAnthropicBaseUrl);
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

    it('persists tool and commentary activity while the harness turn is still streaming', async () => {
        seedPromptChat({ chatId: 'cht_stream_exec', kind: 'dm' });
        createPromptMessage('cht_stream_exec', {
            authorId: 'usr_alice',
            content: 'how are sales today?',
            id: 'msg_stream_exec',
            role: 'user',
        });

        const toolGate = createGate();
        async function* parts() {
            yield* fakeTextSegment('txt_1', 'Pulling sales now.');
            yield {
                input: { command: 'sales --today' },
                toolCallId: 'tool_1',
                toolName: 'bash',
                type: 'tool-call',
            };
            await toolGate.opened;
            yield {
                input: { command: 'sales --today' },
                output: '17 sold',
                toolCallId: 'tool_1',
                toolName: 'bash',
                type: 'tool-result',
            };
            yield* fakeTextSegment('txt_2', 'Sales today: 17 units.');
        }
        const fakeAgent = {
            createSession: () =>
                Promise.resolve({
                    destroy: () => Promise.resolve(),
                    sessionId: 'ses_fake',
                    stop: () => Promise.resolve({}),
                }),
            stream: () => Promise.resolve({ fullStream: parts(), text: Promise.resolve('') }),
        };
        const restoreFactory = setHarnessAgentFactoryForTesting(
            (() => fakeAgent) as unknown as Parameters<typeof setHarnessAgentFactoryForTesting>[0]
        );

        try {
            const input = executorInput(
                { model: 'claude-opus-4-8', provider: 'claude' },
                {
                    chatId: 'cht_stream_exec',
                    content: 'how are sales today?',
                    requestMessageId: 'msg_stream_exec',
                    workspaceFolder: mkdtempSync(path.join(os.tmpdir(), 'tavern-exec-test-')),
                }
            );
            upsertResponse('cht_stream_exec', {
                id: input.responseId,
                participant_id: 'agt_primary',
                request_message_id: 'msg_stream_exec',
                status: 'running',
                summary: 'Working on it.',
            });
            const pendingTurn = createHarnessAgentExecutor().execute(input);
            let turnError: unknown;
            pendingTurn.catch((error: unknown) => {
                turnError = error;
            });

            const toolActivityId = toolActivityIdForRun(input.runId, 'tool_1');
            await waitForActivity(toolActivityId, () => turnError);
            expect(getResponseActivity(toolActivityId)?.status).toBe('running');
            expect(getResponseActivity(messageActivityIdForRun(input.runId, 0))?.summary).toBe(
                'Pulling sales now.'
            );
            expect(getResponse(input.responseId)?.status).not.toBe('completed');

            toolGate.open();
            const result = await pendingTurn;

            expect(getResponseActivity(toolActivityId)?.status).toBe('completed');
            expect(result.activityIds).toContain(toolActivityId);
            expect(result.outputMessageIds).toHaveLength(1);
            const reply = getMessage(result.outputMessageIds[0] ?? '');
            expect(reply?.content).toBe('Sales today: 17 units.');
            expect(getResponse(input.responseId)?.status).toBe('completed');
        } finally {
            restoreFactory();
        }
    });

    it('does not replay prior DM transcript messages into the harness prompt', async () => {
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

        const prompt = await harnessPrompt(
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

    it('includes only channel messages after the session prompt cursor', async () => {
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

        const prompt = await harnessPrompt(
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

    it('anchors the prompt in time with a current-time line and per-message timestamps', async () => {
        seedPromptChat({ chatId: 'cht_time', kind: 'channel' });
        createPromptMessage('cht_time', {
            authorId: 'usr_alice',
            content: 'ambient note',
            id: 'msg_time_ambient',
            role: 'user',
        });
        const current = createPromptMessage('cht_time', {
            authorId: 'usr_bob',
            content: 'current ask',
            id: 'msg_time_current',
            role: 'user',
        });

        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_time',
                    content: 'current ask',
                    requestMessageId: 'msg_time_current',
                }
            )
        );

        expect(prompt).toMatch(/- current time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(prompt).toContain(`at:${current.message.created_at}] Bob: current ask`);
        expect(prompt).toMatch(/at:\d{4}-\d{2}-\d{2}T[^\]]+\] Alice: ambient note/);
    });

    it('adds reply parent context when the cursor delta does not include it', async () => {
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

        const prompt = await harnessPrompt(
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

    it('projects linked enabled skill references into the harness prompt as hints', async () => {
        seedPromptChat({ chatId: 'cht_skill', kind: 'dm' });
        createPromptMessage('cht_skill', {
            authorId: 'usr_alice',
            content: 'Use [$prompt-skill](skill://prompt-skill) for this answer.',
            id: 'msg_skill_current',
            role: 'user',
        });

        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_skill',
                    content: 'Use [$prompt-skill](skill://prompt-skill) for this answer.',
                    enabledSkillIds: ['prompt-skill'],
                    requestMessageId: 'msg_skill_current',
                }
            )
        );

        expect(prompt).toContain('<skill_reference_context>');
        expect(prompt).toContain('- prompt-skill');
        expect(prompt).not.toContain('<skill name=');
        expect(prompt).not.toContain('# Prompt Skill');
        expect(prompt).toContain('Use [$prompt-skill](skill://prompt-skill) for this answer.');
    });

    it('does not project linked skill references that are not enabled for the agent', async () => {
        seedPromptChat({ chatId: 'cht_disabled_skill', kind: 'dm' });
        const content = 'Use [$prompt-skill](skill://prompt-skill) for this answer.';
        createPromptMessage('cht_disabled_skill', {
            authorId: 'usr_alice',
            content,
            id: 'msg_disabled_skill_current',
            role: 'user',
        });

        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_disabled_skill',
                    content,
                    enabledSkillIds: [],
                    requestMessageId: 'msg_disabled_skill_current',
                }
            )
        );

        expect(prompt).not.toContain('<skill_reference_context>');
        expect(prompt).toContain(content);
    });
});

function executorInput(
    model: AgentRuntimeModelName,
    input: {
        chatId?: string;
        content?: string;
        enabledSkillIds?: string[];
        promptContextSequence?: number;
        requestMessageId?: string;
        workspaceFolder?: string;
    } = {}
) {
    const chatId = input.chatId ?? 'cht_general';
    return {
        agent: {
            enabledSkillIds: input.enabledSkillIds ?? [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: input.workspaceFolder ?? '.tavern/agents/agt_primary/workspace',
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

function* fakeTextSegment(id: string, text: string) {
    yield { id, type: 'text-start' };
    yield { id, text, type: 'text-delta' };
    yield { id, type: 'text-end' };
}

function createGate() {
    let open: () => void = () => {};
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { open, opened };
}

async function waitForActivity(activityId: string, turnError?: () => unknown) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const error = turnError?.();
        if (error !== undefined) {
            throw error;
        }
        if (getResponseActivity(activityId)) {
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
    }
    throw new Error(`Activity ${activityId} was not persisted while the turn was streaming.`);
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}
