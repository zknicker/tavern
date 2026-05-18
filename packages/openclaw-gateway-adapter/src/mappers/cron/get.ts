import { type AgentRuntimeCron, agentRuntimeCronSchema } from '@tavern/api';
import { mapOpenClawCronRecord } from './shared.ts';

export function mapOpenClawCron(input: unknown): AgentRuntimeCron {
    return agentRuntimeCronSchema.parse(mapOpenClawCronRecord(input));
}
