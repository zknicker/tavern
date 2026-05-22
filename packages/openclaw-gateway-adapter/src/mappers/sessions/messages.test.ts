import { describe, expect, it } from 'bun:test';
import { mapOpenClawSessionMessages } from './messages.ts';

describe('OpenClaw session message mapping', () => {
    it('flattens assistant text parts into message content', () => {
        const mapped = mapOpenClawSessionMessages({
            messages: {
                messages: [
                    {
                        __openclaw: {
                            id: 'message-1',
                            seq: 1,
                        },
                        api: 'openai-responses',
                        content: [
                            {
                                text: 'Affirmative, Blippy operational.',
                                type: 'text',
                            },
                        ],
                        model: 'gpt-5.5',
                        provider: 'openai',
                        role: 'assistant',
                        timestamp: 1_777_754_727_254,
                    },
                ],
            },
            sessionKey: 'agent:blippy:main',
        });

        expect(mapped.messages[0]).toMatchObject({
            content: 'Affirmative, Blippy operational.',
            id: 'message-1',
            metadata: {
                api: 'openai-responses',
                stopReason: undefined,
            },
            senderType: 'agent',
        });
    });

    it('maps inline and file reference attachments', () => {
        const mapped = mapOpenClawSessionMessages({
            messages: [
                {
                    attachments: [
                        {
                            content: 'aW1hZ2U=',
                            mimeType: 'image/png',
                            name: 'image.png',
                            sizeBytes: 5,
                        },
                        {
                            mimeType: 'video/quicktime',
                            name: 'capture.mov',
                            reference: {
                                path: '/workspace/capture.mov',
                                uri: 'file:///workspace/capture.mov',
                            },
                            sizeBytes: 8000,
                        },
                    ],
                    id: 'message-1',
                    role: 'user',
                    timestamp: '2026-05-02T20:00:00.000Z',
                },
            ],
            sessionKey: 'agent:blippy:main',
        });

        expect(mapped.messages[0]?.attachments).toEqual([
            {
                dataBase64: 'aW1hZ2U=',
                filename: 'image.png',
                mediaType: 'image/png',
                sizeBytes: 5,
                type: 'inline',
            },
            {
                filename: 'capture.mov',
                mediaType: 'video/quicktime',
                path: '/workspace/capture.mov',
                sizeBytes: 8000,
                type: 'file',
                uri: 'file:///workspace/capture.mov',
            },
        ]);
    });

    it('preserves Tavern-owned message metadata', () => {
        const mapped = mapOpenClawSessionMessages({
            messages: [
                {
                    content: 'use Chrome',
                    id: 'message-1',
                    metadata: {
                        tavern: {
                            mentions: [
                                {
                                    end: 10,
                                    id: 'chrome',
                                    kind: 'skill',
                                    label: 'Chrome',
                                    projection: 'skill-context',
                                    start: 4,
                                    text: 'Chrome',
                                },
                            ],
                        },
                    },
                    role: 'user',
                    timestamp: '2026-05-02T20:00:00.000Z',
                },
            ],
            sessionKey: 'agent:blippy:main',
        });

        expect(mapped.messages[0]?.metadata?.tavern).toEqual({
            mentions: [
                {
                    end: 10,
                    id: 'chrome',
                    kind: 'skill',
                    label: 'Chrome',
                    projection: 'skill-context',
                    start: 4,
                    text: 'Chrome',
                },
            ],
        });
    });

    it('maps accepted Tavern inbound messages by the durable Tavern message id', () => {
        const sessionKey = 'agent:main:tavern:channel:cht_1';
        const mapped = mapOpenClawSessionMessages({
            messages: [
                {
                    __openclaw: {
                        id: 'transcript-wrapper-id',
                    },
                    chatId: 'cht_1',
                    content: [{ text: 'hi', type: 'text' }],
                    messageId: 'msg_1',
                    metadata: {
                        tavern: {
                            acceptedMessageId: 'msg_1',
                            acceptedRunId: 'run_1',
                            nonce: 'msg_1',
                            sequence: 1,
                        },
                    },
                    nonce: 'msg_1',
                    role: 'user',
                    sender: 'tavern:user',
                    senderName: 'Tavern',
                    sequence: 1,
                    sessionKey,
                    timestamp: '2026-05-13T12:00:00.000Z',
                },
                {
                    __openclaw: {
                        id: 'assistant-message',
                    },
                    content: [{ text: 'hello', type: 'text' }],
                    role: 'assistant',
                    sessionKey,
                    timestamp: '2026-05-13T12:00:08.100Z',
                },
            ],
            sessionKey,
        });

        expect(mapped.messages[0]).toMatchObject({
            content: 'hi',
            id: 'msg_1',
            metadata: {
                tavern: {
                    acceptedMessageId: 'msg_1',
                    acceptedRunId: 'run_1',
                    nonce: 'msg_1',
                    sequence: 1,
                },
            },
            senderType: 'user',
            sessionKey,
        });
        expect(mapped.messages.map((message) => message.id)).toEqual([
            'msg_1',
            'assistant-message',
        ]);
    });

    it('normalizes Discord user message senders to participants', () => {
        const mapped = mapOpenClawSessionMessages({
            messages: [
                {
                    content: 'Hello Blippy!',
                    id: 'message-1',
                    role: 'user',
                    senderName: 'Zach Knickerbocker (778786269458464829)',
                    timestamp: '2026-05-02T20:00:00.000Z',
                },
            ],
            sessionKey: 'agent:blippy:main',
        });

        expect(mapped.messages[0]).toMatchObject({
            participant: {
                accountKey: null,
                externalId: '778786269458464829',
                name: 'Zach Knickerbocker',
                observedLabels: ['Zach Knickerbocker', 'Zach Knickerbocker (778786269458464829)'],
                participantId: 'participant:discord:global:external:778786269458464829',
                platform: 'discord',
                type: 'participant',
            },
            senderName: 'Zach Knickerbocker (778786269458464829)',
            senderType: 'user',
        });
    });
});
