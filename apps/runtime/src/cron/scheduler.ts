import path from 'node:path';
import { Queue, Worker } from 'bunqueue/client';
import { DATA_DIR } from '../config.ts';
import { log } from '../log.ts';
import { executeCronJob } from './executor.ts';
import {
    clearRuntimeCronManager,
    getRuntimeCronManager,
    type RuntimeCronManager,
    setRuntimeCronManager,
} from './manager-state.ts';
import { nextRunAtFromSchedule, scheduledForFromQueueJob } from './schedule.ts';
import { listFullCronJobs, setCronJobNextRunAt, settleOrphanedCronRuns } from './store.ts';

export {
    enqueueCronRun,
    getRuntimeCronManager,
    isRuntimeCronReady,
    type RuntimeCronManager,
    reconcileActiveCronSchedules,
} from './manager-state.ts';

interface CronQueuePayload {
    jobId: string;
    runId?: string;
    scheduledFor?: string;
    trigger: 'manual' | 'recovery' | 'schedule';
}

const defaultCronQueueName = 'tavern-cron';
let clearQueuesOnStop = false;

export function configureRuntimeCronDatabasePath(jobsDatabasePath?: string): string {
    const resolvedJobsDatabasePath = jobsDatabasePath ?? path.join(DATA_DIR, 'runtime.jobs.sqlite');
    Bun.env.DATA_PATH = resolvedJobsDatabasePath;
    process.env.DATA_PATH = resolvedJobsDatabasePath;
    return resolvedJobsDatabasePath;
}

export async function startRuntimeCronManager(
    input: { clearQueuesOnStop?: boolean; jobsDatabasePath?: string; queueName?: string } = {}
): Promise<RuntimeCronManager> {
    const activeManager = getRuntimeCronManager();
    if (activeManager) {
        return activeManager;
    }

    configureRuntimeCronDatabasePath(input.jobsDatabasePath);
    clearQueuesOnStop = input.clearQueuesOnStop ?? false;
    const queueName = input.queueName ?? defaultCronQueueName;
    const queue = createQueue(queueName);
    const worker = createWorker(queueName);
    const manager: RuntimeCronManager = {
        async enqueue(payload: CronQueuePayload) {
            const job = await queue.add('Cron run', payload, {
                attempts: 1,
                durable: true,
            });
            return job.id;
        },
        isHealthy() {
            return getRuntimeCronManager() === manager;
        },
        async reconcile(options: { recoverMissed?: boolean } = {}) {
            await reconcileCronSchedules(queue, options);
        },
        async stop() {
            await closeWorker(worker);
            if (clearQueuesOnStop) {
                queue.obliterate();
            }
            await closeQueue(queue);
            clearRuntimeCronManager(manager);
            clearQueuesOnStop = false;
        },
    };

    setRuntimeCronManager(manager);
    // Runs interrupted by a restart settle as errors before recovery runs are
    // scheduled; a durable queue job that survives re-runs its settled row.
    const orphaned = settleOrphanedCronRuns();
    if (orphaned > 0) {
        log.warn('Settled cron runs orphaned by a Runtime restart', { count: orphaned });
    }
    await manager.reconcile({ recoverMissed: true });
    return manager;
}

export async function computeCronScheduleNextRunAtMs(input: {
    jobsDatabasePath?: string;
    schedule: Parameters<typeof nextRunAtFromSchedule>[0];
}) {
    return nextRunAtFromSchedule(input.schedule);
}

async function reconcileCronSchedules(
    queue: Queue<CronQueuePayload>,
    options: { recoverMissed?: boolean }
): Promise<void> {
    const jobs = listFullCronJobs();
    const enabledIds = new Set(jobs.filter((job) => job.enabled).map((job) => job.id));
    const schedulers = await queue.getJobSchedulers();
    for (const scheduler of schedulers) {
        if (!enabledIds.has(scheduler.id)) {
            await queue.removeJobScheduler(scheduler.id);
        }
    }

    const nowMs = Date.now();
    for (const job of jobs) {
        try {
            await reconcileCronJobSchedule(queue, job, { nowMs, ...options });
        } catch (error) {
            // One broken job must not block scheduling for the rest.
            log.error('Cron schedule reconcile failed', { err: error, jobId: job.id });
            setCronJobNextRunAt(job.id, null);
        }
    }
}

