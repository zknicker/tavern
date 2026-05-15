import {
    type AgentRuntimeCronRun,
    agentRuntimeCronRunSchema,
} from '@tavern/agent-runtime-protocol';
import { mapOpenClawCronRunRecord } from './runs.ts';

export function mapOpenClawCronRun(input: unknown, jobId: string): AgentRuntimeCronRun {
    return agentRuntimeCronRunSchema.parse(mapOpenClawCronRunRecord(input, jobId));
}
