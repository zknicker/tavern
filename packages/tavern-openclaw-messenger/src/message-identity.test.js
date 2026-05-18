import { describe, expect, test } from 'bun:test';
import {
    applyActiveTavernMessageIdentity,
    registerActiveTavernTurn,
    registerTavernMessageIdentityHook,
} from './message-identity.js';

describe('Tavern message identity hook', () => {
    test('registers the OpenClaw before-message-write hook', () => {
        const calls = [];

        registerTavernMessageIdentityHook({
            on: (...args) => calls.push(args),
        });

        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toBe('before_message_write');
        expect(typeof calls[0][1]).toBe('function');
        expect(calls[0][2]).toMatchObject({ priority: 100 });
    });

    test('requires OpenClaw typed hook registration', () => {
        expect(() => registerTavernMessageIdentityHook({})).toThrow(
            'Tavern Messenger requires OpenClaw typed plugin hooks.'
        );
    });

    test('projects active accepted Tavern identity onto OpenClaw user transcript writes', () => {
        const unregister = registerActiveTavernTurn({
            agentId: 'main',
            chatId: 'cht_1',
            messageId: 'msg_1',
            nonce: 'nonce-1',
            sequence: 7,
            sentAt: '2026-05-16T12:00:00.000Z',
            sender: {
                id: 'usr_1',
                name: 'Tavern User',
            },
            sessionKey: 'OpenClaw:Tavern:Session:1',
            text: 'hello',
            turnId: 'run_1',
        });

        try {
            const result = applyActiveTavernMessageIdentity(
                {
                    message: {
                        content: [{ text: 'hello', type: 'text' }],
                        role: 'user',
                    },
                },
                { sessionKey: 'openclaw:tavern:session:1' }
            );

            expect(result?.message).toMatchObject({
                id: 'msg_1',
                messageId: 'msg_1',
                nonce: 'nonce-1',
                sequence: 7,
                senderId: 'usr_1',
                senderName: 'Tavern User',
                sessionKey: 'OpenClaw:Tavern:Session:1',
                metadata: {
                    tavern: {
                        acceptedMessageId: 'msg_1',
                        acceptedRunId: 'run_1',
                        chatId: 'cht_1',
                        nonce: 'nonce-1',
                        sequence: 7,
                        sessionKey: 'OpenClaw:Tavern:Session:1',
                    },
                },
            });
        } finally {
            unregister();
        }
    });

    test('uses the single active Tavern turn when OpenClaw omits session key context', () => {
        const unregister = registerActiveTavernTurn({
            agentId: 'main',
            chatId: 'cht_1',
            messageId: 'msg_1',
            nonce: 'nonce-1',
            sequence: 7,
            sentAt: '2026-05-16T12:00:00.000Z',
            sender: {
                id: 'usr_1',
                name: 'Tavern User',
            },
            sessionKey: 'session-1',
            text: 'hello',
            turnId: 'run_1',
        });

        try {
            const result = applyActiveTavernMessageIdentity({
                message: {
                    content: [
                        {
                            text: '[Sat 2026-05-16 08:00 EDT] hello',
                            type: 'text',
                        },
                    ],
                    role: 'user',
                },
            });

            expect(result?.message).toMatchObject({
                id: 'msg_1',
                messageId: 'msg_1',
                metadata: {
                    tavern: {
                        acceptedMessageId: 'msg_1',
                    },
                },
                nonce: 'nonce-1',
                sequence: 7,
            });
        } finally {
            unregister();
        }
    });

    test('does not rewrite transcript messages that already have durable identity', () => {
        const unregister = registerActiveTavernTurn({
            agentId: 'main',
            chatId: 'cht_1',
            messageId: 'msg_1',
            sender: {
                id: 'usr_1',
                name: 'Tavern User',
            },
            sessionKey: 'session-1',
            text: 'hello',
        });

        try {
            const result = applyActiveTavernMessageIdentity(
                {
                    message: {
                        id: 'msg_1',
                        messageId: 'msg_1',
                        metadata: {
                            tavern: {
                                acceptedMessageId: 'msg_1',
                            },
                        },
                        role: 'user',
                    },
                },
                { sessionKey: 'session-1' }
            );

            expect(result).toBeUndefined();
        } finally {
            unregister();
        }
    });
});
