import {
    developmentChatDemoId,
    developmentChatTeamDemoId,
    developmentChatWidgetsDemoId,
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
            agentId: 'agt_primary',
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
        // A real live session coexists with the seeded demo lineage; the
        // seeder must never touch it.
        const live = startNewAgentSession({
            agentId: 'agt_primary',
            now: '2026-07-06T12:00:00.000Z',
        });
        // Real sessions continue after the seeded demo lineage.
        expect(live.id).toBe('ags_agt_primary_5');

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
            agentId: 'agt_primary',
            currentSessionId: live.id,
        });
        expect(pastSessions.map((session) => session.id)).toEqual([
            'ags_agt_primary_demo_4',
            'ags_agt_primary_demo_3',
            'ags_agt_primary_demo_2',
            'ags_agt_primary_demo_1',
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

    it('seeds the widgets gallery channel with one widget activity per catalog entry', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        // Idempotent across restarts: reseeding leaves the same stable rows.
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(getChat(developmentChatWidgetsDemoId)?.title).toBe('widgets');

        const activities = getDb()
            .prepare(
                `SELECT id, json_extract(metadata_json, '$.widget.component') AS component
                 FROM chat_response_activity
                 WHERE chat_id = $chatId AND kind = 'widget'
                 ORDER BY id ASC`
            )
            .all(namedParams({ chatId: developmentChatWidgetsDemoId })) as {
            component: string;
            id: string;
        }[];

        // Every catalog widget renders once, the table twice (keyed + matrix
        // shorthand), plus the intentionally invalid fallback payload.
        expect(activities.map((row) => row.component).sort()).toEqual(
            [
                'tavern.widget.bar-chart',
                'tavern.widget.calendar-day',
                'tavern.widget.calendar-event',
                'tavern.widget.composed-chart',
                'tavern.widget.html-preview',
                'tavern.widget.line-chart',
                'tavern.widget.merchbase-sales-chart',
                'tavern.widget.orbit-map',
                'tavern.widget.artifact',
                'tavern.widget.table',
                'tavern.widget.table',
            ].sort()
        );
    });
});
