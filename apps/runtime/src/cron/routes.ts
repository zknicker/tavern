import {
    agentRuntimeArchiveCronSchema,
    agentRuntimeCreateCronSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeRoutes,
    agentRuntimeRunCronSchema,
    agentRuntimeUpdateCronSchema,
} from '@tavern/api';
import { badRequest, json, notFound, readJson } from '../tavern/http.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import { executeCronJob } from './executor.ts';
import {
    enqueueCronRun,
    getRuntimeCronManager,
    reconcileActiveCronSchedules,
} from './scheduler.ts';
import { createValidatedCronJob, updateValidatedCronJob } from './service.ts';
import {
    createCronRun,
    deleteCronJob,
    getCronJob,
    getCronRun,
    listCronJobs,
    listCronRuns,
} from './store.ts';

export async function handleCronRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    try {
        if (method === 'GET' && url.pathname === agentRuntimeRoutes.cronJobs) {
            return json(agentRuntimeCronListSchema.parse({ jobs: listCronJobs() }));
        }
        if (method === 'POST' && url.pathname === agentRuntimeRoutes.cronJobs) {
            const job = createValidatedCronJob(
                agentRuntimeCreateCronSchema.parse(await readJson(request))
            );
            await reconcileActiveCronSchedules();
            publishCronUpdated(job.id);
            return json(agentRuntimeCronSchema.parse(getCronJob(job.id)), 201);
        }
        if (method === 'GET' && url.pathname === agentRuntimeRoutes.cronRuns) {
            return json(agentRuntimeCronRunListSchema.parse({ runs: listCronRuns() }));
        }
        if (method === 'GET' && segments[0] === 'cron-runs' && segments[1] && !segments[2]) {
            const run = getCronRun(segments[1]);
            return run ? json(agentRuntimeCronRunSchema.parse(run)) : notFound();
        }
        if (segments[0] !== 'cron-jobs' || !segments[1]) {
            return null;
        }

        const jobId = segments[1];
        if (method === 'GET' && !segments[2]) {
            const job = getCronJob(jobId);
            return job ? json(agentRuntimeCronSchema.parse(job)) : notFound();
        }
        if (method === 'PATCH' && !segments[2]) {
            const job = updateValidatedCronJob(
                jobId,
                agentRuntimeUpdateCronSchema.parse(await readJson(request))
            );
            if (!job) {
                return notFound();
            }
            await reconcileActiveCronSchedules();
            publishCronUpdated(job.id);
            return json(agentRuntimeCronSchema.parse(getCronJob(job.id)));
        }
        if (method === 'DELETE' && !segments[2]) {
            const deleted = deleteCronJob(jobId);
            if (!deleted) {
                return notFound();
            }
            await reconcileActiveCronSchedules();
            publishRuntimeEvent({
                cronJobId: jobId,
                timestamp: new Date().toISOString(),
                type: 'cron.deleted',
            });
            return json(agentRuntimeArchiveCronSchema.parse({ archived: true, id: jobId }));
        }
        if (method === 'POST' && segments[2] === 'run' && !segments[3]) {
            const input = agentRuntimeRunCronSchema.parse(
                await readJson(request).catch(() => ({}))
            );
            if (input.mode === 'enqueue') {
                if (!getRuntimeCronManager()) {
                    return badRequest('Cron scheduler is not running.');
                }
                const scheduledFor = new Date().toISOString();
                const run = createCronRun({ jobId, scheduledFor, trigger: 'manual' });
                const queued = await enqueueCronRun({
                    jobId,
                    runId: run.id,
                    scheduledFor,
                    trigger: 'manual',
                });
                if (!queued) {
                    return badRequest('Cron scheduler is not running.');
                }
                return json(agentRuntimeCronRunSchema.parse(run), 202);
            }
            const run = await executeCronJob({
                jobId,
                scheduledFor: new Date().toISOString(),
                trigger: 'manual',
            });
            await reconcileActiveCronSchedules();
            return json(agentRuntimeCronRunSchema.parse(run), 201);
        }
        if (method === 'GET' && segments[2] === 'runs' && !segments[3]) {
            return json(agentRuntimeCronRunListSchema.parse({ runs: listCronRuns(jobId) }));
        }
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }

    return null;
}

function publishCronUpdated(cronJobId: string) {
    publishRuntimeEvent({
        cronJobId,
        timestamp: new Date().toISOString(),
        type: 'cron.updated',
    });
}
