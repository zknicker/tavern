import path from 'node:path';
import type { AgentRuntimeJobSlug } from '@tavern/api';
import { Queue, type Job as QueueJob, UnrecoverableError, Worker } from 'bunqueue/client';
import { getCapabilityDisabledReason, refreshRuntimeCapabilities } from '../capabilities/store';
import { DATA_DIR } from '../config';
import { log } from '../log';
import { getRuntimeJobDefinition, runtimeJobDefinitions } from './definitions';
import {
    recordRuntimeJobActive,
    recordRuntimeJobCompleted,
    recordRuntimeJobFailed,
    recordRuntimeJobLog,
    recordRuntimeJobProgress,
    recordRuntimeJobQueued,
    recoverInterruptedRuntimeJobRuns,
} from './history';
import { setRuntimeJobRequestHandler } from './request';
import type { RuntimeJobDefinition, RuntimeJobQueuePayload, RuntimeJobTrigger } from './types';

const writeDebounceMs = 2500;

interface RuntimeJobBinding {
    definition: RuntimeJobDefinition;
    disabled: boolean;
    queue: Queue<RuntimeJobQueuePayload>;
    worker: Worker<RuntimeJobQueuePayload, void>;
}

export interface RuntimeJobsManager {
    enqueue(
        slug: AgentRuntimeJobSlug,
        options: { input?: Record<string, unknown>; trigger: RuntimeJobTrigger }
    ): Promise<string>;
    getBinding(slug: AgentRuntimeJobSlug): RuntimeJobBinding | null;
    stop(): Promise<void>;
}

const bindings = new Map<AgentRuntimeJobSlug, RuntimeJobBinding>();
const writeTimers = new Map<AgentRuntimeJobSlug, ReturnType<typeof setTimeout>>();
let activeManager: RuntimeJobsManager | null = null;
let clearQueuesOnStop = false;

export function configureRuntimeJobsDatabasePath(jobsDatabasePath?: string): string {
    const resolvedJobsDatabasePath = jobsDatabasePath ?? path.join(DATA_DIR, 'runtime.jobs.sqlite');
    Bun.env.DATA_PATH = resolvedJobsDatabasePath;
    process.env.DATA_PATH = resolvedJobsDatabasePath;
    return resolvedJobsDatabasePath;
}

export async function startRuntimeJobsManager(
    input: { clearQueuesOnStop?: boolean; jobsDatabasePath?: string } = {}
): Promise<RuntimeJobsManager> {
    if (activeManager) {
        return activeManager;
    }

    configureRuntimeJobsDatabasePath(input.jobsDatabasePath);
    clearQueuesOnStop = input.clearQueuesOnStop ?? false;
    recoverInterruptedRuntimeJobRuns();
    for (const definition of runtimeJobDefinitions) {
        const binding = createBinding(definition);
        bindings.set(definition.slug, binding);
        await syncScheduledRuntimeJob(binding);
    }

    const manager = {
        async enqueue(
            slug: AgentRuntimeJobSlug,
            options: { input?: Record<string, unknown>; trigger: RuntimeJobTrigger }
        ) {
            return await enqueueRuntimeJob(slug, options);
        },
        getBinding(slug: AgentRuntimeJobSlug) {
            return bindings.get(slug) ?? null;
        },
        async stop() {
            for (const timer of writeTimers.values()) {
                clearTimeout(timer);
            }
            writeTimers.clear();
            setRuntimeJobRequestHandler(null);
            for (const binding of bindings.values()) {
                await closeWorker(binding.worker);
                if (clearQueuesOnStop) {
                    binding.queue.obliterate();
                }
                await closeQueue(binding.queue);
            }
            bindings.clear();
            activeManager = null;
            clearQueuesOnStop = false;
        },
    } satisfies RuntimeJobsManager;

    activeManager = manager;
    setRuntimeJobRequestHandler((slug, options) => {
        if (options.trigger === 'write') {
            debounceWriteJob(slug);
            return;
        }
        void enqueueRuntimeJob(slug, options).catch((error) => {
            log.error('Runtime job request failed', { err: error, slug, trigger: options.trigger });
        });
    });
    return manager;
}

