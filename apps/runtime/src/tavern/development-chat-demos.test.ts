import {
    developmentChatDemoId,
    developmentChatTeamDemoId,
} from '@tavern/api/development-chat-demos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { namedParams } from '../db/sqlite';
import { readPastAgentSessionSummaries } from './agent-session-stats';
import { startNewAgentSession } from './agent-session-store';
import { getStoredAgent } from './agents-store';
import { getChat } from './chat-api';
import { demoAgentId, demoSecondAgentId } from './development-chat-demo-types';
import { seedDevelopmentChatDemos } from './development-chat-demos';

describe('development chat demo sessions', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('seeds archived demo sessions with turn lineage on a fresh database', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        const pastSessions = readPastAgentSessionSummaries({
            agentParticipantId: 'agt_primary',
            chatId: developmentChatDemoId,
            currentSessionId: null,
        });

        expect(pastSessions).toHaveLength(4);
        expect(new Set(pastSessions.map((session) => session.status))).toEqual(
            new Set(['archived'])
        );
        for (const session of pastSessions) {
            expect(session.turnCount).toBeGreaterThan(0);
        }
        // Newest first.
        expect(pastSessions.map((session) => session.createdAt)).toEqual(
            [...pastSessions.map((session) => session.createdAt)].sort().reverse()
        );
    });

    it('never rewrites a live session row or ties demo turns to it', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        // A live rotation claims generation 3; wipe the demo gen-1 row and
        // fake a live active session at that id to simulate the collision.
        getDb()
            .prepare('DELETE FROM agent_sessions WHERE chat_id = $chatId')
            .run(namedParams({ chatId: developmentChatDemoId }));
        const live = startNewAgentSession({
            agentParticipantId: 'agt_primary',
            chatId: developmentChatDemoId,
            now: '2026-07-06T12:00:00.000Z',
        });
        expect(live.id).toBe(`ags_${developmentChatDemoId}_agt_primary_1`);

        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        const liveRow = getDb()
            .prepare('SELECT status, created_at FROM agent_sessions WHERE id = $id')
            .get(namedParams({ id: live.id })) as { created_at: string; status: string };
        expect(liveRow).toMatchObject({
            created_at: '2026-07-06T12:00:00.000Z',
            status: 'active',
        });

        // Demo turn lineage lands only on the seeder-authored archived rows.
        const pastSessions = readPastAgentSessionSummaries({
            agentParticipantId: 'agt_primary',
            chatId: developmentChatDemoId,
            currentSessionId: live.id,
        });
        expect(pastSessions.map((session) => session.id)).toEqual([
            `ags_${developmentChatDemoId}_agt_primary_4`,
            `ags_${developmentChatDemoId}_agt_primary_3`,
            `ags_${developmentChatDemoId}_agt_primary_2`,
        ]);
        for (const session of pastSessions) {
            expect(session.turnCount).toBeGreaterThan(0);
        }

        const liveTurnCount = getDb()
            .prepare(
                `SELECT COUNT(*) AS count FROM chat_responses
                 WHERE chat_id = $chatId
                   AND json_extract(metadata_json, '$.runtime.agentSessionId') = $sessionId`
            )
            .get(namedParams({ chatId: developmentChatDemoId, sessionId: live.id })) as {
            count: number;
        };
        expect(liveTurnCount.count).toBe(0);
    });

    it('seeds the team demo with two named agent seats and per-seat turns', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        // Both seats are real stored agents with the current default names.
        expect(getStoredAgent(demoAgentId)?.name).toBe('Otto');
        expect(getStoredAgent(demoSecondAgentId)?.name).toBe('Wren');

        const chat = getChat(developmentChatTeamDemoId);
        const agentSeats = chat?.participants.filter((participant) => participant.kind === 'agent');
        expect(new Set(agentSeats?.map((participant) => participant.id))).toEqual(
            new Set([demoAgentId, demoSecondAgentId])
        );

        // One completed turn per seat, each tied to that seat's own session.
        const responses = getDb()
            .prepare(
                `SELECT participant_id,
                        json_extract(metadata_json, '$.runtime.agentSessionId') AS session_id
                 FROM chat_responses WHERE chat_id = $chatId`
            )
            .all(namedParams({ chatId: developmentChatTeamDemoId })) as {
            participant_id: string;
            session_id: string | null;
        }[];
        expect(new Set(responses.map((row) => row.participant_id))).toEqual(
            new Set([demoAgentId, demoSecondAgentId])
        );
        for (const row of responses) {
            expect(row.session_id).toContain(row.participant_id);
        }
    });
});
