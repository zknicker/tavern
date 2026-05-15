import { type AgentRuntimeAgent, agentRuntimeAgentSchema } from '@tavern/agent-runtime-protocol';
import { findOpenClawAgent, mapOpenClawAgentRecord } from './shared.ts';

export function mapOpenClawAgentConfig(input: {
    agentId: string;
    agents: unknown;
}): AgentRuntimeAgent {
    const agent = findOpenClawAgent(input.agents, input.agentId) ?? { id: input.agentId };
    return agentRuntimeAgentSchema.parse(mapOpenClawAgentRecord(agent));
}
