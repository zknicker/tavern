import type {
    AgentRuntimeCron,
    AgentRuntimeCronPayload,
    AgentRuntimeCronSchedule,
    AgentRuntimeCronSummary,
} from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readBoolean,
    readNumber,
    readString,
    requireIsoString,
    requireString,
    toIsoString,
} from '../../gateway/records.ts';

export function mapOpenClawCronSummaryRecord(value: unknown): AgentRuntimeCronSummary {
    const record = asRecord(value);
    const id = requireString(record, ['id', 'jobId'], 'OpenClaw cron job');
    const state = asRecord(record.state);

    return {
        agentId: readString(record, ['agentId', 'agent']),
        description: readString(record, ['description']),
        enabled:
            !readBoolean(record, ['disabled'], false) && readBoolean(record, ['enabled'], true),
        id,
        name: readString(record, ['name', 'title']) ?? id,
        schedule: mapOpenClawSchedule(record),
        state: {
            consecutiveErrors: readNumber(state, ['consecutiveErrors']) ?? undefined,
            lastDelivered: readBoolean(state, ['lastDelivered'], false) || undefined,
            lastDeliveryError: readString(state, ['lastDeliveryError']) ?? undefined,
            lastDeliveryStatus: mapOpenClawDeliveryStatus(
                readString(state, ['lastDeliveryStatus'])
            ),
            lastDurationMs: readNumber(state, ['lastDurationMs']) ?? undefined,
            lastErrorMessage: readString(state, ['lastError']) ?? undefined,
            lastRunAtMs:
                readNumber(state, ['lastRunAtMs']) ??
                readNumber(record, ['lastRunAtMs']) ??
                undefined,
            lastRunStatus: mapOpenClawExecutionStatus(readString(state, ['lastRunStatus'])),
            lastStatus: mapOpenClawExecutionStatus(readString(state, ['lastStatus'])),
            nextRunAtMs:
                readNumber(state, ['nextRunAtMs']) ??
                readNumber(record, ['nextRunAtMs', 'nextRun']) ??
                undefined,
        },
        updatedAt:
            toIsoString(record.updatedAt ?? record.updatedAtMs) ??
            requireIsoString(record.createdAt ?? record.createdAtMs, `OpenClaw cron job ${id}`),
    };
}

export function mapOpenClawCronRecord(value: unknown): AgentRuntimeCron {
    const record = asRecord(value);
    const summary = mapOpenClawCronSummaryRecord(record);

    return {
        ...summary,
        createdAt: toIsoString(record.createdAt ?? record.createdAtMs) ?? summary.updatedAt,
        deleteAfterRun: readBoolean(record, ['deleteAfterRun', 'delete_after_run'], false),
        delivery: mapOpenClawDelivery(record),
        payload: mapOpenClawPayload(record),
        wakeMode:
            readString(record, ['wakeMode', 'wake']) === 'next-heartbeat'
                ? 'next-heartbeat'
                : 'now',
    };
}

export function mapTavernScheduleToOpenClaw(schedule: AgentRuntimeCronSchedule) {
    switch (schedule.kind) {
        case 'at':
            return { at: schedule.at };
        case 'cron':
            return { cron: schedule.expr, tz: schedule.tz };
        case 'every':
            return { everyMs: schedule.everyMs };
    }
}

export function mapTavernPayloadToOpenClaw(payload: AgentRuntimeCronPayload) {
    if (payload.kind === 'systemEvent') {
        return {
            systemEvent: payload.text,
        };
    }

    return {
        message: payload.message,
        model: payload.model,
        thinking: payload.thinking,
        timeoutSeconds: payload.timeoutSeconds,
    };
}

function mapOpenClawSchedule(record: Record<string, unknown>): AgentRuntimeCronSchedule {
    const schedule = asRecord(record.schedule);
    const at = readString(record, ['at']);
    const scheduledAt = readString(schedule, ['at']);

    if (scheduledAt || at) {
        return { at: scheduledAt ?? at ?? unreachableSchedule(), kind: 'at' };
    }

    const everyMs = readNumber(schedule, ['everyMs']) ?? readNumber(record, ['everyMs']);

    if (everyMs && everyMs > 0) {
        return { everyMs, kind: 'every' };
    }

    const expr = readString(schedule, ['expr', 'cron']) ?? readString(record, ['cron', 'expr']);

    if (!expr) {
        throw new Error('OpenClaw cron job is missing a cron schedule expression.');
    }

    return {
        expr,
        kind: 'cron',
        tz:
            readString(schedule, ['tz', 'timezone']) ??
            readString(record, ['tz', 'timezone']) ??
            undefined,
    };
}

function unreachableSchedule(): never {
    throw new Error('OpenClaw cron job is missing a schedule.');
}

function mapOpenClawPayload(record: Record<string, unknown>): AgentRuntimeCronPayload {
    const payload = asRecord(record.payload);
    const systemEvent =
        readString(payload, ['systemEvent', 'system_event', 'text']) ??
        readString(record, ['systemEvent', 'system_event']);

    if (readString(payload, ['kind']) === 'systemEvent' && systemEvent) {
        return {
            kind: 'systemEvent',
            text: systemEvent,
        };
    }

    return {
        kind: 'agentTurn',
        message:
            readString(payload, ['message', 'prompt']) ??
            requireString(record, ['message', 'prompt'], 'OpenClaw cron agent-turn payload'),
        model: readString(payload, ['model']) ?? readString(record, ['model']) ?? undefined,
        thinking: readString(payload, ['thinking']) ?? readString(record, ['thinking']) ?? null,
        timeoutSeconds:
            readNumber(payload, ['timeoutSeconds']) ??
            readNumber(record, ['timeoutSeconds']) ??
            undefined,
    };
}

function mapOpenClawDelivery(record: Record<string, unknown>): AgentRuntimeCron['delivery'] {
    const delivery = asRecord(record.delivery);
    const mode = readString(delivery, ['mode']);

    if (mode === 'none') {
        return null;
    }

    const channel = readString(delivery, ['channel']) ?? readString(record, ['channel']);
    const target = readString(delivery, ['to', 'target']) ?? readString(record, ['to', 'target']);

    if (!target) {
        return null;
    }

    if (!channel || target.startsWith(`${channel}:`)) {
        return { chatId: target };
    }

    return { chatId: `${channel}:${target}` };
}

function mapOpenClawExecutionStatus(status: string | null) {
    if (
        status === 'queued' ||
        status === 'running' ||
        status === 'success' ||
        status === 'skipped'
    ) {
        return status;
    }

    if (status === 'ok') {
        return 'success';
    }

    return status === 'error' || status === 'failed' ? 'error' : undefined;
}

function mapOpenClawDeliveryStatus(status: string | null) {
    if (
        status === 'pending' ||
        status === 'delivered' ||
        status === 'session_queued' ||
        status === 'failed' ||
        status === 'parent_missing' ||
        status === 'not_applicable'
    ) {
        return status;
    }

    if (status === 'not-requested' || status === 'unknown') {
        return 'not_applicable';
    }

    return undefined;
}
