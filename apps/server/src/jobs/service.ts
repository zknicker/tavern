import { TRPCError } from '@trpc/server';
import type { JobSchedule as DefinedJobSchedule } from '../../../../jobs/define-job.ts';
import type { RegisteredJobSlug } from '../../../../jobs/index.ts';
import {
    getJobExecutionLogs,
    type JobExecution,
    listRecentJobExecutions,
} from '../storage/jobs.ts';
import type {
    JobDetail,
    JobRunDetail,
    JobRunEvent,
    JobRunSummary,
    JobSummary,
} from './contracts.ts';
import { getJobBinding, getRegisteredJobDefinitions } from './manager.ts';

const recentRunWindowMs = 24 * 60 * 60 * 1000;

function getRecentRunWindowStart() {
    return new Date(Date.now() - recentRunWindowMs).toISOString();
}

function toDurationMs(startedAt: string | null, finishedAt: string | null) {
    if (!(startedAt && finishedAt)) {
        return null;
    }

    const startedAtMs = new Date(startedAt).getTime();
    const finishedAtMs = new Date(finishedAt).getTime();

    if (Number.isNaN(startedAtMs) || Number.isNaN(finishedAtMs)) {
        return null;
    }

    return Math.max(0, finishedAtMs - startedAtMs);
}

function mapExecutionRecordToSummary(record: JobExecution): JobRunSummary {
    return {
        attemptsMade: record.attemptsMade,
        createdAt: record.createdAt,
        durationMs: toDurationMs(record.startedAt, record.finishedAt),
        error: record.error,
        finishedAt: record.finishedAt,
        id: record.id,
        progress: record.progress,
        startedAt: record.startedAt,
        state: record.state as JobRunSummary['state'],
    };
}

function mapExecutionRecordToDetail(record: JobExecution): JobRunDetail {
    return {
        ...mapExecutionRecordToSummary(record),
        logs: getJobExecutionLogs(record),
    };
}

function summarizeRecentRuns(recentRuns: JobRunSummary[]): JobSummary['counts'] {
    return recentRuns.reduce(
        (counts, run) => {
            switch (run.state) {
                case 'active':
                    counts.active += 1;
                    break;
                case 'completed':
                    counts.completed += 1;
                    break;
                case 'delayed':
                    counts.delayed += 1;
                    break;
                case 'failed':
                    counts.failed += 1;
                    break;
                case 'waiting':
                    counts.waiting += 1;
                    break;
                case 'unknown':
                    break;
                default:
                    break;
            }

            return counts;
        },
        {
            active: 0,
            completed: 0,
            delayed: 0,
            failed: 0,
            waiting: 0,
        }
    );
}

async function getSchedule(
    slug: RegisteredJobSlug,
    schedule: DefinedJobSchedule
): Promise<JobSummary['schedule']> {
    if (schedule.kind !== 'interval') {
        return schedule;
    }

    const binding = await getJobBinding(slug);
    const scheduler = await binding.queue.getJobScheduler(slug);

    return {
        ...schedule,
        nextRunAt: scheduler ? new Date(scheduler.next).toISOString() : null,
    };
}

async function buildJobSummary(slug: RegisteredJobSlug): Promise<JobSummary> {
    const binding = await getJobBinding(slug);
    const [records, enabled] = await Promise.all([
        listRecentJobExecutions({
            jobSlug: slug,
            since: getRecentRunWindowStart(),
        }),
        binding.definition.isEnabled(),
    ]);
    const recentRuns = records.map((record) => mapExecutionRecordToSummary(record));

    return {
        availability: enabled ? 'enabled' : 'disabled',
        counts: summarizeRecentRuns(recentRuns),
        description: binding.definition.description,
        displayName: binding.definition.displayName,
        latestRun: recentRuns[0] ?? null,
        queueName: binding.definition.slug,
        schedule: await getSchedule(slug, binding.definition.schedule),
        slug,
    };
}

export async function listJobs() {
    const jobs = await Promise.all(
        getRegisteredJobDefinitions().map(async (definition) => buildJobSummary(definition.slug))
    );

    return {
        jobs,
    };
}

export async function getJobDetail(slug: RegisteredJobSlug): Promise<JobDetail> {
    const summary = await buildJobSummary(slug);
    const records = await listRecentJobExecutions({
        jobSlug: slug,
        since: getRecentRunWindowStart(),
    });

    return {
        ...summary,
        recentRuns: records.map((record) => mapExecutionRecordToDetail(record)),
    };
}

export async function listRecentRuns() {
    const records = await listRecentJobExecutions({
        since: getRecentRunWindowStart(),
    });
    const runs: JobRunEvent[] = records.map((record) => {
        const summary = mapExecutionRecordToSummary(record);

        return {
            attemptsMade: summary.attemptsMade,
            createdAt: summary.createdAt,
            durationMs: summary.durationMs,
            error: summary.error,
            finishedAt: summary.finishedAt,
            id: summary.id,
            jobDisplayName: record.jobDisplayName,
            jobSlug: record.jobSlug as RegisteredJobSlug,
            progress: summary.progress,
            startedAt: summary.startedAt,
            state: summary.state,
        };
    });

    return { runs };
}

export async function runJob(
    slug: RegisteredJobSlug,
    payload: Record<string, unknown> | undefined
) {
    const binding = await getJobBinding(slug);

    if (!(await binding.definition.isEnabled())) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Job "${slug}" is currently disabled.`,
        });
    }

    const input = binding.definition.payloadSchema.parse(
        payload ?? binding.definition.defaultInput
    );
    const createdJob = await binding.queue.add(binding.definition.displayName, input);

    if (!createdJob?.id) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to queue job "${slug}".`,
        });
    }

    return {
        jobId: createdJob.id,
    };
}

export async function runJobUnlessRunningOrQueued(
    slug: RegisteredJobSlug,
    payload: Record<string, unknown> | undefined
) {
    const binding = await getJobBinding(slug);
    const counts = await binding.queue.getJobCountsAsync();

    if (counts.active > 0 || counts.waiting > 0) {
        return null;
    }

    return await runJob(slug, payload);
}
