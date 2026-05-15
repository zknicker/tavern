import { extname, join, parse } from 'node:path';
import { Queue, type Worker } from 'bunqueue/client';
import type { JobDefinition } from '../../../../../jobs/define-job.ts';
import type { RegisteredJobDefinition, RegisteredJobSlug } from '../../../../../jobs/index.ts';
import { env } from '../../config/env.ts';

export interface QueueBinding {
    definition: RegisteredJobDefinition;
    queue: Queue<Record<string, unknown>>;
    worker: Worker<Record<string, unknown>, void>;
}

const queueBindings = new Map<RegisteredJobSlug, QueueBinding>();
let started = false;

function deriveJobsDatabasePath(databasePath: string) {
    const extension = extname(databasePath);

    if (extension.length === 0) {
        return `${databasePath}.jobs.sqlite`;
    }

    const parsed = parse(databasePath);
    return join(parsed.dir, `${parsed.name}.jobs${extension}`);
}

export function configureJobsDatabasePath() {
    const jobsDatabasePath = deriveJobsDatabasePath(env.DATABASE_PATH);
    Bun.env.DATA_PATH = jobsDatabasePath;
    process.env.DATA_PATH = jobsDatabasePath;
    return jobsDatabasePath;
}

export function createQueue(definition: JobDefinition<Record<string, unknown>>) {
    return new Queue<Record<string, unknown>>(definition.slug, {
        defaultJobOptions: {
            attempts: 1,
            durable: true,
            removeOnComplete: false,
            removeOnFail: false,
        },
        embedded: true,
    });
}

export function formatError(error: unknown) {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }

    return String(error);
}

export function getQueueBindings() {
    return queueBindings;
}

export function isJobsManagerStarted() {
    return started;
}

export function markJobsManagerStarted() {
    started = true;
}
