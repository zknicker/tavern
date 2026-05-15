import {
    type AgentRuntimeCronRun,
    type AgentRuntimeCronRunList,
    agentRuntimeCronRunListSchema,
} from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readRecordArray,
    readString,
    requireIsoString,
    requireString,
    toIsoString,
} from '../../gateway/records.ts';

export function mapOpenClawCronRuns(
    input: unknown,
    fallbackJobId?: string
): AgentRuntimeCronRunList {
    const record = asRecord(input);
    const runs = readRecordArray(record, ['runs', 'items', 'entries']).map((run) =>
        mapOpenClawCronRunRecord(run, fallbackJobId)
    );

    return agentRuntimeCronRunListSchema.parse({ runs });
}

export function mapOpenClawCronRunRecord(
    input: unknown,
    fallbackJobId?: string
): AgentRuntimeCronRun {
    const record = asRecord(input);
    const jobId =
        readString(record, ['jobId']) ??
        fallbackJobId ??
        requireString(record, ['cronId'], 'OpenClaw cron run');
    const runAt = toIsoString(record.runAtMs ?? record.run_at_ms);
    const scheduledFor =
        toIsoString(record.scheduledFor ?? record.scheduled_at) ??
        runAt ??
        requireIsoString(record.ts, `OpenClaw cron run ${jobId}`);
    const startedAt = toIsoString(record.startedAt ?? record.started_at) ?? runAt;
    const finishedAt = toIsoString(record.finishedAt ?? record.finished_at ?? record.ts);
    const sessionId = readString(record, ['sessionId']);
    const sessionKey = readString(record, ['sessionKey']);
    const trigger = mapRunTrigger(readString(record, ['trigger']));
    const id =
        readString(record, ['id', 'runId']) ??
        sessionKey ??
        sessionId ??
        buildCronRunNaturalId({
            jobId,
            scheduledFor,
            trigger,
        });

    if (!id) {
        throw new Error(`OpenClaw cron run ${jobId} is missing a stable id.`);
    }

    return {
        deliveryError: readString(record, ['deliveryError']),
        deliveryStatus: mapDeliveryStatus(readString(record, ['deliveryStatus'])),
        executionErrorCode: null,
        executionErrorMessage: readString(record, ['error', 'errorMessage']),
        finishedAt,
        id,
        jobId,
        scheduledFor,
        sessionId,
        sessionKey,
        startedAt,
        status: mapRunStatus(readString(record, ['status', 'state'])),
        summary: readString(record, ['summary']),
        trigger,
    };
}

function buildCronRunNaturalId(input: {
    jobId: string;
    scheduledFor: string;
    trigger: AgentRuntimeCronRun['trigger'];
}) {
    return `cron:${input.jobId}:${input.trigger}:${input.scheduledFor}`;
}

function mapRunStatus(status: string | null): AgentRuntimeCronRun['status'] {
    if (
        status === 'queued' ||
        status === 'running' ||
        status === 'success' ||
        status === 'skipped'
    ) {
        return status;
    }

    return status === 'error' || status === 'failed' ? 'error' : 'success';
}

function mapRunTrigger(trigger: string | null): AgentRuntimeCronRun['trigger'] {
    if (
        trigger === 'manual' ||
        trigger === 'recovery' ||
        trigger === 'retry' ||
        trigger === 'schedule'
    ) {
        return trigger;
    }

    return 'schedule';
}

function mapDeliveryStatus(status: string | null): AgentRuntimeCronRun['deliveryStatus'] {
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

    if (status === 'not-requested') {
        return 'not_applicable';
    }

    return null;
}
