import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';

interface MockHermesEvent {
    data: Record<string, unknown>;
    event: string;
}

interface MockStreamChatInput {
    content?: string;
    onLiveSessionId?: (sessionId: string) => void;
    signal?: AbortSignal;
}

const hermesClient = vi.hoisted(() => ({
    close: vi.fn(),
    interruptLiveSession: vi.fn(async () => undefined),
    respondToLiveClarification: vi.fn(async () => ({ resolved: true })),
    steerLiveSession: vi.fn(async () => ({ steered: true })),
    streamChat: vi.fn(async function* streamChat(
        _input?: MockStreamChatInput
    ): AsyncGenerator<MockHermesEvent> {
        yield {
            data: {
                model: 'tavern-e2e-tools',
                provider: 'custom',
                usage: { completion_tokens: 8, prompt_tokens: 16, total_tokens: 24 },
            },
            event: 'session.info',
        };
        yield {
            data: { delta: 'hello back' },
            event: 'assistant.delta',
        };
        yield {
            data: { content: 'hello back', message_id: 'hermes_msg_1' },
            event: 'assistant.completed',
        };
    }),
}));

vi.mock('../hermes/local-client', () => ({
    createLocalHermesClient: () => hermesClient,
}));

import {
    sendTavernChannelMessage,
    steerTavernChannelTurn,
    stopTavernChannelTurn,
} from './channel-relay';
import { createChat, getChat, listMessages, listResponses } from './chat-api';
import { closeHermesTurnClients, respondToHermesClarification } from './hermes-turn-runner';
import { subscribeToRuntimeEvents } from './runtime-events';

