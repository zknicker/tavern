import type { AgentRuntimeAgentPresence } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { listUnsettledAgentTurns } from './agent-turn-store.ts';
import { listStoredAgents } from './agents-store.ts';

// Agent presence (specs/presence.md): one busy/idle fact per agent,
// projected from the turn queue. Busy covers queued turns too — mid-drain
// gaps must not flicker idle. Floating turns (I1) carry no chat anchor;
// chat-level UI shows only the composition stream.
export function listAgentPresence(db: Database = getDb()): AgentRuntimeAgentPresence[] {
    const unsettledByAgentId = new Map<string, { pendingTurns: number; since: string }>();
    for (const turn of listUnsettledAgentTurns(db)) {
        const existing = unsettledByAgentId.get(turn.agentId);
        if (existing) {
            existing.pendingTurns += 1;
        } else {
            unsettledByAgentId.set(turn.agentId, {
                pendingTurns: 1,
                since: turn.startedAt ?? turn.createdAt,
            });
        }
    }

    return listStoredAgents(db).agents.map((agent) => {
        const unsettled = unsettledByAgentId.get(agent.id);
        if (!unsettled) {
            return {
                agentId: agent.id,
                pendingTurns: 0,
                since: null,
                state: 'idle' as const,
            };
        }
        return {
            agentId: agent.id,
            pendingTurns: unsettled.pendingTurns,
            since: unsettled.since,
            state: 'busy' as const,
        };
    });
}
