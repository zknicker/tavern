import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    ensureCurrentAgentSession,
    readCurrentAgentSession,
    updateAgentSessionRuntimeState,
} from './agent-session-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage, latestMessageSequence } from './chat-api/index.ts';
import { ensureFreshAgentSession, lastDailyBoundary } from './session-freshness.ts';

const chatId = 'cht_fresh';

describe('session freshness', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        setHomeTimezone('America/New_York');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: false,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_primary',
            },
        });
        createChat({
            id: chatId,
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
            title: 'fresh',
        });
        createMessage(chatId, {
            author_id: 'usr_tavern',
            content: 'hello',
            id: 'msg_fresh_1',
            role: 'user',
        });
    });

    afterEach(() => {
        closeDb();
    });

    it('computes the most recent 4am boundary in the home timezone', () => {
        // 2026-07-07T12:00Z = 8am in New York; the boundary is 4am NY = 08:00Z.
        const boundary = lastDailyBoundary(new Date('2026-07-07T12:00:00Z'), 'America/New_York');
        expect(boundary.toISOString()).toBe('2026-07-07T08:00:00.000Z');

        // 2026-07-07T06:00Z = 2am in New York; boundary is yesterday's 4am NY.
        const earlier = lastDailyBoundary(new Date('2026-07-07T06:00:00Z'), 'America/New_York');
        expect(earlier.toISOString()).toBe('2026-07-06T08:00:00.000Z');
    });

    it('does not rotate fresh or never-used sessions', () => {
        const session = seedActiveSession('2026-07-07T14:00:00.000Z');

        expect(ensureFreshAgentSession({ agentId: 'agt_primary', chatId })).toBeNull();
        // Session that never ran a turn stays put even when old.
        backdateSession(session.id, '2026-07-01T00:00:00.000Z');
        clearRuntimeSessionId(session.id);
        expect(
            ensureFreshAgentSession({
                agentId: 'agt_primary',
                chatId,
                now: new Date('2026-07-07T14:00:00.000Z'),
            })
        ).toBeNull();
    });

    it('rotates idle sessions and snapshots the context cursor', () => {
        const session = seedActiveSession('2026-07-05T13:00:00.000Z');

        const reason = ensureFreshAgentSession({
            agentId: 'agt_primary',
            chatId,
            now: new Date('2026-07-07T14:00:00.000Z'),
        });

        expect(reason).toBe('idle');
        const current = readCurrentAgentSession({
            agentParticipantId: 'agt_primary',
            chatId,
        });
        expect(current?.id).not.toBe(session.id);
        expect(current?.generation).toBe(session.generation + 1);
        expect(current?.promptContextSequence).toBe(latestMessageSequence(chatId));
    });

    it('rotates sessions last active before the daily boundary', () => {
        // Last active 11pm NY yesterday; now 9am NY today — crossed 4am NY.
        seedActiveSession('2026-07-07T03:00:00.000Z');

        const reason = ensureFreshAgentSession({
            agentId: 'agt_primary',
            chatId,
            now: new Date('2026-07-07T13:00:00.000Z'),
        });

        expect(reason).toBe('daily');
    });

    it('keeps sessions active since the daily boundary', () => {
        // Last active 6am NY today; now 9am NY today — same 4am window.
        seedActiveSession('2026-07-07T10:00:00.000Z');

        expect(
            ensureFreshAgentSession({
                agentId: 'agt_primary',
                chatId,
                now: new Date('2026-07-07T13:00:00.000Z'),
            })
        ).toBeNull();
    });
});

function seedActiveSession(lastActiveAt: string) {
    const session = ensureCurrentAgentSession({
        agentParticipantId: 'agt_primary',
        chatId,
    });
    updateAgentSessionRuntimeState({
        id: session.id,
        resumeState: {},
        runtimeSessionId: 'ses_engine',
    });
    backdateSession(session.id, lastActiveAt);
    return session;
}

function backdateSession(sessionId: string, updatedAt: string) {
    getDb()
        .prepare('UPDATE agent_sessions SET updated_at = $updatedAt WHERE id = $id')
        .run(namedParams({ id: sessionId, updatedAt }));
}

function clearRuntimeSessionId(sessionId: string) {
    getDb()
        .prepare('UPDATE agent_sessions SET runtime_session_id = NULL WHERE id = $id')
        .run(namedParams({ id: sessionId }));
}

function setHomeTimezone(timezone: string) {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ('runtime:timezone', $value, $now)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run(namedParams({ now: new Date().toISOString(), value: JSON.stringify({ timezone }) }));
}
