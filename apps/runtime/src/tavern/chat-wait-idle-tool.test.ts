import type { Tool } from 'ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import {
    claimNextAgentTurnForSeat,
    completeAgentTurn,
    createAgentTurn,
} from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import {
    createChat,
    createMessage,
    listActivityForResponses,
    upsertResponse,
} from './chat-api/index.ts';
import { createTavernChatWaitTools } from './chat-wait-idle-tool.ts';

describe('chat_wait_idle', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('rejects non-member chats, unknown agents, and waiting on the current turn', async () => {
        seedChannel();
        const tools = waitTools();

        await expect(
            runTool(tools.chat_wait_idle, { agentId: 'agt_wren', chatId: 'cht_private' })
        ).resolves.toMatchObject({ error: 'You are not a participant of that chat.' });
        await expect(
            runTool(tools.chat_wait_idle, { agentId: 'agt_ghost', chatId: 'cht_general' })
        ).resolves.toMatchObject({ error: 'That agent is not a participant of that chat.' });
        await expect(
            runTool(tools.chat_wait_idle, { agentId: 'agt_otto', chatId: 'cht_general' })
        ).resolves.toMatchObject({
            error: 'That is your own seat in the current chat; your running turn is this one.',
        });
    });

    it('returns idle immediately when the seat has no queued or running turn', async () => {
        seedChannel();
        const tools = waitTools();

        const result = await runTool(tools.chat_wait_idle, {
            agentId: 'agt_wren',
            chatId: 'cht_general',
        });

        expect(result).toMatchObject({ agentId: 'agt_wren', idle: true });
    });

    it('resolves when the running turn settles mid-wait and records evidence', async () => {
        seedChannel();
        seedCallerTurn();
        const wrenTurnId = seedRunningWrenTurn();
        const tools = waitTools();

        const pending = runTool(tools.chat_wait_idle, {
            agentId: 'agt_wren',
            chatId: 'cht_general',
            timeoutSeconds: 5,
        });
        await sleep(50);
        completeAgentTurn({ activityIds: [], id: wrenTurnId, outputMessageIds: [] });
        const result = await pending;

        expect(result).toMatchObject({ agentId: 'agt_wren', idle: true });
        const activities = listActivityForResponses(['rsp_caller'], getDb());
        expect(activities).toHaveLength(1);
        expect(activities[0]).toMatchObject({ status: 'completed', title: 'Waited for agent' });
        expect(activities[0]?.detail).toMatch(/Waited [\d.]+s for Wren to go idle in "General"\./);
    });

    it('times out while the seat stays busy', async () => {
        seedChannel();
        seedCallerTurn();
        seedRunningWrenTurn();
        const tools = waitTools();

        const result = await runTool(tools.chat_wait_idle, {
            agentId: 'agt_wren',
            chatId: 'cht_general',
            timeoutSeconds: 1,
        });

        expect(result).toMatchObject({ agentId: 'agt_wren', idle: false, timedOut: true });
        const activities = listActivityForResponses(['rsp_caller'], getDb());
        expect(activities[0]?.detail).toMatch(/Timed out after [\d.]+s waiting for Wren/);
    });
});

function waitTools() {
    return createTavernChatWaitTools(
        { agentId: 'agt_otto', chatId: 'cht_general', runId: 'run_caller' },
        { pollIntervalMs: 10 }
    );
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

function seedChannel() {
    for (const agentId of ['agt_otto', 'agt_wren']) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: agentId === 'agt_wren' ? 'Wren' : 'Otto',
                primaryColor: null,
                workspaceFolder: `/tmp/${agentId}`,
            },
        });
    }
    const user = { id: 'usr_tavern', kind: 'user' as const, label: 'You', metadata: {} };
    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [
            user,
            { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: { agentId: 'agt_otto' } },
            { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
        ],
        title: 'General',
    });
    createChat({
        id: 'cht_private',
        kind: 'channel',
        participants: [
            user,
            { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
        ],
        title: 'Private',
    });
}

// The caller's own running turn, so wait evidence has a response to land on.
function seedCallerTurn() {
    seedTurn({
        agentId: 'agt_otto',
        messageId: 'msg_caller_trigger',
        responseId: 'rsp_caller',
        runId: 'run_caller',
    });
}

function seedRunningWrenTurn() {
    return seedTurn({
        agentId: 'agt_wren',
        messageId: 'msg_wren_trigger',
        responseId: 'rsp_wren',
        runId: 'run_wren_busy',
    });
}

function seedTurn(input: {
    agentId: string;
    messageId: string;
    responseId: string;
    runId: string;
}) {
    createMessage('cht_general', {
        author_id: 'usr_tavern',
        content: 'Work request.',
        id: input.messageId,
        role: 'user',
    });
    upsertResponse('cht_general', {
        id: input.responseId,
        participant_id: input.agentId,
        request_message_id: input.messageId,
        status: 'running',
    });
    const session = ensureCurrentAgentSession({
        agentParticipantId: input.agentId,
        chatId: 'cht_general',
    });
    createAgentTurn({
        agentId: input.agentId,
        agentParticipantId: session.agentParticipantId,
        agentSessionId: session.id,
        chatId: 'cht_general',
        id: input.runId,
        responseId: input.responseId,
        triggerMessageId: input.messageId,
    });
    claimNextAgentTurnForSeat({
        agentParticipantId: session.agentParticipantId,
        agentSessionId: session.id,
        chatId: 'cht_general',
    });
    return input.runId;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
