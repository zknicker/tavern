import type { Tool } from 'ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createChat, createMessage } from './chat-api/index.ts';
import { createTavernChatTools } from './chat-context-tools.ts';
import { readSeenCursor } from './seen-ledger.ts';

describe('chat context tools', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        createChat({
            id: 'cht_room',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                {
                    id: 'agt_otto',
                    kind: 'agent',
                    label: 'Otto',
                    metadata: { agentId: 'agt_otto' },
                },
            ],
            title: 'Room',
        });
        createMessage('cht_room', {
            author_id: 'usr_tavern',
            content: 'unseen room message',
            id: 'msg_room_1',
            role: 'user',
        });
    });

    afterEach(() => {
        closeDb();
    });

    it('reads never advance the seen ledger (specs/sessions.md)', async () => {
        const tools = createTavernChatTools({ agentId: 'agt_otto', chatId: 'cht_room' });

        const listed = await runTool(tools.chat_messages_list, { chatId: 'cht_room' });
        expect(JSON.stringify(listed)).toContain('unseen room message');
        const fetched = await runTool(tools.chat_message_get, {
            chatId: 'cht_room',
            messageId: 'msg_room_1',
        });
        expect(JSON.stringify(fetched)).toContain('unseen room message');

        // A pulled row is not Runtime-delivered content: the ledger only
        // tracks catch-up, busy delivery, and hold envelopes. The row may
        // appear again in a hold; that duplication is bounded and honest.
        expect(readSeenCursor('ags_agt_otto_1', 'cht_room')).toBe(0);
    });
});

async function runTool(candidate: Tool | undefined, args: Record<string, unknown>) {
    if (!candidate?.execute) {
        throw new Error('Tool is not executable.');
    }
    return await candidate.execute(args, {
        context: undefined,
        messages: [],
        toolCallId: 'tool_call_1',
    });
}
