import { describe, expect, it } from 'bun:test';
import type { AgentRuntimeCreateMessage } from '@tavern/agent-runtime-protocol';
import {
    mapOpenClawMessageAccepted,
    mapTavernMessageToOpenClawChatSend,
    mapTavernMessageToOpenClawTavernTurn,
} from './send-message.ts';

describe('OpenClaw send-message mapping', () => {
    it('uses the projected session key when Tavern has one for the chat and agent', () => {
        expect(
            mapTavernMessageToOpenClawTavernTurn('220f46ed-2d7c-41dd-9d7e-d02691f1afc3', {
                agent: { agentId: 'blippy' },
                message: { content: 'hello', id: 'tavern-message-1' },
                target: {
                    externalId: 'chat-1',
                    sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    target: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    type: 'tavern',
                },
            })
        ).toEqual({
            agent: { agentId: 'blippy' },
            chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            message: {
                content: 'hello',
                id: 'tavern-message-1',
            },
            sender: {
                id: 'tavern-user',
                name: 'Tavern',
            },
            sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            turnId: 'tavern-message-1',
        });
    });

    it('does not guess a session key without a projection', () => {
        expect(() =>
            mapTavernMessageToOpenClawTavernTurn('chat-1', {
                agent: { agentId: 'main' },
                message: { content: 'hello', id: 'tavern-message-2' },
                target: {
                    externalId: 'chat-1',
                    sessionKey: null,
                    target: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    type: 'tavern',
                },
            })
        ).toThrow(/session key/i);
    });

    it('passes Tavern-owned message metadata through to Tavern Messenger', () => {
        const input: AgentRuntimeCreateMessage = {
            agent: { agentId: 'blippy' },
            message: {
                content: 'use Chrome',
                id: 'tavern-message-1',
                metadata: {
                    tavern: {
                        toolMentions: [
                            {
                                end: 10,
                                id: 'chrome',
                                kind: 'skill',
                                label: 'Chrome',
                                start: 4,
                                text: 'Chrome',
                            },
                        ],
                    },
                },
            },
            target: {
                externalId: 'chat-1',
                sessionKey: 'agent:blippy:tavern:channel:chat-1',
                target: 'chat:chat-1',
                type: 'tavern',
            },
        };

        expect(mapTavernMessageToOpenClawTavernTurn('chat-1', input).message.metadata).toEqual({
            tavern: {
                toolMentions: [
                    {
                        end: 10,
                        id: 'chrome',
                        kind: 'skill',
                        label: 'Chrome',
                        start: 4,
                        text: 'Chrome',
                    },
                ],
            },
        });
    });

    it('maps plain text sends through Tavern Messenger turn intake', () => {
        expect(
            mapTavernMessageToOpenClawTavernTurn('chat-1', {
                agent: { agentId: 'blippy' },
                message: {
                    content: 'hello',
                    id: 'tavern-message-1',
                },
                target: {
                    externalId: 'chat-1',
                    sessionKey: 'agent:blippy:tavern:channel:chat-1',
                    target: 'chat:chat-1',
                    type: 'tavern',
                },
            })
        ).toMatchObject({
            chatId: 'chat-1',
            message: {
                content: 'hello',
                id: 'tavern-message-1',
            },
            sessionKey: 'agent:blippy:tavern:channel:chat-1',
            turnId: 'tavern-message-1',
        });
    });

    it('maps Tavern chat sends to native OpenClaw chat.send params', () => {
        expect(
            mapTavernMessageToOpenClawChatSend({
                agent: { agentId: 'blippy' },
                message: {
                    content: 'hello',
                    id: 'tavern-message-1',
                },
                target: {
                    externalId: 'chat-1',
                    sessionKey: 'agent:blippy:tavern:channel:chat-1',
                    target: 'chat:chat-1',
                    type: 'tavern',
                },
            })
        ).toEqual({
            deliver: false,
            idempotencyKey: 'tavern-run:tavern-message-1',
            message: 'hello',
            sessionKey: 'agent:blippy:tavern:channel:chat-1',
        });
    });

    it('maps message acceptance with the requested session key', () => {
        expect(
            mapOpenClawMessageAccepted(
                {
                    runId: 'msg-1',
                    status: 'started',
                },
                'agent:blippy:tavern:channel:chat-1'
            )
        ).toMatchObject({
            runId: 'msg-1',
            sessionKey: 'agent:blippy:tavern:channel:chat-1',
            status: 'accepted',
        });
    });

    it('strips non-Tavern runtime metadata from Tavern sends', () => {
        expect(
            mapTavernMessageToOpenClawTavernTurn('chat-1', {
                agent: { agentId: 'blippy' },
                message: {
                    content: 'use Chrome',
                    id: 'tavern-message-1',
                    metadata: {
                        tavern: {
                            toolMentions: [
                                {
                                    end: 10,
                                    id: 'chrome',
                                    kind: 'skill',
                                    label: 'Chrome',
                                    start: 4,
                                    text: 'Chrome',
                                },
                            ],
                        },
                        model: 'gpt-5.5',
                        provider: 'openrouter',
                        stopReason: 'error',
                        toolCallId: 'tool-call-1',
                    },
                },
                target: {
                    externalId: 'chat-1',
                    sessionKey: 'agent:blippy:tavern:channel:chat-1',
                    target: 'chat:chat-1',
                    type: 'tavern',
                },
            }).message.metadata
        ).toEqual({
            tavern: {
                toolMentions: [
                    {
                        end: 10,
                        id: 'chrome',
                        kind: 'skill',
                        label: 'Chrome',
                        start: 4,
                        text: 'Chrome',
                    },
                ],
            },
        });
    });

    it('requires a stable OpenClaw run id from message acceptance', () => {
        expect(() => mapOpenClawMessageAccepted({ sessionKey: 'agent:main:main' })).toThrow(
            /runId/i
        );
    });
});
