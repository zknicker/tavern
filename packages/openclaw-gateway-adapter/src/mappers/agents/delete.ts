import { type AgentRuntimeArchiveAgent, agentRuntimeArchiveAgentSchema } from '@tavern/api';

export function mapOpenClawDeletedAgent(agentId: string): AgentRuntimeArchiveAgent {
    return agentRuntimeArchiveAgentSchema.parse({
        archived: true,
        id: agentId,
    });
}
