import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { createChat, createMessage, getChatTimelinePage } from './chat-api';
import { simulateDevelopmentTurn } from './development-turn-simulator';

describe('development turn simulator', () => {
    beforeEach(() => {
        process.env.TAVERN_DEV_STACK = '1';
        ensureRuntimeSchema(initTestDb());
        createChat({ id: 'cht_devsim' });
        createMessage('cht_devsim', {
            author_id: 'usr_1',
            content: 'run something',
            id: 'msg_req_1',
            role: 'user',
        });
    });

    afterEach(() => {
        process.env.TAVERN_DEV_STACK = undefined;
        closeDb();
    });

    it('writes a complete streamed turn: tools, narration, and a final reply', async () => {
        const simulation = simulateDevelopmentTurn({ chatId: 'cht_devsim', paceMs: 0 });
        await simulation.run;

        const page = getChatTimelinePage('cht_devsim', { limit: 20 });
        const response = page.responses.find(
            (entry) => entry.id === simulation.receipt.response_id
        );

        expect(response?.status).toBe('completed');
        expect(response?.response_message_id).toBe(`msg_${simulation.receipt.run_id}`);

        const kinds = page.activity
            .filter((activity) => activity.response_id === simulation.receipt.response_id)
            .map((activity) => activity.kind)
            .sort();
        expect(kinds).toEqual(['message', 'tool_call', 'tool_call', 'tool_call']);

        const reply = page.messages.find(
            (message) => message.id === `msg_${simulation.receipt.run_id}`
        );
        expect(reply?.role).toBe('assistant');
        expect(reply?.content.length).toBeGreaterThan(0);
    });

    it('writes a failed turn for the failure scenario', async () => {
        const simulation = simulateDevelopmentTurn({
            chatId: 'cht_devsim',
            paceMs: 0,
            scenario: 'failure',
        });
        await simulation.run;

        const page = getChatTimelinePage('cht_devsim', { limit: 20 });
        const response = page.responses.find(
            (entry) => entry.id === simulation.receipt.response_id
        );

        expect(response?.status).toBe('failed');
        expect(response?.response_message_id).toBeNull();
        expect(response?.metadata.error).toContain('Simulated failure');
    });

    it('refuses to run outside the development stack', () => {
        process.env.TAVERN_DEV_STACK = undefined;

        expect(() => simulateDevelopmentTurn({ chatId: 'cht_devsim', paceMs: 0 })).toThrow(
            /development stack/
        );
    });
});
