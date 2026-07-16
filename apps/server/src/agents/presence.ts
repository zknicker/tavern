import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import { listAgents } from './catalog.ts';
import type { AgentPresence } from './contracts.ts';

// Agent presence (specs/presence.md): proxied from Runtime, which projects
// it from the turn queue. Without a reachable Runtime every agent reads
// idle — presence is volatile runtime state, never invented.
export async function listAgentPresence(): Promise<AgentPresence[]> {
    const client = createConfiguredAgentRuntimeClient();
    if (client) {
        try {
            return (await client.listAgentPresence()).presence;
        } catch {
            // Fall through to the idle projection below.
        } finally {
            client.close();
        }
    }
    const agents = await listAgents();
    return agents
        .map((agent) => ({
            agentId: agent.id,
            chatId: null,
            chatTitle: null,
            pendingTurns: 0,
            since: null,
            state: 'idle' as const,
        }))
        .sort((left, right) => left.agentId.localeCompare(right.agentId));
}
