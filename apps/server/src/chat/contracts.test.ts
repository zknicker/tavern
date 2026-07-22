import { describe, expect, test } from 'bun:test';
import {
    createChatInputSchema,
    sendChatMessageInputSchema,
    startChatInputSchema,
    updateChatInputSchema,
} from './contracts.ts';

describe('chat contracts', () => {
    test('accepts multiple channel agent participants', () => {
        expect(
            createChatInputSchema.parse({
                agentIds: ['agent-1', 'agent-2'],
                displayName: 'Planning',
            })
        ).toEqual({
            agentIds: ['agent-1', 'agent-2'],
            displayName: 'Planning',
        });

        expect(
            updateChatInputSchema.parse({
                agentIds: ['agent-1', 'agent-2'],
                chatId: 'cht_1',
                displayName: 'Planning',
            })
        ).toEqual({
            agentIds: ['agent-1', 'agent-2'],
            chatId: 'cht_1',
            displayName: 'Planning',
        });
    });

    test('requires at least one agent participant when agent ids are provided', () => {
        expect(() =>
            createChatInputSchema.parse({
                agentIds: [],
                displayName: 'Planning',
            })
        ).toThrow();

        expect(() =>
            updateChatInputSchema.parse({
                agentIds: [],
                chatId: 'cht_1',
                displayName: 'Planning',
            })
        ).toThrow();
    });

    test('rejects user-send metadata', () => {
        expect(() =>
            sendChatMessageInputSchema.parse({
                chatId: 'cht_1',
                content: 'Hello',
                metadata: {
                    tavern: {
                        mentions: [],
                    },
                },
            })
        ).toThrow();

        expect(() =>
            startChatInputSchema.parse({
                agentId: 'agent-1',
                content: 'Hello',
                metadata: {
                    tavern: {
                        addressedAgentIds: ['agent-1'],
                    },
                },
            })
        ).toThrow();
    });
});