export function getRuntimeJobBinding(slug: AgentRuntimeJobSlug): RuntimeJobBinding | null {
    return bindings.get(slug) ?? null;
}

export async function enqueueRuntimeJob(
    slug: AgentRuntimeJobSlug,
    options: { input?: Record<string, unknown>; trigger: RuntimeJobTrigger }
): Promise<string> {
    const binding = bindings.get(slug);
    if (!binding) {
        throw new Error(`Runtime jobs manager has not registered ${slug}.`);
    }
    const disabledReason = await getRuntimeJobDisabledReason(binding.definition);
    if (disabledReason) {
        throw new Error(disabledReason);
    }
    const input = binding.definition.inputSchema.parse(
        options.input ?? binding.definition.defaultInput
    );
    const job = await binding.queue.add(binding.definition.displayName, {
        input,
        trigger: options.trigger,
    });
    recordRuntimeJobQueued(binding.definition, job, options.trigger);
    return job.id;
}

async function processRuntimeJob(
    definition: RuntimeJobDefinition,
    job: QueueJob<RuntimeJobQueuePayload>
) {
    try {
        const disabledReason = await getRuntimeJobDisabledReason(definition);
        if (disabledReason) {
            await job.log(`Skipped ${definition.displayName}: ${disabledReason}`);
            throw new UnrecoverableError(disabledReason);
        }
        await job.updateProgress(10, 'running');
        const input = definition.inputSchema.parse(job.data?.input ?? definition.defaultInput);
        await definition.run({
            input,
            log: async (message) => {
                await job.log(message);
            },
            trigger: job.data?.trigger ?? 'unknown',
        });
    } catch (error) {
        if (error instanceof UnrecoverableError) {
            throw error;
        }
        const message = readErrorMessage(error);
        await job.log(message);
        throw new UnrecoverableError(message);
    }
    await job.updateProgress(100, 'completed');
}

function createBinding(definition: RuntimeJobDefinition): RuntimeJobBinding {
    const queue = new Queue<RuntimeJobQueuePayload>(definition.slug, {
        defaultJobOptions: {
            attempts: 1,
            durable: true,
            removeOnComplete: false,
            removeOnFail: false,
        },
        embedded: true,
    });
    const binding = {
        definition,
        disabled: false,
        queue,
        worker: undefined as unknown as Worker<RuntimeJobQueuePayload, void>,
    };
    binding.worker = createWorker(binding);
    return binding;
}

function createWorker(binding: Omit<RuntimeJobBinding, 'worker'>) {
    const worker = new Worker<RuntimeJobQueuePayload, void>(
        binding.definition.slug,
        async (job) => processRuntimeJob(binding.definition, job),
        {
            concurrency: binding.definition.concurrency,
            embedded: true,
        }
    );

    worker.on('active', (job) => {
        recordRuntimeJobActive(binding.definition, job);
    });
    worker.on('progress', (job, progress) => {
        if (job) {
            recordRuntimeJobProgress(binding.definition, job, progress);
        }
    });
    worker.on('log', (job, message) => {
        recordRuntimeJobLog(binding.definition, job, message);
    });
    worker.on('failed', (job, error) => {
        recordRuntimeJobFailed(binding.definition, job, readErrorMessage(error));
    });
    worker.on('completed', (job) => {
        recordRuntimeJobCompleted(binding.definition, job);
    });
    worker.on('error', (error) => {
        log.error('Runtime jobs worker error', { err: error, slug: binding.definition.slug });
    });

    return worker;
}

async function syncScheduledRuntimeJob(binding: RuntimeJobBinding): Promise<void> {
    return await syncScheduledRuntimeJobWithOptions(binding, {
        refreshCapabilities: true,
        runOnStart: true,
    });
}

