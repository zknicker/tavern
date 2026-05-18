import { type AgentRuntimeArchiveCron, agentRuntimeArchiveCronSchema } from '@tavern/api';

export function mapOpenClawDeletedCron(jobId: string): AgentRuntimeArchiveCron {
    return agentRuntimeArchiveCronSchema.parse({
        archived: true,
        id: jobId,
    });
}
