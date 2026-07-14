import type { Tool } from 'ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { claimNextAgentTurnForSeat, createAgentTurn } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createTavernChatActionTools } from './chat-actions-tools.ts';
import {
    createChat,
    createMessage,
    listActivityForResponses,
    listMessages,
    upsertResponse,
} from './chat-api/index.ts';

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

    it('steers a mentioned agent that is mid-turn in the target chat', async () => {
        seedChats();
        seedRunningWrenTurn();
        const tools = actionTools();

        const result = await runTool(tools.chat_send, {
            chatId: 'cht_general',
            message: '[Wren](agent://agt_wren) new numbers landed, use those.',
            mode: 'steer',
        });

        expect(result).toMatchObject({
            chatId: 'cht_general',
            queuedAgentIds: [],
            sent: true,
            steeredAgentIds: ['agt_wren'],
        });
        const sent = listMessages('cht_general', { limit: 10 }).messages.find(
            (message) => message.author.id === 'agt_otto'
        );
        const runtime = sent?.metadata.runtime as Record<string, unknown>;
        expect(runtime.steeredAgentIds).toEqual(['agt_wren']);

        const activities = listActivityForResponses(['rsp_wren_running'], getDb());
        expect(activities).toHaveLength(1);
        expect(activities[0]).toMatchObject({
            detail: '[Wren](agent://agt_wren) new numbers landed, use those.',
            status: 'completed',
            title: 'Steered active turn',
        });
        const activityRuntime = activities[0]?.metadata.runtime as Record<string, unknown>;
        expect(activityRuntime.steeredBy).toEqual({ agentId: 'agt_otto' });
        expect((activityRuntime.notice as Record<string, unknown>).id).toBe(
            'runtime_notice_agent_steered'
        );
    });

    it('falls back to queue when steer targets have no running turn', async () => {
        seedChats();
        const tools = actionTools();

        const result = await runTool(tools.chat_send, {
            chatId: 'cht_general',
            message: '[Wren](agent://agt_wren) please review.',
            mode: 'steer',
        });

        expect(result).toMatchObject({
            queuedAgentIds: ['agt_wren'],
            sent: true,
            steeredAgentIds: [],
        });
        expect(result).toHaveProperty('note');
        const sent = listMessages('cht_general', { limit: 10 }).messages.find(
            (message) => message.author.id === 'agt_otto'
        );
        const runtime = sent?.metadata.runtime as Record<string, unknown>;
        expect(runtime.steeredAgentIds).toBeUndefined();
    });
});

function actionTools() {
    return createTavernChatActionTools({
        agentId: 'agt_otto',
        chatId: 'cht_dm',
        runId: 'run_test',
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

// A live turn for Wren's seat in cht_general, the shape steer mode targets.
function seedRunningWrenTurn() {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_wren',
            isAdmin: false,
            name: 'Wren',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_wren',
        },
    });
    createMessage('cht_general', {
        author_id: 'usr_tavern',
        content: 'Summarize the week.',
        id: 'msg_wren_trigger',
        role: 'user',
    });
    upsertResponse('cht_general', {
        id: 'rsp_wren_running',
        participant_id: 'agt_wren',
        request_message_id: 'msg_wren_trigger',
        status: 'running',
    });
    const session = ensureCurrentAgentSession({
        agentParticipantId: 'agt_wren',
        chatId: 'cht_general',
    });
    createAgentTurn({
        agentId: 'agt_wren',
        agentParticipantId: session.agentParticipantId,
        agentSessionId: session.id,
        chatId: 'cht_general',
        id: 'run_wren_busy',
        responseId: 'rsp_wren_running',
        triggerMessageId: 'msg_wren_trigger',
    });
    claimNextAgentTurnForSeat({
        agentParticipantId: session.agentParticipantId,
        agentSessionId: session.id,
        chatId: 'cht_general',
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
