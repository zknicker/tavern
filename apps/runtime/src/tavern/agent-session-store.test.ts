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
    updateAgentSessionRuntimeState,
    updateCurrentAgentSessionModel,
} from './agent-session-store';
import { upsertStoredAgent } from './agents-store';
import { createChat, upsertResponse } from './chat-api';
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
            promptContextSequence: 0,
            status: 'active',
        });
        expect(readCurrentSessionId('cht_one', 'agt_primary')).toBe(session.id);
        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_one' })
        ).toHaveLength(1);
    });

    it('advances the prompt context cursor without moving it backwards', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const session = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });

        updateAgentSessionRuntimeState({
            id: session.id,
            promptContextSequence: 12,
        });
        updateAgentSessionRuntimeState({
            id: session.id,
            promptContextSequence: 4,
        });

        expect(
            listAgentSessionsForSeat({ agentParticipantId: 'agt_primary', chatId: 'cht_one' })[0]
        ).toMatchObject({
            id: session.id,
            promptContextSequence: 12,
        });
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
                `http://runtime.test${agentRuntimeRoutes.chatAgentSessionCurrent('cht_one')}?agentId=agt_primary`
            )
        );
        const currentPayload = await currentResponse.json();

        expect(currentResponse.status).toBe(200);
        expect(currentPayload).toMatchObject({
            session: {
                effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
                id: 'ags_cht_one_agt_primary_1',
            },
            stats: { contextTokens: null, turnCount: 0 },
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

    it('aggregates turn count and context tokens from the session turn evidence', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const session = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });

        seedTurnResponse({ contextTokens: 1200, id: 'rsp_turn_1', sessionId: session.id });
        seedTurnResponse({ contextTokens: 4800, id: 'rsp_turn_2', sessionId: session.id });
        // A turn without usage still counts, but never wins the context read.
        seedTurnResponse({ contextTokens: null, id: 'rsp_turn_3', sessionId: session.id });

        const response = await handleTavernRuntimeRequest(
            new Request(
                `http://runtime.test${agentRuntimeRoutes.chatAgentSessionCurrent('cht_one')}?agentId=agt_primary`
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            stats: { contextTokens: 4800, turnCount: 3 },
        });
    });

    it('lists past sessions newest first with their turn counts', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const first = ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });
        seedTurnResponse({ contextTokens: 800, id: 'rsp_first_1', sessionId: first.id });
        seedTurnResponse({ contextTokens: 1600, id: 'rsp_first_2', sessionId: first.id });
        const second = startNewAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T13:00:00.000Z',
        });
        startNewAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T14:00:00.000Z',
        });

        const response = await handleTavernRuntimeRequest(
            new Request(
                `http://runtime.test${agentRuntimeRoutes.chatAgentSessionCurrent('cht_one')}?agentId=agt_primary`
            )
        );
        const payload = (await response.json()) as {
            pastSessions: Record<string, unknown>[];
        };

        expect(response.status).toBe(200);
        expect(payload.pastSessions).toMatchObject([
            { id: second.id, status: 'archived', turnCount: 0 },
            { id: first.id, status: 'archived', turnCount: 2 },
        ]);
        expect(payload.pastSessions[0]).not.toHaveProperty('resumeState');
    });

    it('resets the seat session through the Runtime HTTP route and records a notice', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        ensureCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
            now: '2026-06-29T12:00:00.000Z',
        });

        const resetResponse = await handleTavernRuntimeRequest(
            new Request(
                `http://runtime.test${agentRuntimeRoutes.chatAgentSessionReset('cht_one')}`,
                {
                    body: JSON.stringify({ agentId: 'agt_primary' }),
                    headers: { 'content-type': 'application/json' },
                    method: 'POST',
                }
            )
        );
        const resetPayload = await resetResponse.json();

        expect(resetResponse.status).toBe(200);
        expect(resetPayload).toMatchObject({
            session: {
                generation: 2,
                id: 'ags_cht_one_agt_primary_2',
                status: 'active',
            },
        });

        const sessions = listAgentSessionsForSeat({
            agentParticipantId: 'agt_primary',
            chatId: 'cht_one',
        });
        expect(sessions.map((session) => [session.generation, session.status]).sort()).toEqual([
            [1, 'archived'],
            [2, 'active'],
        ]);

        // The reset lands as durable timeline evidence: one activity holding
        // a new-session notice for the fresh session id.
        const activityRows = getDb()
            .prepare('SELECT metadata_json FROM chat_response_activity WHERE chat_id = $chatId')
            .all(namedParams({ chatId: 'cht_one' })) as { metadata_json: string }[];

        expect(activityRows).toHaveLength(1);
        expect(JSON.parse(activityRows[0].metadata_json)).toMatchObject({
            runtime: {
                notice: {
                    kind: 'new_session',
                    sessionId: 'ags_cht_one_agt_primary_2',
                    title: 'New session',
                },
                source: 'session-reset',
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

function seedTurnResponse(input: { contextTokens: number | null; id: string; sessionId: string }) {
    upsertResponse('cht_one', {
        id: input.id,
        metadata: {
            runtime: {
                agentId: 'agt_primary',
                agentSessionId: input.sessionId,
                ...(input.contextTokens !== null ? { contextTokens: input.contextTokens } : {}),
                source: 'agent-engine',
            },
        },
        participant_id: 'agt_primary',
        status: 'completed',
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
