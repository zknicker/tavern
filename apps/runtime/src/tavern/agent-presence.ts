import type { AgentRuntimeAgentPresence } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { listUnsettledAgentTurns } from './agent-turn-store.ts';
import { listStoredAgents } from './agents-store.ts';
import { getChat } from './chat-api/index.ts';

// Agent presence (specs/presence.md): one busy/idle fact per agent,
// projected from the turn queue. Busy covers queued turns too — a seat is
// busy exactly when its agent is busy, and mid-drain gaps must not flicker
// idle. The anchor chat is the running turn's chat, or the oldest queued
// chat while nothing runs.
export function listAgentPresence(db: Database = getDb()): AgentRuntimeAgentPresence[] {
    const anchorByAgentId = new Map<
        string,
        { chatId: string; pendingTurns: number; since: string }
    >();
    for (const turn of listUnsettledAgentTurns(db)) {
        const anchor = anchorByAgentId.get(turn.agentId);
        if (anchor) {
            anchor.pendingTurns += 1;
        } else {
            anchorByAgentId.set(turn.agentId, {
                chatId: turn.chatId,
                pendingTurns: 1,
                since: turn.startedAt ?? turn.createdAt,
            });
        }
    }

    return listStoredAgents(db).agents.map((agent) => {
        const anchor = anchorByAgentId.get(agent.id);
        if (!anchor) {
            return {
                agentId: agent.id,
                chatId: null,
                chatTitle: null,
                pendingTurns: 0,
                since: null,
                state: 'idle' as const,
            };
        }
        return {
            agentId: agent.id,
            chatId: anchor.chatId,
            chatTitle: getChat(anchor.chatId, db)?.title ?? null,
            pendingTurns: anchor.pendingTurns,
            since: anchor.since,
            state: 'busy' as const,
        };
    });
}
