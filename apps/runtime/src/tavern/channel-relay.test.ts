import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';

interface MockHermesEvent {
    data: Record<string, unknown>;
    event: string;
}

const hermesClient = vi.hoisted(() => ({
    close: vi.fn(),
    streamChat: vi.fn(async function* streamChat(): AsyncGenerator<MockHermesEvent> {
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

import { sendTavernChannelMessage } from './channel-relay';
import { createChat, getChat, listMessages, listResponses } from './chat-api';

describe('Tavern Hermes channel relay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
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
        expect(hermesClient.streamChat).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'hello',
                sessionKey: 'session_1',
                title: 'cht_1',
            })
        );
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