async function syncScheduledRuntimeJobWithOptions(
    binding: RuntimeJobBinding,
    options: { refreshCapabilities?: boolean; runOnStart: boolean }
): Promise<void> {
    const wasDisabled = binding.disabled;
    const disabledReason = await getRuntimeJobDisabledReason(binding.definition, {
        onlyDue: !(options.refreshCapabilities ?? false),
    });
    if (disabledReason) {
        binding.disabled = true;
        await binding.queue.removeJobScheduler(binding.definition.slug);
        log.info('Runtime job disabled', {
            reason: disabledReason,
            slug: binding.definition.slug,
        });
        return;
    }
    binding.disabled = false;

    await binding.queue.upsertJobScheduler(
        binding.definition.slug,
        { every: binding.definition.schedule.everyMs },
        {
            data: {
                input: binding.definition.defaultInput,
                trigger: 'schedule',
            },
            name: binding.definition.displayName,
        }
    );

    const runNow =
        binding.definition.schedule.runOnStart && (options.runOnStart || wasDisabled);
    if (runNow) {
        const jobId = await enqueueRuntimeJob(binding.definition.slug, { trigger: 'startup' });
        log.info('Runtime startup job queued', { jobId, slug: binding.definition.slug });
    }
}

function debounceWriteJob(slug: AgentRuntimeJobSlug): void {
    const existing = writeTimers.get(slug);
    if (existing) {
        clearTimeout(existing);
    }
    writeTimers.set(
        slug,
        setTimeout(() => {
            writeTimers.delete(slug);
            void queueWriteTriggeredJob(slug);
        }, writeDebounceMs)
    );
}

async function queueWriteTriggeredJob(slug: AgentRuntimeJobSlug): Promise<void> {
    try {
        const binding = bindings.get(slug);
        if (binding) {
            await syncScheduledRuntimeJobWithOptions(binding, { runOnStart: false });
        }
        await enqueueRuntimeJob(slug, { trigger: 'write' });
    } catch (error) {
        log.error('Runtime write-triggered job failed to queue', {
            err: error,
            slug,
        });
    }
}

async function closeWorker(worker: Worker<RuntimeJobQueuePayload, void>): Promise<void> {
    const maybeClose = (worker as { close?: () => Promise<void> | void }).close;
    if (maybeClose) {
        await maybeClose.call(worker);
    }
}

async function closeQueue(queue: Queue<RuntimeJobQueuePayload>): Promise<void> {
    const maybeClose = (queue as { close?: () => Promise<void> | void }).close;
    if (maybeClose) {
        await maybeClose.call(queue);
    }
}

export async function getRuntimeJobScheduleNextRunAt(
    slug: AgentRuntimeJobSlug
): Promise<string | null> {
    const binding = getRuntimeJobBinding(slug);
    if (!binding) {
        return null;
    }
    const scheduler = await binding.queue.getJobScheduler(slug);
    if (!scheduler?.next) {
        return null;
    }
    return new Date(scheduler.next).toISOString();
}

export function ensureRuntimeJobRegistered(slug: AgentRuntimeJobSlug): RuntimeJobDefinition {
    return getRuntimeJobDefinition(slug);
}

export async function reconcileRuntimeJobSchedules(
    options: { refreshCapabilities?: boolean } = {}
): Promise<void> {
    for (const binding of bindings.values()) {
        await syncScheduledRuntimeJobWithOptions(binding, {
            refreshCapabilities: options.refreshCapabilities ?? false,
            runOnStart: false,
        });
    }
}

export async function getRuntimeJobDisabledReason(
    definition: RuntimeJobDefinition,
    options: { onlyDue?: boolean } = {}
) {
    const explicitReason = await definition.disabledReason();
    if (explicitReason) {
        return explicitReason;
    }
    if (!definition.requiredCapabilities?.length) {
        return null;
    }
    await refreshRuntimeCapabilities({
        ids: definition.requiredCapabilities,
        onlyDue: options.onlyDue ?? true,
    });
    return getCapabilityDisabledReason(definition.requiredCapabilities);
}

function readErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
