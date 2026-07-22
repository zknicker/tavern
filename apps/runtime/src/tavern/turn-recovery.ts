import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { failAgentTurn } from './agent-turn-store';

const interruptedSummary = 'Interrupted by an agent runtime restart.';

/**
 * Fails turns orphaned mid-run by a Runtime restart. The stream consumer
 * lives in process memory, so a restart mid-turn leaves the turn row running
 * forever. Cursors were never advanced for the lost turn, so the next drain
 * re-delivers from `seen` (I3) — nothing is lost, only re-sent. Queued turns
 * stay queued; the next wake claims them. Runs once at startup.
 */
export function recoverInterruptedAgentTurns(db: Database = getDb()): number {
    const rows = db
        .prepare(
            `SELECT id
             FROM agent_turns
             WHERE status = 'running'`
        )
        .all() as Array<{ id: string }>;

    for (const row of rows) {
        failAgentTurn({ error: interruptedSummary, id: row.id }, db);
    }

    return rows.length;
}
