import {
    type AgentRuntimeArchiveAgent,
    agentRuntimeArchiveAgentSchema,
} from '@tavern/agent-runtime-protocol';

export function mapOpenClawDeletedAgent(agentId: string): AgentRuntimeArchiveAgent {
    return agentRuntimeArchiveAgentSchema.parse({
        archived: true,
        id: agentId,
    });
}
