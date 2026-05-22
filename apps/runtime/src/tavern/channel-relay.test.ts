import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { attachTavernChannelSocket, sendTavernChannelMessage } from './channel-relay';
import { listPendingTavernInboundMessages } from './channel-store';
import { listMessages } from './chat-api';

describe('Tavern channel relay', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('creates the OpenAPI chat message before relaying to the plugin', async () => {
        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        const accepted = sendTavernChannelMessage('cht_1', {
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

        const [frame] = socket.sent;
        expect(frame?.kind).toBe('inbound-message');
        expect(frame?.message.id).toBe('msg_1');
        expect(frame?.message.sequence).toBe(1);
        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual(['msg_1']);

        socket.emitMessage({
            accepted: {
                acceptedAt: '2026-05-18T12:00:00.000Z',
                runId: frame?.turnId ?? 'run_1',
                sessionKey: 'session_1',
                status: 'accepted',
            },
            kind: 'message-accepted',
            requestId: frame?.requestId ?? '',
        });

        await expect(accepted).resolves.toMatchObject({
            messageId: 'msg_1',
            sequence: 1,
            status: 'accepted',
        });

        socket.close();
    });

    it('returns the durable accepted receipt when the plugin socket is offline', async () => {
        const accepted = await sendTavernChannelMessage('cht_1', {
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

        expect(accepted).toMatchObject({
            messageId: 'msg_offline',
            sequence: 1,
            status: 'accepted',
        });
        expect(listMessages('cht_1').messages.map((message) => message.id)).toEqual([
            'msg_offline',
        ]);
        expect(listPendingTavernInboundMessages()).toHaveLength(1);

        const socket = createRelaySocket();
        attachTavernChannelSocket(socket.value);

        expect(socket.sent).toHaveLength(1);
        expect(socket.sent[0]?.message.id).toBe('msg_offline');

        socket.close();
    });
});

function createRelaySocket() {
    const handlers = new Map<string, (data?: unknown) => void>();
    const sent: Array<{
        kind: 'inbound-message';
        message: {
            id: string;
            sequence?: number;
        };
        requestId: string;
        turnId?: string;
    }> = [];
    const value = {
        on(event: string, handler: (data?: unknown) => void) {
            handlers.set(event, handler);
        },
        readyState: 1,
        send(data: string, callback?: (error?: Error) => void) {
            sent.push(JSON.parse(data));
            callback?.();
        },
    };

    return {
        close() {
            handlers.get('close')?.();
        },
        emitMessage(payload: unknown) {
            handlers.get('message')?.(JSON.stringify(payload));
        },
        sent,
        value: value as never,
    };
}
