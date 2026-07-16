import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import { formatLocalTimestampWithWeekday } from '../timezone.ts';
import { upsertStoredAgent } from './agents-store.ts';
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
    piAuthOptions,
    setHarnessAgentFactoryForTesting,
    silentReplyActivityIdForRun,
} from './harness-agent-executor.ts';
import { harnessPrompt } from './harness-prompt.ts';
import { messageActivityIdForRun, toolActivityIdForRun } from './harness-turn-stream.ts';
import { advanceSeenCursor } from './seen-ledger.ts';

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

        expect(error.message).toContain('Claude is not connected');
        expect(error.message).toContain('Model access');
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

    it('completes a NO_REPLY turn without delivering an assistant message', async () => {
        seedPromptChat({ chatId: 'cht_silent', kind: 'channel' });
        createPromptMessage('cht_silent', {
            authorId: 'usr_alice',
            content: 'just chatting with Bob here',
            id: 'msg_silent',
            role: 'user',
        });

        const restoreFactory = setHarnessAgentFactoryForTesting(
            fakeStreamingAgentFactory(fakeTextSegment('txt_1', 'NO_REPLY'))
        );
        try {
            const input = executorInput(
                { model: 'claude-opus-4-8', provider: 'claude' },
                {
                    chatId: 'cht_silent',
                    content: 'just chatting with Bob here',
                    requestMessageId: 'msg_silent',
                    workspaceFolder: mkdtempSync(path.join(os.tmpdir(), 'tavern-exec-test-')),
                }
            );
            upsertResponse('cht_silent', {
                id: input.responseId,
                participant_id: 'agt_primary',
                request_message_id: 'msg_silent',
                status: 'running',
                summary: 'Working on it.',
            });

            const result = await createHarnessAgentExecutor().execute(input);

            expect(result.outputMessageIds).toEqual([]);
            const response = getResponse(input.responseId);
            expect(response?.status).toBe('completed');
            expect(response?.response_message_id).toBeNull();
            expect(response?.summary).toBe('Chose not to reply.');
            const activityId = silentReplyActivityIdForRun(input.runId);
            expect(result.activityIds).toContain(activityId);
            expect(getResponseActivity(activityId)?.title).toBe('Chose not to reply');
        } finally {
            restoreFactory();
        }
    });

    it('delivers replies that merely mention NO_REPLY', async () => {
        seedPromptChat({ chatId: 'cht_not_silent', kind: 'channel' });
        createPromptMessage('cht_not_silent', {
            authorId: 'usr_alice',
            content: 'should you stay quiet?',
            id: 'msg_not_silent',
            role: 'user',
        });

        const restoreFactory = setHarnessAgentFactoryForTesting(
            fakeStreamingAgentFactory(fakeTextSegment('txt_1', 'NO_REPLY would be rude here.'))
        );
        try {
            const input = executorInput(
                { model: 'claude-opus-4-8', provider: 'claude' },
                {
                    chatId: 'cht_not_silent',
                    content: 'should you stay quiet?',
                    requestMessageId: 'msg_not_silent',
                    workspaceFolder: mkdtempSync(path.join(os.tmpdir(), 'tavern-exec-test-')),
                }
            );
            upsertResponse('cht_not_silent', {
                id: input.responseId,
                participant_id: 'agt_primary',
                request_message_id: 'msg_not_silent',
                status: 'running',
                summary: 'Working on it.',
            });

            const result = await createHarnessAgentExecutor().execute(input);

            expect(result.outputMessageIds).toHaveLength(1);
            expect(getMessage(result.outputMessageIds[0] ?? '')?.content).toBe(
                'NO_REPLY would be rude here.'
            );
        } finally {
            restoreFactory();
        }
    });

    it('does not replay seen DM rows, but catches up unseen ones', async () => {
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
            content: 'missed dm question',
            id: 'msg_dm_missed',
            role: 'user',
        });
        createPromptMessage('cht_dm', {
            authorId: 'usr_alice',
            content: 'current dm question',
            id: 'msg_dm_current',
            role: 'user',
        });
        // The continuing session has seen the first exchange (seq 1-2); the
        // missed row (seq 3, e.g. its turn failed before the cursor advance)
        // must ride catch-up — DMs get the same window as channels
        // (specs/sessions.md seen ledger).
        advanceSeenCursor({ chatId: 'cht_dm', seq: 2, sessionId: 'ags_agt_primary_1' });

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
        expect(prompt).toContain('Messages in this chat since your last turn:');
        expect(prompt).toContain('missed dm question');
        expect(prompt.match(/current dm question/g)).toHaveLength(1);
    });

    it('anchors each turn with chat identity, roster, and cross-chat pending counts', async () => {
        upsertStoredAgent({
            agent: {
                bio: 'Runs the Amazon Merch business.',
                enabledSkillIds: [],
                id: 'agt_wren',
                isAdmin: false,
                name: 'Wren',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_wren',
            },
        });
        createChat({
            id: 'cht_anchor',
            kind: 'channel',
            participants: [
                { id: 'usr_alice', kind: 'user', label: 'Alice', metadata: {} },
                {
                    id: 'agt_primary',
                    kind: 'agent',
                    label: 'Tavern',
                    metadata: { agentId: 'agt_primary' },
                },
                { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
            ],
            title: 'anchor',
        });
        createChat({
            id: 'cht_elsewhere',
            kind: 'channel',
            participants: [
                { id: 'usr_alice', kind: 'user', label: 'Alice', metadata: {} },
                {
                    id: 'agt_primary',
                    kind: 'agent',
                    label: 'Tavern',
                    metadata: { agentId: 'agt_primary' },
                },
            ],
            title: 'elsewhere',
        });
        createPromptMessage('cht_anchor', {
            authorId: 'usr_alice',
            content: 'anchor ask',
            id: 'msg_anchor',
            role: 'user',
        });
        createPromptMessage('cht_elsewhere', {
            authorId: 'usr_alice',
            content: 'pending elsewhere',
            id: 'msg_elsewhere',
            role: 'user',
        });

        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                { chatId: 'cht_anchor', content: 'anchor ask', requestMessageId: 'msg_anchor' }
            )
        );

        // Chat identity and roster with mention links live in the per-turn
        // prompt under agent-global sessions (specs/sessions.md).
        expect(prompt).toContain('this is the "anchor" channel (chatId: cht_anchor)');
        expect(prompt).toContain('Tavern (you)');
        expect(prompt).toContain(
            '[Wren](agent://agt_wren) (agent) — Runs the Amazon Merch business.'
        );
        // Pending traffic elsewhere appears as counts, never bodies.
        expect(prompt).toContain('Unread elsewhere');
        expect(prompt).toContain(
            '"elsewhere" (chatId: cht_elsewhere): 1 unread, latest from Alice'
        );
        expect(prompt).not.toContain('pending elsewhere');
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

        advanceSeenCursor({ chatId: 'cht_channel', seq: 1, sessionId: 'ags_agt_primary_1' });
        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_channel',
                    content: 'current channel ask',
                    requestMessageId: 'msg_channel_current',
                }
            )
        );

        expect(prompt).toContain('ambient channel note');
        expect(prompt).not.toContain('before cursor');
        expect(prompt).not.toContain('own prior answer');
        expect(prompt.match(/current channel ask/g)).toHaveLength(1);
    });

    it('bounds ambient channel context at the triggering message', async () => {
        // A queued turn answers the chat as of its trigger: messages that
        // land while it waits are not injected — they ride the next turn's
        // ambient window (or their own turn) instead.
        seedPromptChat({ chatId: 'cht_bound', kind: 'channel' });
        createPromptMessage('cht_bound', {
            authorId: 'usr_alice',
            content: 'before trigger note',
            id: 'msg_bound_before',
            role: 'user',
        });
        createPromptMessage('cht_bound', {
            authorId: 'usr_bob',
            content: 'current bounded ask',
            id: 'msg_bound_current',
            role: 'user',
        });
        createPromptMessage('cht_bound', {
            authorId: 'usr_alice',
            content: 'after trigger note',
            id: 'msg_bound_after',
            role: 'user',
        });

        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_bound',
                    content: 'current bounded ask',
                    requestMessageId: 'msg_bound_current',
                }
            )
        );

        expect(prompt).toContain('before trigger note');
        expect(prompt).not.toContain('after trigger note');
        expect(prompt.match(/current bounded ask/g)).toHaveLength(1);
    });

    it('marks the first turn of a rotated session as fresh context', async () => {
        seedPromptChat({ chatId: 'cht_fresh_note', kind: 'channel' });
        createPromptMessage('cht_fresh_note', {
            authorId: 'usr_alice',
            content: 'morning!',
            id: 'msg_fresh_note',
            role: 'user',
        });

        const rotated = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_fresh_note',
                    content: 'morning!',
                    generation: 2,
                    requestMessageId: 'msg_fresh_note',
                    runtimeSessionId: null,
                }
            )
        );
        expect(rotated).toContain('This session just started fresh');

        const resumed = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_fresh_note',
                    content: 'morning!',
                    generation: 2,
                    requestMessageId: 'msg_fresh_note',
                    runtimeSessionId: 'ses_live',
                }
            )
        );
        expect(resumed).not.toContain('This session just started fresh');
    });

    it('anchors the prompt in time with a current-time line and per-message timestamps', async () => {
        setHomeTimezone('UTC');
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

        expect(prompt).toMatch(
            /- current time: [A-Z][a-z]{2} \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00/
        );
        expect(prompt).toContain(
            `${formatLocalTimestampWithWeekday(new Date(current.message.created_at), 'UTC')}] Bob: current ask`
        );
        expect(prompt).toMatch(/\w{3} \d{4}-\d{2}-\d{2}T[^\]]+\] Alice: ambient note/);
    });

    it('renders prompt timestamps in the configured home timezone', async () => {
        setHomeTimezone('America/New_York');
        seedPromptChat({ chatId: 'cht_home_tz', kind: 'channel' });
        const current = createPromptMessage('cht_home_tz', {
            authorId: 'usr_bob',
            content: 'current ask',
            id: 'msg_home_tz_current',
            role: 'user',
        });

        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_home_tz',
                    content: 'current ask',
                    requestMessageId: 'msg_home_tz_current',
                }
            )
        );

        expect(prompt).toContain(
            `${formatLocalTimestampWithWeekday(
                new Date(current.message.created_at),
                'America/New_York'
            )}] Bob: current ask`
        );
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

        advanceSeenCursor({ chatId: 'cht_reply', seq: 2, sessionId: 'ags_agt_primary_1' });
        const prompt = await harnessPrompt(
            executorInput(
                { model: 'gpt-4.1-mini', provider: 'openai' },
                {
                    chatId: 'cht_reply',
                    content: 'current follow-up',
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
        generation?: number;
        runtimeSessionId?: null | string;
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
        agentParticipantId: 'agt_primary',
        agentSession: {
            agentId: 'agt_primary',
            archivedAt: null,
            createdAt: now,
            effectiveModel: model,
            generation: input.generation ?? 1,
            id: 'ags_agt_primary_1',
            lastTurnAt: null,
            resumeState: null,
            runtimeSessionId: input.runtimeSessionId ?? null,
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

function fakeStreamingAgentFactory(parts: Iterable<unknown>) {
    const fakeAgent = {
        createSession: () =>
            Promise.resolve({
                destroy: () => Promise.resolve(),
                sessionId: 'ses_fake',
                stop: () => Promise.resolve({}),
            }),
        stream: () => Promise.resolve({ fullStream: parts, text: Promise.resolve('') }),
    };
    return (() => fakeAgent) as unknown as Parameters<typeof setHarnessAgentFactoryForTesting>[0];
}

function setHomeTimezone(timezone: string) {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ('runtime:timezone', $value, $now)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run(namedParams({ now: new Date().toISOString(), value: JSON.stringify({ timezone }) }));
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
