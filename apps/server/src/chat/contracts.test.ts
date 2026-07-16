import { describe, expect, test } from 'bun:test';
import {
    chatLogActiveReplySchema,
    createChatInputSchema,
    sendChatMessageInputSchema,
    startChatInputSchema,
    updateChatInputSchema,
} from './contracts.ts';

describe('chat contracts', () => {
    test('active replies keep the quiet-evaluation stamp through parsing', () => {
        // chatLogPageSchema.parse strips unknown keys; if the stamp is not in
        // the schema, every log snapshot un-hides quiet evaluation turns.
        const reply = chatLogActiveReplySchema.parse({
            agentId: 'agt_wren',
            isThinking: true,
            runId: 'run_1',
            sessionKey: 'ags_agt_wren_1',
            startedAt: '2026-07-16T15:43:01.481Z',
            text: '',
            trigger: 'evaluation',
        });
        expect(reply.trigger).toBe('evaluation');
    });

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
