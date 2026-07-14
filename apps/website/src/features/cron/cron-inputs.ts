import type { CronFormState } from './cron-form.ts';

function requireValue(value: string, label: string) {
    const trimmed = value.trim();

    if (!trimmed) {
        throw new Error(`${label} is required.`);
    }

    return trimmed;
}

function buildSchedule(state: CronFormState) {
    if (state.scheduleKind === 'interval') {
        const everyMs = Number(requireValue(state.everyMs, 'Interval'));

        if (!Number.isFinite(everyMs) || everyMs <= 0) {
            throw new Error('Interval must be a positive number of milliseconds.');
        }

        return {
            everyMs,
            kind: 'interval' as const,
        };
    }

    if (state.scheduleKind === 'daily' || state.scheduleKind === 'weekdays') {
        return {
            kind: state.scheduleKind,
            time: requireValue(state.scheduleTime, 'Time'),
            tz: state.cronTz.trim() || undefined,
        };
    }

    if (state.scheduleKind === 'weekly') {
        const dayOfWeek = Number(requireValue(state.scheduleDayOfWeek, 'Day'));

        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            throw new Error('Day must be a valid weekday.');
        }

        return {
            dayOfWeek,
            kind: 'weekly' as const,
            time: requireValue(state.scheduleTime, 'Time'),
            tz: state.cronTz.trim() || undefined,
        };
    }

    return {
        expr: requireValue(state.cronExpr, 'Cron expression'),
        kind: 'custom' as const,
        tz: state.cronTz.trim() || undefined,
    };
}

function buildDelivery(state: CronFormState) {
    return {
        chatId: requireValue(state.deliveryChatId, 'Delivery chat'),
    };
}

function buildPayload(state: CronFormState) {
    if (state.runType === 'systemEvent') {
        return {
            kind: 'systemEvent' as const,
            text: requireValue(state.systemEventText, 'System event text'),
        };
    }

    if (state.runType === 'script') {
        return {
            command: requireValue(state.scriptCommand, 'Script'),
            kind: 'script' as const,
            workingDir: state.scriptWorkingDir.trim() || undefined,
        };
    }

    return {
        kind: 'agentTurn' as const,
        message: requireValue(state.message, 'Prompt'),
    };
}

export function buildCronCreateInput(state: CronFormState) {
    return {
        agentId: requireValue(state.agentId, 'Agent'),
        deleteAfterRun: false,
        delivery: buildDelivery(state),
        description: state.description.trim() || undefined,
        enabled: state.enabled,
        name: requireValue(state.name, 'Name'),
        payload: buildPayload(state),
        scheduleConfig: buildSchedule(state),
    };
}

export function buildCronUpdateInput(jobId: string, state: CronFormState) {
    return {
        jobId,
        patch: {
            agentId: requireValue(state.agentId, 'Agent'),
            deleteAfterRun: false,
            delivery: buildDelivery(state),
            description: state.description.trim() || null,
            enabled: state.enabled,
            name: requireValue(state.name, 'Name'),
            payload: buildPayload(state),
            scheduleConfig: buildSchedule(state),
        },
    };
}
