import { type Job as QueueJob, UnrecoverableError, Worker } from 'bunqueue/client';
import type { JobDefinition, JobExecutionState } from '../../../../../jobs/define-job.ts';
import { emitJobsUpdated } from '../../api/invalidation-events.ts';
import {
    recordJobActive,
    recordJobCompleted,
    recordJobFailed,
    recordJobLog,
    recordJobProgress,
} from '../execution-history.ts';
import { createQueue, formatError, type QueueBinding } from './shared.ts';

async function processJob(
    definition: JobDefinition<Record<string, unknown>>,
    job: QueueJob<Record<string, unknown>>
) {
    const input = definition.payloadSchema.parse(job.data ?? definition.defaultInput);
    const state: JobExecutionState = {
        failure: null,
    };

    try {
        if (!(await definition.isEnabled())) {
            await job.log(`Skipped ${definition.displayName} because it is currently disabled.`);
            await job.updateProgress(100, 'skipped');
            return;
        }

        await job.updateProgress(10, 'running');
        await definition.run({
            fail: (message, cause) => {
                state.failure = {
                    cause: cause === undefined ? null : formatError(cause),
                    message,
                };

                return Promise.resolve();
            },
            input,
            log: async (message) => {
                await job.log(message);
            },
        });
    } catch (error) {
        const fatalMessage = `Unhandled error escaped job "${definition.slug}": ${formatError(error)}`;
        console.error('[tavern] fatal job boundary breach', fatalMessage);
        await job.log(fatalMessage);
        throw new UnrecoverableError(fatalMessage);
    }

    if (state.failure) {
        const message = state.failure.cause
            ? `${state.failure.message} ${state.failure.cause}`
            : state.failure.message;
        throw new UnrecoverableError(message);
    }

    await job.updateProgress(100, 'completed');
}

function createWorker(binding: QueueBinding) {
    const worker = new Worker<Record<string, unknown>, void>(
        binding.definition.slug,
        async (job) => processJob(binding.definition, job),
        {
            concurrency: binding.definition.concurrency,
            embedded: true,
        }
    );

    worker.on('error', (error) => {
        console.error(`[tavern] jobs worker error (${binding.definition.slug})`, error);
    });

    worker.on('active', async (job) => {
        await recordJobActive(binding, job);
        emitJobsUpdated();
    });

    worker.on('progress', async (job, progress) => {
        if (!job) {
            return;
        }

        await recordJobProgress(binding, job, progress);
        emitJobsUpdated();
    });

    worker.on('log', async (job, message) => {
        await recordJobLog(binding, job, message);
        emitJobsUpdated();
    });

    worker.on('failed', async (job, error) => {
        console.error(
            `[tavern] job failed (${binding.definition.slug}/${job.id})`,
            error instanceof Error ? error.message : String(error)
        );
        await recordJobFailed(binding, job, error instanceof Error ? error.message : String(error));
        emitJobsUpdated();
    });

    worker.on('completed', async (job) => {
        await recordJobCompleted(binding, job);
        emitJobsUpdated();
    });

    return worker;
}

export function createBinding(definition: QueueBinding['definition']): QueueBinding {
    const queue = createQueue(definition);
    const binding = {
        definition,
        queue,
        worker: undefined as unknown as Worker<Record<string, unknown>, void>,
    };
    binding.worker = createWorker(binding);
    return binding;
}