async function reconcileCronJobSchedule(
    queue: Queue<CronQueuePayload>,
    job: ReturnType<typeof listFullCronJobs>[number],
    options: { nowMs: number; recoverMissed?: boolean }
): Promise<void> {
    if (
        options.recoverMissed &&
        job.enabled &&
        job.state.nextRunAtMs &&
        job.state.nextRunAtMs < options.nowMs
    ) {
        try {
            await queue.add(
                'Cron recovery run',
                {
                    jobId: job.id,
                    scheduledFor: new Date(job.state.nextRunAtMs).toISOString(),
                    trigger: 'recovery',
                },
                {
                    attempts: 1,
                    durable: true,
                    // Window-scoped id: one recovery per missed window, while
                    // a fresh miss after a later restart enqueues cleanly.
                    jobId: recoveryJobId(job.id, job.state.nextRunAtMs),
                    removeOnComplete: true,
                    removeOnFail: true,
                }
            );
        } catch (error) {
            // Duplicate id means this window's recovery is already queued.
            log.warn('Cron recovery enqueue skipped', { err: error, jobId: job.id });
        }
    }

    if (!job.enabled) {
        await removeCronSchedule(queue, job.id);
        setCronJobNextRunAt(job.id, null);
        return;
    }

    const nextRunAtMs = await syncCronSchedule(queue, job);
    setCronJobNextRunAt(job.id, nextRunAtMs);
}

async function syncCronSchedule(
    queue: Queue<CronQueuePayload>,
    job: ReturnType<typeof listFullCronJobs>[number]
): Promise<number | null> {
    if (job.schedule.kind === 'at') {
        await queue.removeJobScheduler(job.id);
        const nextRunAtMs = nextRunAtFromSchedule(job.schedule);
        await queue.remove(atJobId(job.id));
        if (!nextRunAtMs) {
            return null;
        }
        await queue.add(
            job.name,
            {
                jobId: job.id,
                scheduledFor: new Date(nextRunAtMs).toISOString(),
                trigger: 'schedule',
            },
            {
                attempts: 1,
                delay: Math.max(0, nextRunAtMs - Date.now()),
                durable: true,
                jobId: atJobId(job.id),
            }
        );
        return nextRunAtMs;
    }

    await queue.remove(atJobId(job.id));
    const repeat =
        job.schedule.kind === 'every'
            ? { every: job.schedule.everyMs }
            : { pattern: job.schedule.expr, timezone: job.schedule.tz };
    await queue.upsertJobScheduler(job.id, repeat, {
        data: {
            jobId: job.id,
            trigger: 'schedule',
        },
        name: job.name,
    });
    // The embedded upsert returns a placeholder `next` (now + 60s for cron
    // patterns), so compute the real next run with the same croner engine the
    // scheduler fires with.
    return nextRunAtFromSchedule(job.schedule);
}

async function removeCronSchedule(queue: Queue<CronQueuePayload>, jobId: string): Promise<void> {
    await queue.removeJobScheduler(jobId);
    await queue.remove(atJobId(jobId));
}

function createQueue(queueName: string) {
    // The queue is transport only; durable run history lives in cron_runs.
    return new Queue<CronQueuePayload>(queueName, {
        defaultJobOptions: {
            attempts: 1,
            durable: true,
            removeOnComplete: true,
            removeOnFail: true,
        },
        embedded: true,
    });
}

function createWorker(queueName: string) {
    const worker = new Worker<CronQueuePayload, void>(
        queueName,
        async (job) => {
            await executeCronJob({
                jobId: job.data.jobId,
                runId: job.data.runId,
                scheduledFor: scheduledForFromQueueJob({
                    delay: job.delay,
                    scheduledFor: job.data.scheduledFor,
                    timestamp: job.timestamp,
                }),
                trigger: job.data.trigger,
            });
            await getRuntimeCronManager()?.reconcile();
        },
        { concurrency: 1, embedded: true }
    );
    worker.on('error', (error) => {
        log.error('Cron worker error', { err: error });
    });
    return worker;
}

async function closeWorker(worker: Worker<CronQueuePayload, void>): Promise<void> {
    const maybeClose = (worker as { close?: () => Promise<void> | void }).close;
    if (maybeClose) {
        await maybeClose.call(worker);
    }
}

async function closeQueue(queue: Queue<CronQueuePayload>): Promise<void> {
    await queue.disconnect();
    const maybeClose = (queue as { close?: () => Promise<void> | void }).close;
    if (maybeClose) {
        await maybeClose.call(queue);
    }
}

function atJobId(jobId: string) {
    return `cron-at-${jobId}`;
}

function recoveryJobId(jobId: string, missedWindowMs: number) {
    return `cron-recovery-${jobId}-${missedWindowMs}`;
}
