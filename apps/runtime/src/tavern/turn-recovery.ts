import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { readCurrentAgentSession } from './agent-session-store';
import { failAgentTurn } from './agent-turn-store';
import { listStoredAgents } from './agents-store';
import {
    listInboxPierces,
    listPendingInboxTargets,
    resetInboxPiercesForRun,
} from './inbox-cursors';

const interruptedSummary = 'Interrupted by an agent runtime restart.';

/**
 * Fails turns orphaned mid-run by a Runtime restart. The stream consumer
 * lives in process memory, so a restart mid-turn leaves the turn row running
 * forever. Cursors were never advanced for the lost turn, so the next drain
 * re-delivers from `seen` (I3) — nothing is lost, only re-sent. Queued turns
 * stay queued and all pending work requests a wake. Runs once at startup.
 */
export function recoverInterruptedAgentTurns(db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT id, agent_id, agent_session_id
             FROM agent_turns
             WHERE status = 'running'`
        )
        .all() as Array<{ agent_id: string; agent_session_id: string; id: string }>;
    const agentIdsToWake = new Set<string>();

    for (const row of rows) {
        failAgentTurn({ error: interruptedSummary, id: row.id }, db);
        resetInboxPiercesForRun({ runId: row.id, sessionId: row.agent_session_id }, db);
        if (hasPendingInbox(row.agent_session_id, db)) {
            agentIdsToWake.add(row.agent_id);
        }
    }

    const queued = db
        .prepare("SELECT DISTINCT agent_id FROM agent_turns WHERE status = 'queued'")
        .all() as Array<{ agent_id: string }>;
    for (const row of queued) {
        agentIdsToWake.add(row.agent_id);
    }

    for (const agent of listStoredAgents(db).agents) {
        const session = readCurrentAgentSession({ agentId: agent.id, db });
        if (session && hasPendingInbox(session.id, db)) {
            agentIdsToWake.add(agent.id);
        }
    }

    return { agentIdsToWake, recoveredTurnCount: rows.length };
}

function hasPendingInbox(sessionId: string, db: Database) {
    return (
        listPendingInboxTargets(sessionId, db).length > 0 ||
        listInboxPierces(sessionId, { excludeServed: true }, db).length > 0
    );
}
