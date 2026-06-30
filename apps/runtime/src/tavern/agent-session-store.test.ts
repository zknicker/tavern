import { agentRuntimeRoutes } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { namedParams } from '../db/sqlite';
import { saveAgentModelSelectionIntent } from '../models/selection-service';
import {
    ensureCurrentAgentSession,
    listAgentSessionsForSeat,
    startNewAgentSession,
    updateCurrentAgentSessionModel,
} from './agent-session-store';
import { upsertStoredAgent } from './agents-store';
import { createChat, listMessages } from './chat-api';
import { handleTavernRuntimeRequest } from './router';

describe('Tavern Runtime agent sessions', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('creates one current session for an agent seat with the effective model', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });

        const session = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });

        expect(session).toMatchObject({
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: 'ags_cht_one_agt_primary_1',
            status: 'active',
        });
        expect(readCurrentSessionId('cht_one', 'agt_primary')).toBe(session.id);
        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_one' })
        ).toHaveLength(1);
    });

    it('rotates the current session for one chat without changing another chat', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        seedAgentChat({ chatId: 'cht_two', model: 'gpt-4.1-mini' });
        const firstChatSession = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });
        const secondChatSession = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_two',
            now: '2026-06-29T12:00:01.000Z',
        });

        const rotated = startNewAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:02.000Z',
        });

        expect(rotated).toMatchObject({
            generation: 2,
            id: 'ags_cht_one_agt_primary_2',
            status: 'active',
        });
        expect(readCurrentSessionId('cht_one', 'agt_primary')).toBe(rotated.id);
        expect(readCurrentSessionId('cht_two', 'agt_primary')).toBe(secondChatSession.id);
        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_one' }).map(
                (session) => [session.id, session.status]
            )
        ).toEqual([
            [firstChatSession.id, 'archived'],
            [rotated.id, 'active'],
        ]);
    });

    it('repairs missing current pointers and multiple active sessions for one agent seat', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const first = startNewAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });
        const second = startNewAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:01.000Z',
        });
        getDb()
            .prepare(
                `UPDATE agent_sessions
                 SET status = 'active', archived_at = NULL
                 WHERE id = $id`
            )
            .run(namedParams({ id: first.id }));
        getDb()
            .prepare(
                `UPDATE chat_participants
                 SET current_agent_session_id = NULL
                 WHERE chat_id = $chatId AND id = $agentParticipantId`
            )
            .run(namedParams({ agentParticipantId: 'agt_primary', chatId: 'cht_one' }));

        const repaired = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:02.000Z',
        });

        expect(repaired.id).toBe(second.id);
        expect(readCurrentSessionId('cht_one', 'agt_primary')).toBe(second.id);
        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_one' }).map(
                (session) => [session.id, session.status]
            )
        ).toEqual([
            [first.id, 'archived'],
            [second.id, 'active'],
        ]);
    });

    it('rotates a chat agent session through the Runtime HTTP command', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });

        const response = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test${agentRuntimeRoutes.chatAgentSessionNew('cht_one')}`, {
                body: JSON.stringify({ agentParticipantId: 'agt_primary' }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            session: {
                agentParticipantId: 'agt_primary',
                chatId: 'cht_one',
                generation: 1,
                id: 'ags_cht_one_agt_primary_1',
                status: 'active',
            },
        });
        expect(listMessages('cht_one').messages).toMatchObject([
            {
                author: { id: 'sys_tavern', kind: 'system' },
                content: 'Started new session: ags_cht_one_agt_primary_1',
                id: 'msg_ags_cht_one_agt_primary_1_notice',
                metadata: {
                    tavern: {
                        agentParticipantId: 'agt_primary',
                        kind: 'new_session',
                        sessionId: 'ags_cht_one_agt_primary_1',
                    },
                },
                role: 'system',
            },
        ]);
    });

    it('changes the effective model for one current session without touching another chat', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        seedAgentChat({ chatId: 'cht_two', model: 'gpt-4.1-mini' });
        const firstChatSession = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });
        const secondChatSession = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_two',
            now: '2026-06-29T12:00:01.000Z',
        });

        const result = updateCurrentAgentSessionModel({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            model: { model: 'gpt-4.1', provider: 'openai' },
            now: '2026-06-29T12:00:02.000Z',
        });

        expect(result).toMatchObject({
            rotated: false,
            session: {
                effectiveModel: { model: 'gpt-4.1', provider: 'openai' },
                generation: 1,
                id: firstChatSession.id,
            },
        });
        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_two' })
        ).toMatchObject([
            {
                effectiveModel: secondChatSession.effectiveModel,
                id: secondChatSession.id,
                status: 'active',
            },
        ]);
    });

    it('changes the effective model across providers without rotating the session', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const original = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });

        const result = updateCurrentAgentSessionModel({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            model: { model: 'claude-opus-4-8', provider: 'claude' },
            now: '2026-06-29T12:00:01.000Z',
        });

        expect(result).toMatchObject({
            rotated: false,
            session: {
                effectiveModel: { model: 'claude-opus-4-8', provider: 'claude' },
                generation: 1,
                id: original.id,
                status: 'active',
            },
        });
        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_one' }).map(
                (session) => [session.id, session.status]
            )
        ).toEqual([[original.id, 'active']]);
    });

    it('reads and changes a chat agent session model through Runtime HTTP routes', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });

        const currentResponse = await handleTavernRuntimeRequest(
            new Request(
                `http://runtime.test${agentRuntimeRoutes.chatAgentSessionCurrent('cht_one')}?agentParticipantId=agt_primary`
            )
        );
        const currentPayload = await currentResponse.json();

        expect(currentResponse.status).toBe(200);
        expect(currentPayload).toMatchObject({
            session: {
                effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
                id: 'ags_cht_one_agt_primary_1',
            },
        });

        const updateResponse = await handleTavernRuntimeRequest(
            new Request(
                `http://runtime.test${agentRuntimeRoutes.chatAgentSessionModel('cht_one')}`,
                {
                    body: JSON.stringify({
                        agentParticipantId: 'agt_primary',
                        model: { model: 'gpt-4.1', provider: 'openai' },
                    }),
                    headers: { 'content-type': 'application/json' },
                    method: 'PATCH',
                }
            )
        );
        const updatePayload = await updateResponse.json();

        expect(updateResponse.status).toBe(200);
        expect(updatePayload).toMatchObject({
            rotated: false,
            session: {
                effectiveModel: { model: 'gpt-4.1', provider: 'openai' },
                id: 'ags_cht_one_agt_primary_1',
            },
        });
    });
});

function seedAgentChat(input: { chatId: string; model: string }) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
        },
        syncedAt: '2026-06-29T12:00:00.000Z',
    });
    saveAgentModelSelectionIntent({
        agentId: 'agt_primary',
        modelName: { model: input.model, provider: 'openai' },
    });
    createChat({
        id: input.chatId,
        kind: 'channel',
        participants: [
            {
                id: 'usr_tavern',
                kind: 'user',
                label: 'You',
                metadata: {},
            },
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: input.chatId,
    });
}

function readCurrentSessionId(chatId: string, agentParticipantId: string) {
    const row = getDb()
        .prepare(
            `SELECT current_agent_session_id
             FROM chat_participants
             WHERE chat_id = $chatId AND id = $agentParticipantId`
        )
        .get(namedParams({ agentParticipantId, chatId })) as {
        current_agent_session_id: string | null;
    };
    return row.current_agent_session_id;
}
