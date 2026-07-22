import { agentRuntimeRoutes } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { saveAgentModelSelectionIntent } from '../models/selection-service';
import {
    ensureCurrentAgentSession,
    listAgentSessionsForAgent,
    startNewAgentSession,
    updateAgentSessionRuntimeState,
} from './agent-session-store';
import { upsertStoredAgent } from './agents-store';
import { createChat, upsertResponse } from './chat-api';
import { advanceSeenCursor, readSeenCursor } from './inbox-cursors';
import { handleTavernRuntimeRequest } from './router';

describe('Tavern Runtime agent sessions', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('creates one global session per agent with the effective model', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });

        const session = ensureCurrentAgentSession({
            agentId: 'agt_primary',
            now: '2026-06-29T12:00:00.000Z',
        });

        expect(session).toMatchObject({
            agentId: 'agt_primary',
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: 'ags_agt_primary_1',
            status: 'active',
        });
        // The same agent in another chat gets the same session.
        expect(ensureCurrentAgentSession({ agentId: 'agt_primary' }).id).toBe(session.id);
        expect(listAgentSessionsForAgent('agt_primary')).toHaveLength(1);
    });

    it('rotates to a fresh session when the selected model changes', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const first = ensureCurrentAgentSession({ agentId: 'agt_primary' });

        saveAgentModelSelectionIntent({
            agentId: 'agt_primary',
            modelName: { model: 'gpt-5.5', provider: 'codex' },
        });
        const second = ensureCurrentAgentSession({ agentId: 'agt_primary' });

        expect(second.id).not.toBe(first.id);
        expect(second.generation).toBe(2);
        expect(second.effectiveModel).toEqual({ model: 'gpt-5.5', provider: 'codex' });
        const sessions = listAgentSessionsForAgent('agt_primary');
        expect(sessions.map((session) => session.status)).toEqual(['archived', 'active']);
    });

    it('startNewAgentSession archives every prior active session', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const first = ensureCurrentAgentSession({ agentId: 'agt_primary' });

        const fresh = startNewAgentSession({ agentId: 'agt_primary' });

        expect(fresh.id).not.toBe(first.id);
        const sessions = listAgentSessionsForAgent('agt_primary');
        expect(sessions.filter((session) => session.status === 'active')).toHaveLength(1);
    });

    it('records runtime state and last turn time', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const session = ensureCurrentAgentSession({ agentId: 'agt_primary' });

        const updated = updateAgentSessionRuntimeState({
            id: session.id,
            now: '2026-06-29T13:00:00.000Z',
            resumeState: { engine: 'state' },
            runtimeSessionId: 'ses_engine_1',
        });

        expect(updated).toMatchObject({
            lastTurnAt: '2026-06-29T13:00:00.000Z',
            resumeState: { engine: 'state' },
            runtimeSessionId: 'ses_engine_1',
        });
    });

    it('keeps per-chat seen cursors monotonic in the ledger', () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const session = ensureCurrentAgentSession({ agentId: 'agt_primary' });

        advanceSeenCursor({ chatId: 'cht_one', seq: 5, sessionId: session.id });
        advanceSeenCursor({ chatId: 'cht_one', seq: 3, sessionId: session.id });

        expect(readSeenCursor(session.id, 'cht_one')).toBe(5);
        expect(readSeenCursor(session.id, 'cht_other')).toBe(0);
    });

    it('reads the current agent session through Runtime HTTP routes', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        ensureCurrentAgentSession({ agentId: 'agt_primary' });

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
                id: 'ags_agt_primary_1',
            },
            stats: { contextTokens: null, turnCount: 0 },
        });
    });

    it('aggregates turn count and context tokens across every chat', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const session = ensureCurrentAgentSession({ agentId: 'agt_primary' });

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

        expect(payload).toMatchObject({
            stats: { contextTokens: 4800, turnCount: 3 },
        });
    });

    it('resets the session through the agent-scoped reset route', async () => {
        seedAgentChat({ chatId: 'cht_one', model: 'gpt-4.1-mini' });
        const first = ensureCurrentAgentSession({ agentId: 'agt_primary' });

        const response = await handleTavernRuntimeRequest(
            new Request(
                `http://runtime.test${agentRuntimeRoutes.agentSessionReset('agt_primary')}`,
                {
                    body: JSON.stringify({ kind: 'session' }),
                    headers: { 'content-type': 'application/json' },
                    method: 'POST',
                }
            )
        );
        const payload = (await response.json()) as {
            session: { generation: number; id: string };
        };

        expect(response.status).toBe(200);
        expect(payload.session.id).not.toBe(first.id);
        expect(payload.session.generation).toBe(2);
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
            workspaceFolder: '/tmp/agt_primary',
        },
    });
    saveAgentModelSelectionIntent({
        agentId: 'agt_primary',
        modelName: { model: input.model, provider: 'openai' },
    });
    createChat({
        id: input.chatId,
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
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
