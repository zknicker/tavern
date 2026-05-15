import {
    type AgentRuntimeSessionResync,
    agentRuntimeSessionResyncSchema,
} from '@tavern/agent-runtime-protocol';

export function mapOpenClawSessionResync(sessionKey: string): AgentRuntimeSessionResync {
    return agentRuntimeSessionResyncSchema.parse({
        resynced: true,
        rootSessionKey: sessionKey,
        sessionKey,
    });
}
