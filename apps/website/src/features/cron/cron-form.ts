import type { CronGetOutput } from '../../lib/trpc.tsx';
import { createCronFormState as createFormState } from './cron-form-state.ts';

type CronJob = CronGetOutput['job'];

export type CronRunType = 'agentTurn' | 'script' | 'systemEvent';

export type CronScheduleKind = 'custom' | 'daily' | 'interval' | 'weekdays' | 'weekly';

export interface CronFormState {
    agentId: string;
    at: string;
    cronExpr: string;
    cronTz: string;
    deliveryChatId: string;
    description: string;
    enabled: boolean;
    everyMs: string;
    message: string;
    name: string;
    runType: CronRunType;
    scheduleDayOfWeek: string;
    scheduleKind: CronScheduleKind;
    scheduleTime: string;
    scriptCommand: string;
    scriptWorkingDir: string;
    systemEventText: string;
}

export function createCronFormState(
    job: CronJob | null,
    primaryAgentId = '',
    template?: Partial<CronFormState>
): CronFormState {
    return createFormState(job, primaryAgentId, template);
}
