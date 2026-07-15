import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { resetAgentExecutorForTesting, setAgentExecutorForTesting } from './agent-turn-runner.ts';
import { claimNextAgentTurnForAgent, createAgentTurn } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import {
    deliverToBusySeats,
    installBusyDelivery,
    resetBusyDeliveryForTesting,
} from './busy-delivery.ts';
import {
    createChat,
    createMessage,
    getMessage,
    listActivityForResponses,
    upsertResponse,
} from './chat-api/index.ts';
import { readSeenCursor } from './seen-ledger.ts';

describe('busy delivery', () => {
    let deliveries: Array<{ runId: string; text: string }>;
    let accept: boolean;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        resetBusyDeliveryForTesting();
        deliveries = [];
        accept = true;
        setAgentExecutorForTesting({
            deliverUserMessage: (runId, text) => {
                deliveries.push({ runId, text });
                return accept;
            },
            execute: () => Promise.reject(new Error('not used')),
        });
        seedChannel();
    });

    afterEach(() => {
        resetAgentExecutorForTesting();
        resetBusyDeliveryForTesting();
        closeDb();
    });

    it('delivers a seq-tagged notice to running turns and records evidence', async () => {
        seedRunningTurn('agt_wren', 'run_wren');
        const message = seedUserMessage('msg_new', 'Use the March numbers.');

        const delivered = await deliverToBusySeats('cht_general', message);

        expect(delivered).toEqual(['run_wren']);
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0]?.runId).toBe('run_wren');
        expect(deliveries[0]?.text).toContain('new message in this chat while your turn runs');
        expect(deliveries[0]?.text).toContain(`seq:${message.sequence}`);
        expect(deliveries[0]?.text).toContain('Use the March numbers.');

        const activities = listActivityForResponses(['rsp_run_wren'], getDb());
        expect(activities).toHaveLength(1);
        expect(activities[0]).toMatchObject({ status: 'completed', title: 'Delivered mid-turn' });

        // Deliveries are hints: the durable ledger never advances on them
        // (specs/sessions.md) — the freshness gate stays armed.
        expect(readSeenCursor('ags_agt_wren_1', 'cht_general')).toBe(0);
    });

    it('skips the author turn, dedupes repeats, and tolerates refusal', async () => {
        seedRunningTurn('agt_wren', 'run_wren');
        seedRunningTurn('agt_otto', 'run_otto');
        const fromWren = seedAssistantMessage('msg_wren_post', 'agt_wren', 'status update');

        await deliverToBusySeats('cht_general', fromWren);
        expect(deliveries.map((entry) => entry.runId)).toEqual(['run_otto']);

        // Repeat delivery of the same sequence is a no-op.
        await deliverToBusySeats('cht_general', fromWren);
        expect(deliveries).toHaveLength(1);

        // Refused delivery leaves no ledger advance and no evidence.
        accept = false;
        const second = seedUserMessage('msg_two', 'another');
        expect(await deliverToBusySeats('cht_general', second)).toEqual([]);
        expect(readSeenCursor('ags_agt_wren_1', 'cht_general')).toBeLessThan(second.sequence);
    });

    it('reaches a turn running in another chat and names the source chat', async () => {
        seedSideChat();
        seedRunningTurn('agt_wren', 'run_wren');
        const message = seedSideChatMessage('msg_side_1', 'side news one');

        const delivered = await deliverToBusySeats('cht_side', message);

        expect(delivered).toEqual(['run_wren']);
        expect(deliveries[0]?.text).toContain('"Side" (chatId: cht_side)');
        expect(deliveries[0]?.text).toContain('side news one');
        expect(readSeenCursor('ags_agt_wren_1', 'cht_side')).toBe(0);
    });

    it('dedupes per chat, not per bare sequence number', async () => {
        seedSideChat();
        seedRunningTurn('agt_wren', 'run_wren');
        seedSideChatMessage('msg_side_pad', 'pad');
        const inGeneral = seedUserMessage('msg_here', 'general news');
        const inSide = seedSideChatMessage('msg_side_dup', 'side news');
        // Same per-chat sequence number in two different chats: sequences
        // are per-chat counters, so both must deliver.
        expect(inSide.sequence).toBe(inGeneral.sequence);

        await deliverToBusySeats('cht_general', inGeneral);
        await deliverToBusySeats('cht_side', inSide);

        expect(deliveries).toHaveLength(2);
    });

    it('installs on the chat-api event bus for creates and deliveries', async () => {
        seedRunningTurn('agt_wren', 'run_wren');
        const unsubscribe = installBusyDelivery();
        try {
            createMessage('cht_general', {
                author_id: 'usr_tavern',
                content: 'bus message',
                id: 'msg_bus',
                role: 'user',
            });
            await settle();
            expect(deliveries).toHaveLength(1);
            expect(deliveries[0]?.text).toContain('bus message');
        } finally {
            unsubscribe();
        }
    });

    function seedSideChat() {
        createChat({
            id: 'cht_side',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
            ],
            title: 'Side',
        });
    }

    function seedSideChatMessage(id: string, content: string) {
        createMessage('cht_side', {
            author_id: 'usr_tavern',
            content,
            id,
            role: 'user',
        });
        const message = getMessage(id);
        if (!message) {
            throw new Error('seed message missing');
        }
        return message;
    }

    function seedUserMessage(id: string, content: string) {
        createMessage('cht_general', {
            author_id: 'usr_tavern',
            content,
            id,
            role: 'user',
        });
        const message = getMessage(id);
        if (!message) {
            throw new Error('seed message missing');
        }
        return message;
    }

    function seedAssistantMessage(id: string, agentId: string, content: string) {
        createMessage('cht_general', {
            author_id: agentId,
            content,
            id,
            role: 'assistant',
        });
        const message = getMessage(id);
        if (!message) {
            throw new Error('seed message missing');
        }
        return message;
    }
});

function seedChannel() {
    for (const agentId of ['agt_otto', 'agt_wren']) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: agentId,
                primaryColor: null,
                workspaceFolder: `/tmp/${agentId}`,
            },
        });
    }
    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: { agentId: 'agt_otto' } },
            { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
        ],
        title: 'General',
    });
}

function seedRunningTurn(agentId: string, runId: string) {
    createMessage('cht_general', {
        author_id: 'usr_tavern',
        content: 'work request',
        id: `msg_trigger_${runId}`,
        role: 'user',
    });
    upsertResponse('cht_general', {
        id: `rsp_${runId}`,
        participant_id: agentId,
        request_message_id: `msg_trigger_${runId}`,
        status: 'running',
    });
    const session = ensureCurrentAgentSession({ agentId });
    createAgentTurn({
        agentId,
        agentParticipantId: agentId,
        agentSessionId: session.id,
        chatId: 'cht_general',
        id: runId,
        responseId: `rsp_${runId}`,
        triggerMessageId: `msg_trigger_${runId}`,
    });
    claimNextAgentTurnForAgent({ agentId });
    return session;
}

function settle() {
    return new Promise((resolve) => setTimeout(resolve, 10));
}
