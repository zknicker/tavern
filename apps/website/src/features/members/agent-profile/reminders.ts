import type { CronListOutput } from '../../../lib/trpc.tsx';

export function selectAgentReminders(jobs: CronListOutput['jobs'], agentId: string) {
    return jobs.filter((job) => job.agentId === agentId);
}