describe('Tavern Hermes channel relay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeHermesTurnClients();
        closeDb();
    });

    it('creates the Tavern user message before starting a Hermes turn', async () => {
        createChat({ id: 'cht_1' });

        const accepted = await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello',
                id: 'msg_1',
                nonce: 'nonce_1',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(accepted).toMatchObject({
            cursor: 1,
            messageId: 'msg_1',
            sequence: 1,
            status: 'accepted',
        });
        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual(['msg_1']);
        await waitForHermesTurn();
        expect(hermesClient.streamChat).toHaveBeenCalledWith({
            attachments: [],
            content: 'hello',
            modelRef: undefined,
            onLiveSessionId: expect.any(Function),
            sessionKey: 'session_1',
            signal: expect.any(AbortSignal),
            title: 'cht_1',
        });
    });

    it('projects skill mentions into the Hermes prompt without changing the Tavern message', async () => {
        const skillDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-mention-'));
        const skillPath = path.join(skillDir, 'SKILL.md');
        await fs.writeFile(skillPath, '# BidBeacon\n\nUse `bb metrics table` for spend.\n');
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: `Can you see [$bidbeacon](${skillPath}) spend?`,
                id: 'msg_skill',
                metadata: {
                    tavern: {
                        mentions: [
                            {
                                end: `Can you see [$bidbeacon](${skillPath})`.length,
                                id: skillPath,
                                kind: 'skill',
                                label: 'BidBeacon',
                                metadata: { skillName: 'bidbeacon' },
                                projection: 'skill-context',
                                start: 'Can you see '.length,
                                text: `[$bidbeacon](${skillPath})`,
                            },
                        ],
                    },
                },
                nonce: 'nonce_skill',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        const streamInput = hermesClient.streamChat.mock.calls.at(-1)?.[0];
        expect(streamInput?.content).toContain('<skill_context>');
        expect(streamInput?.content).toContain('Use `bb metrics table` for spend.');
        expect(streamInput?.content).toContain(`Can you see [$bidbeacon](${skillPath}) spend?`);
        expect(listMessages('cht_1').messages[0]?.content).toBe(
            `Can you see [$bidbeacon](${skillPath}) spend?`
        );

        await fs.rm(skillDir, { force: true, recursive: true });
    });

    it('stops a queued Hermes turn before it has a live session id', async () => {
        const releaseFirstTurn = deferred<void>();
        const secondSignal: { current: AbortSignal | null } = { current: null };
        hermesClient.streamChat
            .mockImplementationOnce(async function* streamChat() {
                await releaseFirstTurn.promise;
                yield {
                    data: { content: 'first done', message_id: 'hermes_msg_first' },
                    event: 'assistant.completed',
                };
            })
            .mockImplementationOnce(async function* streamChat(input?: { signal?: AbortSignal }) {
                secondSignal.current = input?.signal ?? null;
                await new Promise<never>((_resolve, reject) => {
                    input?.signal?.addEventListener(
                        'abort',
                        () => reject(new Error('Hermes turn cancelled.')),
                        { once: true }
                    );
                });
            });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'first',
                id: 'msg_first',
                nonce: 'nonce_first',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        const queued = await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'second',
                id: 'msg_second',
                nonce: 'nonce_second',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        await expect(stopTavernChannelTurn({ runId: queued.runId })).resolves.toEqual({
            runId: queued.runId,
            stopped: true,
        });
        const stoppedSignal = secondSignal.current;
        if (!stoppedSignal) {
            throw new Error('Queued turn did not receive an abort signal.');
        }
        expect(stoppedSignal.aborted).toBe(true);

        releaseFirstTurn.resolve();
        await waitForHermesTurn();
        expect(listResponses('cht_1').responses).toMatchObject([
            {
                request_message_id: 'msg_first',
                status: 'completed',
            },
            {
                request_message_id: 'msg_second',
                status: 'cancelled',
            },
        ]);
    });

    it('cancels a live Hermes turn without delivering interrupted output', async () => {
        const liveStarted = deferred<void>();
        const releaseInterruptedCompletion = deferred<void>();
        const liveSignal: { current: AbortSignal | null } = { current: null };
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat(input?: {
            onLiveSessionId?: (sessionId: string) => void;
            signal?: AbortSignal;
        }) {
            liveSignal.current = input?.signal ?? null;
            input?.onLiveSessionId?.('live_session_1');
            liveStarted.resolve();
            yield {
                data: { delta: 'writing a poem' },
                event: 'assistant.delta',
            };
            await releaseInterruptedCompletion.promise;
            yield {
                data: { delta: 'late poem text' },
                event: 'assistant.delta',
            };
            yield {
                data: {
                    content: 'Operation interrupted, but here is the poem.',
                    message_id: 'hermes_msg_interrupted',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        const accepted = await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'write me a poem',
                id: 'msg_poem',
                nonce: 'nonce_poem',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await liveStarted.promise;

        await expect(stopTavernChannelTurn({ runId: accepted.runId })).resolves.toEqual({
            runId: accepted.runId,
            stopped: true,
        });
        expect(hermesClient.interruptLiveSession).toHaveBeenCalledWith('live_session_1');
        expect(liveSignal.current?.aborted).toBe(false);
        expect(listResponses('cht_1').responses).toMatchObject([
            {
                request_message_id: 'msg_poem',
                status: 'running',
            },
        ]);

        releaseInterruptedCompletion.resolve();
        await waitFor(() => listResponses('cht_1').responses.at(0)?.status === 'cancelled');

        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual(['msg_poem']);
        expect(listResponses('cht_1').responses).toMatchObject([
            {
                request_message_id: 'msg_poem',
                response_message_id: null,
                status: 'cancelled',
                summary: 'Agent response stopped.',
            },
        ]);
    });

    it('steers a live Hermes turn without creating a queued Tavern message', async () => {
        const releaseTurn = deferred<void>();
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat(
            input?: MockStreamChatInput
        ) {
            input?.onLiveSessionId?.('live_session_1');
            await releaseTurn.promise;
            yield {
                data: { content: 'steered result', message_id: 'hermes_msg_steered' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        const accepted = await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'first',
                id: 'msg_first',
                nonce: 'nonce_first',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitFor(() => hermesClient.streamChat.mock.calls.length === 1);

        await expect(
            steerTavernChannelTurn('cht_1', {
                content: 'tighten the plan',
                runId: accepted.runId,
            })
        ).resolves.toEqual({
            runId: accepted.runId,
            steered: true,
        });
        expect(hermesClient.steerLiveSession).toHaveBeenCalledWith(
            'live_session_1',
            'tighten the plan'
        );
        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual(['msg_first']);
        expect(listResponses('cht_1').activity).toMatchObject([
            {
                detail: 'tighten the plan',
                id: `act_${accepted.runId}_runtime_notice_steered`,
                kind: 'custom',
                metadata: {
                    runtime: {
                        messageId: 'msg_first',
                        notice: {
                            detail: 'tighten the plan',
                            kind: 'status',
                            text: 'Steered active turn: tighten the plan',
                            title: 'Steered active turn',
                        },
                        runId: accepted.runId,
                        sessionKey: 'session_1',
                        source: 'hermes',
                    },
                },
                response_id: `rsp_${accepted.runId}`,
                status: 'completed',
                title: 'Steered active turn',
            },
        ]);

        releaseTurn.resolve();
        await waitForHermesTurn();
    });

    it('does not steer a run for another chat', async () => {
        const releaseTurn = deferred<void>();
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat(
            input?: MockStreamChatInput
        ) {
            input?.onLiveSessionId?.('live_session_1');
            await releaseTurn.promise;
            yield {
                data: { content: 'done', message_id: 'hermes_msg_done' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        const accepted = await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'first',
                id: 'msg_first',
                nonce: 'nonce_first',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitFor(() => hermesClient.streamChat.mock.calls.length === 1);

        await expect(
            steerTavernChannelTurn('cht_other', {
                content: 'wrong chat',
                runId: accepted.runId,
            })
        ).resolves.toEqual({
            runId: accepted.runId,
            steered: false,
        });
        expect(hermesClient.steerLiveSession).not.toHaveBeenCalled();

        releaseTurn.resolve();
        await waitForHermesTurn();
    });

    it('delivers the completed Hermes assistant message into Tavern history', async () => {
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello while offline',
                id: 'msg_offline',
                nonce: 'nonce_offline',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual([
            'msg_offline',
            'msg_hermes_msg_1',
        ]);
        expect(listMessages('cht_1').messages.at(-1)?.metadata).toMatchObject({
            hermesModel: 'tavern-e2e-tools',
            hermesProvider: 'custom',
            model: 'tavern-e2e-tools',
            provider: 'custom',
            usage: {
                input: 16,
                output: 8,
                total: 24,
            },
        });
        expect(listResponses('cht_1').responses).toMatchObject([
            {
                request_message_id: 'msg_offline',
                response_message_id: 'msg_hermes_msg_1',
                status: 'completed',
            },
        ]);
        expect(hermesClient.close).not.toHaveBeenCalled();
    });

    it('stores the raw Hermes provider in Tavern message metadata', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: {
                    model: 'gpt-5.5-codex',
                    provider: 'openai-codex',
                    usage: { completion_tokens: 2, prompt_tokens: 4, total_tokens: 6 },
                },
                event: 'session.info',
            };
            yield {
                data: { delta: 'codex reply' },
                event: 'assistant.delta',
            };
            yield {
                data: { content: 'codex reply', message_id: 'hermes_msg_codex' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello with codex',
                id: 'msg_codex',
                nonce: 'nonce_codex',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.metadata).toMatchObject({
            hermesModel: 'gpt-5.5-codex',
            hermesProvider: 'openai-codex',
            model: 'gpt-5.5-codex',
            provider: 'openai-codex',
        });
    });

    it('stores streamed assistant preamble as visible message activity when tool work starts', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: { delta: 'I will inspect the adapter events first.' },
                event: 'assistant.delta',
            };
            yield {
                data: {
                    arguments: { cmd: 'rg message.delta apps/runtime/src' },
                    preview: 'rg message.delta apps/runtime/src',
                    tool_call_id: 'tool_1',
                    tool_name: 'shell',
                },
                event: 'tool.started',
            };
            yield {
                data: { content: 'done', message_id: 'hermes_msg_preamble' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'show preamble',
                id: 'msg_preamble',
                nonce: 'nonce_preamble',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('done');
        expect(listResponses('cht_1').activity).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    detail: 'I will inspect the adapter events first.',
                    kind: 'message',
                    status: 'completed',
                    title: 'Assistant update',
                }),
                expect.objectContaining({
                    detail: 'rg message.delta apps/runtime/src',
                    kind: 'tool_call',
                    status: 'completed',
                    title: 'shell',
                }),
            ])
        );
    });

    it('does not store Hermes reasoning.available as model Thinking', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: { text: 'final answer' },
                event: 'reasoning.available',
            };
            yield {
                data: {
                    content: 'final answer',
                    message_id: 'hermes_msg_reasoning_available',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'avoid false thinking',
                id: 'msg_reasoning_available',
                nonce: 'nonce_reasoning_available',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('final answer');
        expect(listResponses('cht_1').activity).toEqual([]);
    });

    it('publishes thinking.status as live turn status without storing Thinking activity', async () => {
        const runtimeEvents: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => runtimeEvents.push(event));
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: {},
                event: 'thinking.status',
            };
            yield {
                data: {},
                event: 'thinking.status',
            };
            yield {
                data: { content: 'done', message_id: 'hermes_msg_thinking_status' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'show live status',
                id: 'msg_thinking_status',
                nonce: 'nonce_thinking_status',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();
        unsubscribe();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('done');
        expect(listResponses('cht_1').activity).toEqual([]);
        expect(runtimeEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sequence: 1,
                    type: 'turn.statusUpdated',
                }),
                expect.objectContaining({
                    sequence: 2,
                    type: 'turn.statusUpdated',
                }),
            ])
        );
    });

    it('stores reasoning.delta as Tavern Thinking activity', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: { delta: 'checking hidden chain' },
                event: 'reasoning.delta',
            };
            yield {
                data: { content: 'done', message_id: 'hermes_msg_reasoning' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'show reasoning',
                id: 'msg_reasoning',
                nonce: 'nonce_reasoning',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('done');
        expect(listResponses('cht_1').activity).toMatchObject([
            {
                detail: 'checking hidden chain',
                kind: 'reasoning',
                status: 'completed',
                title: 'Thinking',
            },
        ]);
    });

    it('stores message.complete reasoning fallback without duplicating final replies', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: {
                    content: 'final answer',
                    message_id: 'hermes_msg_reasoning_fallback',
                    reasoning: 'final answer',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'avoid duplicate reasoning',
                id: 'msg_reasoning_duplicate',
                nonce: 'nonce_reasoning_duplicate',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('final answer');
        expect(listResponses('cht_1').activity).toEqual([]);
    });

    it('does not store stripped final reply text as message.complete reasoning', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: { delta: 'Planning\n\n' },
                event: 'assistant.delta',
            };
            yield {
                data: { delta: 'Searching docs' },
                event: 'assistant.status',
            };
            yield {
                data: {
                    content: 'Planning\n\nfinal answer',
                    message_id: 'hermes_msg_reasoning_stripped',
                    reasoning: 'final answer',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'avoid stripped duplicate reasoning',
                id: 'msg_reasoning_stripped',
                nonce: 'nonce_reasoning_stripped',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('final answer');
        expect(
            listResponses('cht_1').activity.filter((activity) => activity.kind === 'reasoning')
        ).toEqual([]);
    });

    it('delivers a reply the gateway also echoes through the thinking channel', async () => {
        // Trivial turns stream the reply, then mirror the same text through
        // thinking.delta right before message.complete. The echo must not
        // start a Thinking row or move the reply into the work log — doing
        // so made the completion dedup strip the delivered reply to empty.
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield { data: {}, event: 'assistant.composing' };
            yield {
                data: { delta: '(o_o) processing...' },
                event: 'reasoning.delta',
            };
            yield {
                data: { delta: 'Hey! What can I help you with?' },
                event: 'assistant.delta',
            };
            yield {
                data: { delta: 'Hey! What can I help you with?' },
                event: 'reasoning.delta',
            };
            yield {
                data: {
                    content: 'Hey! What can I help you with?',
                    message_id: 'hermes_msg_echo',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hey',
                id: 'msg_echo',
                nonce: 'nonce_echo',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listResponses('cht_1').responses).toMatchObject([{ status: 'completed' }]);
        expect(listMessages('cht_1').messages.at(-1)?.content).toBe(
            'Hey! What can I help you with?'
        );

        const activity = listResponses('cht_1').activity;
        expect(activity.filter((entry) => entry.kind === 'message')).toEqual([]);
        expect(
            activity.flatMap((entry) => (entry.kind === 'reasoning' ? [entry.detail] : []))
        ).toEqual(['(o_o) processing...']);
    });

    it('preserves clarification answer metadata when the gateway stream resumes first', async () => {
        const responseStarted = deferred<void>();
        const allowResponseToResolve = deferred<void>();
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat(input?: {
            onLiveSessionId?: (sessionId: string) => void;
        }) {
            input?.onLiveSessionId?.('live_session_1');
            yield {
                data: {
                    choices: ['Berlin', 'Munich'],
                    question: 'Which city?',
                    request_id: 'clarify_1',
                },
                event: 'clarification.requested',
            };
            await responseStarted.promise;
            yield { data: { delta: 'Berlin is mild.' }, event: 'assistant.delta' };
            yield {
                data: {
                    content: 'Berlin is mild.',
                    message_id: 'hermes_msg_clarify',
                },
                event: 'assistant.completed',
            };
        });
        hermesClient.respondToLiveClarification.mockImplementationOnce(async () => {
            responseStarted.resolve();
            await allowResponseToResolve.promise;
            return { resolved: true };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'weather',
                id: 'msg_clarify',
                nonce: 'nonce_clarify',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitFor(() =>
            listResponses('cht_1').activity.some(
                (activity) => activity.metadata.event === 'clarify.request'
            )
        );

        const response = respondToHermesClarification({
            answer: 'Berlin',
            disposition: 'answered',
            requestId: 'clarify_1',
            sessionKey: 'session_1',
        });
        await responseStarted.promise;
        await waitFor(() =>
            listResponses('cht_1').activity.some((activity) => {
                const clarification = readRecord(activity.metadata.clarification);
                return (
                    activity.metadata.event === 'clarify.answered' &&
                    clarification.answer === 'Berlin'
                );
            })
        );

        allowResponseToResolve.resolve();
        await response;
        expect(listResponses('cht_1').activity).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'custom',
                    metadata: expect.objectContaining({
                        clarification: expect.objectContaining({
                            answer: 'Berlin',
                            disposition: 'answered',
                        }),
                        event: 'clarify.answered',
                    }),
                    status: 'completed',
                    title: 'Clarification',
                }),
            ])
        );
    });

    it('does not duplicate completed streamed reasoning with final aggregate reasoning', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: { delta: 'checked Hermes events' },
                event: 'reasoning.delta',
            };
            yield {
                data: { delta: 'Reading runtime projection' },
                event: 'assistant.status',
            };
            yield {
                data: { delta: 'confirmed Tavern activity mapping' },
                event: 'reasoning.delta',
            };
            yield {
                data: {
                    content: 'final answer',
                    message_id: 'hermes_msg_reasoning_aggregate',
                    reasoning: 'checked Hermes events confirmed Tavern activity mapping',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'avoid aggregate duplicate reasoning',
                id: 'msg_reasoning_aggregate',
                nonce: 'nonce_reasoning_aggregate',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('final answer');
        expect(
            listResponses('cht_1')
                .activity.filter((activity) => activity.kind === 'reasoning')
                .map((activity) => activity.detail)
        ).toEqual(['checked Hermes events', 'confirmed Tavern activity mapping']);
    });

    it('stores distinct message.complete reasoning fallback as Tavern Thinking activity', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: {
                    content: 'final answer',
                    message_id: 'hermes_msg_reasoning_fallback',
                    reasoning: 'checked the active Gateway event names',
                },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'persist final reasoning',
                id: 'msg_reasoning_fallback',
                nonce: 'nonce_reasoning_fallback',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('final answer');
        expect(listResponses('cht_1').activity).toMatchObject([
            {
                detail: 'checked the active Gateway event names',
                kind: 'reasoning',
                status: 'completed',
                title: 'Thinking',
            },
        ]);
    });

    it('records Hermes process statuses as response activity', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: {
                    delta: 'Background process finished.',
                    kind: 'process',
                    source_event: 'status.update',
                },
                event: 'assistant.status',
            };
            yield {
                data: { content: 'clean reply', message_id: 'hermes_msg_clean' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello with process status',
                id: 'msg_process_status',
                nonce: 'nonce_process_status',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        expect(listResponses('cht_1').activity).toMatchObject([
            {
                detail: 'Background process finished.',
                kind: 'message',
                metadata: {
                    event: 'status.update',
                    statusKind: 'process',
                },
                title: 'Assistant update',
            },
        ]);
    });

    it('drops Hermes lifecycle notices from response activity', async () => {
        hermesClient.streamChat.mockImplementationOnce(async function* streamChat() {
            yield {
                data: {
                    delta: 'Codex gpt-5.5 caps context at 272K, so auto-compaction was raised to 85% (from 50%) to use more of the window before summarizing.\nOpt back out: hermes config set compression.codex_gpt55_autoraise false',
                    kind: 'lifecycle',
                    source_event: 'status.update',
                },
                event: 'assistant.status',
            };
            yield {
                data: { delta: 'clean reply' },
                event: 'assistant.delta',
            };
            yield {
                data: { content: 'clean reply', message_id: 'hermes_msg_clean' },
                event: 'assistant.completed',
            };
        });
        createChat({ id: 'cht_1' });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'agt_1',
            },
            message: {
                content: 'hello with notice',
                id: 'msg_notice',
                nonce: 'nonce_notice',
            },
            target: {
                externalId: null,
                sessionKey: 'session_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });
        await waitForHermesTurn();

        const responses = listResponses('cht_1');
        expect(responses.activity).toEqual([]);
        expect(listMessages('cht_1').messages.at(-1)?.content).toBe('clean reply');
    });

    it('requires Tavern Runtime to own the chat before relaying', async () => {
        await expect(
            sendTavernChannelMessage('cht_missing', {
                agent: {
                    agentId: 'agt_1',
                },
                message: {
                    content: 'hello',
                    id: 'msg_1',
                    nonce: 'nonce_1',
                },
                target: {
                    externalId: null,
                    sessionKey: 'session_1',
                    target: 'cht_missing',
                    type: 'tavern',
                },
            })
        ).rejects.toThrow('Chat cht_missing does not exist.');
    });

    it('preserves Tavern-owned chat metadata when relaying a message', async () => {
        createChat({
            id: 'cht_1',
            metadata: {
                runtime: {
                    source: 'tavern',
                },
                sessionKeys: ['agent:main:tavern:channel:cht_1'],
                tavern: {
                    agentIds: ['main'],
                    archived: false,
                    displayName: 'Planning',
                },
            },
            title: 'Planning',
        });

        await sendTavernChannelMessage('cht_1', {
            agent: {
                agentId: 'main',
            },
            message: {
                content: 'hello',
                id: 'msg_1',
                nonce: 'nonce_1',
            },
            target: {
                externalId: null,
                sessionKey: 'agent:main:tavern:channel:cht_1',
                target: 'cht_1',
                type: 'tavern',
            },
        });

        expect(getChat('cht_1')?.metadata).toEqual({
            runtime: {
                source: 'tavern',
            },
            sessionKeys: ['agent:main:tavern:channel:cht_1'],
            tavern: {
                agentIds: ['main'],
                archived: false,
                displayName: 'Planning',
            },
        });
    });
});

async function waitForHermesTurn() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(predicate: () => boolean) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    throw new Error('Timed out waiting for expected test state.');
}

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, reject, resolve };
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}
