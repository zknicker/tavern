import { listSessionProjections, parseSessionProjection } from '../storage/sessions.ts';
import { getLatestTimestamp } from '../utils/time.ts';
import { listAgents } from './catalog.ts';
import type { AgentActivity } from './contracts.ts';

export async function listAgentActivity(): Promise<AgentActivity[]> {
    const [agents, sessionRecords] = await Promise.all([listAgents(), listSessionProjections()]);
    const sessions = sessionRecords.flatMap((record) => {
        const session = parseSessionProjection(record);
        return session ? [session] : [];
    });
    const latestSessionAtByAgent = new Map<string, string>();

    for (const session of sessions) {
        const latestSessionAt = session.lastActivityAt ?? session.startedAt;

        if (!latestSessionAt) {
            continue;
        }

        latestSessionAtByAgent.set(
            session.agentId,
            getLatestTimestamp(latestSessionAtByAgent.get(session.agentId) ?? null, latestSessionAt)
        );
    }

    return agents
        .map((agent) => ({
            agentId: agent.id,
            state: 'idle' as AgentActivity['state'],
            updatedAt: latestSessionAtByAgent.get(agent.id) ?? null,
        }))
        .sort((left, right) => left.agentId.localeCompare(right.agentId));
}
