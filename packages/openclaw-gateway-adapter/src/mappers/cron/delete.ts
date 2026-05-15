import {
    type AgentRuntimeArchiveCron,
    agentRuntimeArchiveCronSchema,
} from '@tavern/agent-runtime-protocol';

export function mapOpenClawDeletedCron(jobId: string): AgentRuntimeArchiveCron {
    return agentRuntimeArchiveCronSchema.parse({
        archived: true,
        id: jobId,
    });
}
