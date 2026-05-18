import { type AgentRuntimeSessionResync, agentRuntimeSessionResyncSchema } from '@tavern/api';

export function mapOpenClawSessionResync(sessionKey: string): AgentRuntimeSessionResync {
    return agentRuntimeSessionResyncSchema.parse({
        resynced: true,
        rootSessionKey: sessionKey,
        sessionKey,
    });
}
