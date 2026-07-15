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
    const anchorByAgentId = new Map<string, { chatId: string; since: string }>();
    for (const turn of listUnsettledAgentTurns(db)) {
        if (!anchorByAgentId.has(turn.agentId)) {
            anchorByAgentId.set(turn.agentId, {
                chatId: turn.chatId,
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
                since: null,
                state: 'idle' as const,
            };
        }
        return {
            agentId: agent.id,
            chatId: anchor.chatId,
            chatTitle: getChat(anchor.chatId, db)?.title ?? null,
            since: anchor.since,
            state: 'busy' as const,
        };
    });
}
