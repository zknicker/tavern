import type { Tool } from 'ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createTavernChatActionTools } from './chat-actions-tools.ts';
import {
    createChat,
    createMessage,
    ensureThreadChat,
    listMessages,
    setThreadFollow,
} from './chat-api/index.ts';
import { readSeenCursor } from './seen-ledger.ts';

describe('chat action tools', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('lists only chats where the agent holds a seat, excluding archived ones', async () => {
        seedChats();
        const tools = actionTools();

        const result = await runTool(tools.chats_list, {});

        expect(result).toEqual({
            chats: [
                { current: true, id: 'cht_dm', kind: 'dm', title: 'Otto' },
                { current: false, id: 'cht_general', kind: 'channel', title: 'general' },
            ],
        });
    });

    it('excludes followed threads whose parent chat is archived', async () => {
        seedChats();
        createMessage('cht_archived', {
            author_id: 'usr_tavern',
            content: 'archived anchor',
            id: 'msg_archived_anchor',
            role: 'user',
        });
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_archived_anchor',
            parentChatId: 'cht_archived',
        });
        setThreadFollow({ follow: true, participantId: 'agt_otto', threadChatId: thread.id });

        const result = await runTool(actionTools().chats_list, {});

        expect(
            (result as { chats: Array<{ id: string }> }).chats.map((chat) => chat.id)
        ).not.toContain(thread.id);
    });

    it('posts a message as the agent into another participating chat', async () => {
        seedChats();
        const tools = actionTools();

        const result = await runTool(tools.chat_send, {
            chatId: 'cht_general',
            message: 'Weekly Merch summary: sales up 12%.',
        });

        expect(result).toMatchObject({ chatId: 'cht_general', sent: true });
        const messages = listMessages('cht_general', { limit: 10 });
        expect(messages.messages).toMatchObject([
            {
                author: { id: 'agt_otto' },
                content: 'Weekly Merch summary: sales up 12%.',
                role: 'assistant',
            },
        ]);
    });

    it('rejects the current chat, non-member chats, and archived chats', async () => {
        seedChats();
        const tools = actionTools();

        await expect(
            runTool(tools.chat_send, { chatId: 'cht_dm', message: 'hi' })
        ).resolves.toMatchObject({
            error: 'This is the current chat. Reply normally instead.',
        });
        await expect(
            runTool(tools.chat_send, { chatId: 'cht_private', message: 'hi' })
        ).resolves.toMatchObject({
            error: 'You are not a participant of that chat.',
        });
        await expect(
            runTool(tools.chat_send, { chatId: 'cht_missing', message: 'hi' })
        ).resolves.toMatchObject({
            error: 'You are not a participant of that chat.',
        });
        await expect(
            runTool(tools.chat_send, { chatId: 'cht_archived', message: 'hi' })
        ).resolves.toMatchObject({
            error: 'That chat is archived.',
        });
        expect(listMessages('cht_general', { limit: 10 }).messages).toHaveLength(0);
    });

    it('holds a send into a stale chat once, embedding the unseen rows', async () => {
        seedChats();
        const tools = actionTools();
        createMessage('cht_general', {
            author_id: 'usr_tavern',
            content: 'Vendor call moved to 3pm.',
            id: 'msg_unseen_1',
            role: 'user',
        });
        createMessage('cht_general', {
            author_id: 'agt_wren',
            content: 'Noted, updating the calendar.',
            id: 'msg_unseen_2',
            role: 'assistant',
        });

        // First send is held with the unseen rows embedded; embedding
        // advances the ledger (specs/sessions.md action gating).
        const held = await runTool(tools.chat_send, {
            chatId: 'cht_general',
            message: 'Weekly summary.',
        });
        expect(held).toMatchObject({ held: true });
        const unseen = (held as { unseen: string[] }).unseen.join('\n');
        expect(unseen).toContain('Vendor call moved to 3pm.');
        expect(unseen).toContain('Noted, updating the calendar.');
        expect(listMessages('cht_general', { limit: 10 }).messages).toHaveLength(2);
        expect(readSeenCursor('ags_agt_otto_1', 'cht_general')).toBe(2);

        // The retry sends: a hold cannot loop.
        const retried = await runTool(tools.chat_send, {
            chatId: 'cht_general',
            message: 'Weekly summary.',
        });
        expect(retried).toMatchObject({ chatId: 'cht_general', sent: true });
        expect(listMessages('cht_general', { limit: 10 }).messages).toHaveLength(3);
    });

    it("never holds on the agent's own rows", async () => {
        seedChats();
        const tools = actionTools();
        createMessage('cht_general', {
            author_id: 'agt_otto',
            content: 'my own earlier post',
            id: 'msg_self',
            role: 'assistant',
        });

        const result = await runTool(tools.chat_send, {
            chatId: 'cht_general',
            message: 'follow-up',
        });
        expect(result).toMatchObject({ sent: true });
    });
});

function actionTools() {
    return createTavernChatActionTools({
        agentId: 'agt_otto',
        chatId: 'cht_dm',
        runId: 'run_test',
        sessionId: 'ags_agt_otto_1',
    });
}

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

function seedChats() {
    const user = { id: 'usr_tavern', kind: 'user' as const, label: 'You', metadata: {} };
    const otto = {
        id: 'agt_otto',
        kind: 'agent' as const,
        label: 'Otto',
        metadata: { agentId: 'agt_otto' },
    };
    const wren = {
        id: 'agt_wren',
        kind: 'agent' as const,
        label: 'Wren',
        metadata: { agentId: 'agt_wren' },
    };

    createChat({
        id: 'cht_dm',
        kind: 'dm',
        participants: [user, otto],
        title: 'Otto',
    });
    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [user, otto, wren],
        title: 'general',
    });
    createChat({
        id: 'cht_private',
        kind: 'channel',
        participants: [user, wren],
        title: 'private',
    });
    createChat({
        id: 'cht_archived',
        kind: 'channel',
        metadata: { tavern: { archived: true } },
        participants: [user, otto],
        title: 'archived',
    });
}
