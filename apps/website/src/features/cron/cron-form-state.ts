import type { CronGetOutput } from '../../lib/trpc.tsx';
import type { CronFormState, CronScheduleKind } from './cron-form.ts';

type CronJob = CronGetOutput['job'];

const defaultScheduleTime = '09:00';
const defaultWeekday = '1';

function getLocalTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatTime(hour: string, minute: string) {
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function getCronPreset(expr: string): {
    scheduleDayOfWeek: string;
    scheduleKind: CronScheduleKind;
    scheduleTime: string;
} | null {
    const match = expr.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\*|1-5|[0-6])$/);

    if (!match) {
        return null;
    }

    const [, minute = '0', hour = '0', dayOfWeek = '*'] = match;
    const time = formatTime(hour, minute);

    if (dayOfWeek === '*') {
        return {
            scheduleDayOfWeek: defaultWeekday,
            scheduleKind: 'daily',
            scheduleTime: time,
        };
    }

    if (dayOfWeek === '1-5') {
        return {
            scheduleDayOfWeek: defaultWeekday,
            scheduleKind: 'weekdays',
            scheduleTime: time,
        };
    }

    return {
        scheduleDayOfWeek: dayOfWeek,
        scheduleKind: 'weekly',
        scheduleTime: time,
    };
}

function getScheduleState(job: CronJob | null) {
    if (!job) {
        return {
            at: '',
            cronExpr: '',
            cronTz: getLocalTimezone(),
            everyMs: '',
            scheduleDayOfWeek: defaultWeekday,
            scheduleKind: 'daily' as const,
            scheduleTime: defaultScheduleTime,
        };
    }

    if (job.schedule.kind === 'at') {
        return {
            at: job.schedule.at,
            cronExpr: '',
            cronTz: getLocalTimezone(),
            everyMs: '',
            scheduleDayOfWeek: defaultWeekday,
            scheduleKind: 'custom' as const,
            scheduleTime: defaultScheduleTime,
        };
    }

    if (job.schedule.kind === 'every') {
        return {
            at: '',
            cronExpr: '',
            cronTz: getLocalTimezone(),
            everyMs: String(job.schedule.everyMs),
            scheduleDayOfWeek: defaultWeekday,
            scheduleKind: 'interval' as const,
            scheduleTime: defaultScheduleTime,
        };
    }

    const preset = getCronPreset(job.schedule.expr);

    if (preset) {
        return {
            at: '',
            cronExpr: job.schedule.expr,
            cronTz: job.schedule.tz ?? getLocalTimezone(),
            everyMs: '',
            ...preset,
        };
    }

    return {
        at: '',
        cronExpr: job.schedule.expr,
        cronTz: job.schedule.tz ?? getLocalTimezone(),
        everyMs: '',
        scheduleDayOfWeek: defaultWeekday,
        scheduleKind: 'custom' as const,
        scheduleTime: defaultScheduleTime,
    };
}

export function createCronFormState(job: CronJob | null, primaryAgentId = ''): CronFormState {
    const scheduleState = getScheduleState(job);

    return {
        agentId: job?.agentId ?? primaryAgentId,
        at: scheduleState.at,
        cronExpr: scheduleState.cronExpr,
        cronTz: scheduleState.cronTz,
        deliveryChatId: job?.delivery?.chatId ?? '',
        description: job?.description ?? '',
        enabled: job?.enabled ?? true,
        everyMs: scheduleState.everyMs,
        message: job?.payload.kind === 'agentTurn' ? job.payload.message : '',
        name: job?.name ?? '',
        runType: job?.payload.kind ?? 'agentTurn',
        scheduleDayOfWeek: scheduleState.scheduleDayOfWeek,
        scheduleKind: scheduleState.scheduleKind,
        scheduleTime: scheduleState.scheduleTime,
        scriptCommand: job?.payload.kind === 'script' ? job.payload.command : '',
        scriptWorkingDir: job?.payload.kind === 'script' ? (job.payload.workingDir ?? '') : '',
        systemEventText: job?.payload.kind === 'systemEvent' ? job.payload.text : '',
    };
}
