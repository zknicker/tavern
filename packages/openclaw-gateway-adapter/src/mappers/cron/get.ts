import { type AgentRuntimeCron, agentRuntimeCronSchema } from '@tavern/agent-runtime-protocol';
import { mapOpenClawCronRecord } from './shared.ts';

export function mapOpenClawCron(input: unknown): AgentRuntimeCron {
    return agentRuntimeCronSchema.parse(mapOpenClawCronRecord(input));
}
