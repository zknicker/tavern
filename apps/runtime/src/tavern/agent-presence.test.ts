import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { listAgentPresence } from './agent-presence.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { claimNextAgentTurnForAgent, createAgentTurn } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage, upsertResponse } from './chat-api/index.ts';

describe('agent presence', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
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
            id: 'cht_room',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: { agentId: 'agt_otto' } },
            ],
            title: 'Launch prep',
        });
    });

    afterEach(() => {
        closeDb();
    });

    it('reports every stored agent, idle without unsettled turns', () => {
        expect(listAgentPresence()).toEqual([
            { agentId: 'agt_otto', chatId: null, chatTitle: null, since: null, state: 'idle' },
            { agentId: 'agt_wren', chatId: null, chatTitle: null, since: null, state: 'idle' },
        ]);
    });

    it('anchors busy to the running turn and stays busy while queued (no drain flicker)', () => {
        seedTurn('run_1', 'agt_otto');
        claimNextAgentTurnForAgent({ agentId: 'agt_otto' });
        // A second queued turn behind the running one changes nothing.
        seedTurn('run_2', 'agt_otto');

        const presence = listAgentPresence();
        expect(presence.find((entry) => entry.agentId === 'agt_otto')).toMatchObject({
            chatId: 'cht_room',
            chatTitle: 'Launch prep',
            state: 'busy',
        });
        // Queued-only (mid-drain gap): still busy, anchored to the oldest
        // queued chat — a seat is busy exactly when its agent is busy.
        expect(presence.find((entry) => entry.agentId === 'agt_wren')?.state).toBe('idle');
        seedTurn('run_3', 'agt_wren');
        expect(listAgentPresence().find((entry) => entry.agentId === 'agt_wren')).toMatchObject({
            chatId: 'cht_room',
            state: 'busy',
        });
    });

    function seedTurn(runId: string, agentId: string) {
        createMessage('cht_room', {
            author_id: 'usr_tavern',
            content: `work ${runId}`,
            id: `msg_${runId}`,
            role: 'user',
        });
        upsertResponse('cht_room', {
            id: `rsp_${runId}`,
            participant_id: agentId,
            request_message_id: `msg_${runId}`,
            status: 'queued',
        });
        const session = ensureCurrentAgentSession({ agentId });
        createAgentTurn({
            agentId,
            agentParticipantId: agentId,
            agentSessionId: session.id,
            chatId: 'cht_room',
            id: runId,
            responseId: `rsp_${runId}`,
            triggerMessageId: `msg_${runId}`,
        });
    }
});
