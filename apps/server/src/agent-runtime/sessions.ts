import type {
    AgentRuntimeSession,
    AgentRuntimeSessionGraph,
    AgentRuntimeSessionMessageList,
} from '@tavern/agent-runtime-protocol';
import type { TavernAgentRuntimeClient } from './client.ts';
import { AgentRuntimeRequestError } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

export async function listAgentRuntimeSessions(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeSession[] | null> {
    if (!client) {
        return null;
    }

    return (await client.listSessions()).sessions;
}

export async function getAgentRuntimeSession(
    id: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeSession | null> {
    const sessions = await listAgentRuntimeSessions(client);

    if (!sessions) {
        return null;
    }

    return sessions.find((session) => session.key === id) ?? null;
}

export async function getAgentRuntimeSessionGraph(
    sessionKey: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeSessionGraph | null> {
    if (!client) {
        return null;
    }

    try {
        return await client.getSessionGraph(sessionKey);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}

export async function listAgentRuntimeSessionMessages(
    sessionKey: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeSessionMessageList | null> {
    if (!client) {
        return null;
    }

    try {
        return await client.listSessionMessages(sessionKey);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}
