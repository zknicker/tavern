import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    ensureCurrentAgentSession,
    readCurrentAgentSession,
    updateAgentSessionRuntimeState,
} from './agent-session-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { ensureFreshAgentSession } from './session-freshness.ts';

describe('session freshness', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
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
    });

    afterEach(() => {
        closeDb();
    });

    it('never rotates a session that has run within seven days', () => {
        const session = ensureCurrentAgentSession({ agentId: 'agt_primary' });
        updateAgentSessionRuntimeState({
            id: session.id,
            now: '2026-06-25T12:00:00.000Z',
            resumeState: { engine: 'state' },
            runtimeSessionId: 'ses_engine',
        });

        // Two days later — well past the retired daily/24h policies.
        const rotated = ensureFreshAgentSession({
            agentId: 'agt_primary',
            now: new Date('2026-06-27T12:00:00.000Z'),
        });

        expect(rotated).toBeNull();
        expect(readCurrentAgentSession({ agentId: 'agt_primary' })?.id).toBe(session.id);
    });

    it('starts fresh after seven fully idle days (safety valve)', () => {
        const session = ensureCurrentAgentSession({ agentId: 'agt_primary' });
        updateAgentSessionRuntimeState({
            id: session.id,
            now: '2026-06-20T12:00:00.000Z',
            resumeState: { engine: 'state' },
            runtimeSessionId: 'ses_engine',
        });

        const rotated = ensureFreshAgentSession({
            agentId: 'agt_primary',
            now: new Date('2026-06-28T12:00:00.000Z'),
        });

        expect(rotated).toBe('idle');
        const current = readCurrentAgentSession({ agentId: 'agt_primary' });
        expect(current?.id).not.toBe(session.id);
        expect(current?.generation).toBe(2);
    });

    it('leaves sessions that never ran a turn untouched', () => {
        const session = ensureCurrentAgentSession({
            agentId: 'agt_primary',
            now: '2026-06-01T12:00:00.000Z',
        });

        const rotated = ensureFreshAgentSession({
            agentId: 'agt_primary',
            now: new Date('2026-06-28T12:00:00.000Z'),
        });

        expect(rotated).toBeNull();
        expect(readCurrentAgentSession({ agentId: 'agt_primary' })?.id).toBe(session.id);
    });
});
