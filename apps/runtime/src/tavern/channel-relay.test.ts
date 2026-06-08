import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';

const hermesClient = vi.hoisted(() => ({
    close: vi.fn(),
    streamChat: vi.fn(async function* streamChat() {
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
        expect(hermesClient.streamChat).toHaveBeenCalledWith({
            content: 'hello',
            sessionKey: 'session_1',
            title: 'cht_1',
        });
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
