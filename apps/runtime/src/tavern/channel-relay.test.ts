import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';

interface MockHermesEvent {
    data: Record<string, unknown>;
    event: string;
}

const hermesClient = vi.hoisted(() => ({
    close: vi.fn(),
    streamChat: vi.fn(async function* streamChat(_input?: {
        signal?: AbortSignal;
    }): AsyncGenerator<MockHermesEvent> {
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

import { sendTavernChannelMessage, stopTavernChannelTurn } from './channel-relay';
import { createChat, getChat, listMessages, listResponses } from './chat-api';
import { closeHermesTurnClients } from './hermes-turn-runner';

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
        expect(hermesClient.streamChat).toHaveBeenCalledWith({
            attachments: [],
            content: 'hello',
            modelRef: undefined,
            onLiveSessionId: expect.any(Function),
            sessionKey: 'session_1',
            signal: expect.any(AbortSignal),
            title: 'cht_1',
        });
        await waitForHermesTurn();
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
                status: 'failed',
            },
        ]);
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
                data: { content: 'final answer', message_id: 'hermes_msg_reasoning_available' },
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
            yield { data: { delta: '(o_o) processing...' }, event: 'reasoning.delta' };
            yield { data: { delta: 'Hey! What can I help you with?' }, event: 'assistant.delta' };
            yield { data: { delta: 'Hey! What can I help you with?' }, event: 'reasoning.delta' };
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

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, reject, resolve };
}
