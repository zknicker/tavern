import type { RegisteredJobSlug } from '../../../../jobs/index.ts';
import { emitStartupJobsLoading, emitStartupJobsReady } from '../startup-events.ts';
import { logStartupDetail, logStartupSection, shortenHomePath } from '../startup-log.ts';
import {
    ensureBinding,
    getJobBinding,
    getRegisteredJobDefinitions,
} from './agent-runtime/bindings.ts';
import { recoverInterruptedJobs } from './agent-runtime/recovery.ts';
import {
    refreshJobSchedule as refreshBindingSchedule,
    syncScheduledJob,
} from './agent-runtime/schedule.ts';
import {
    configureJobsDatabasePath,
    isJobsManagerStarted,
    markJobsManagerStarted,
} from './agent-runtime/shared.ts';

export async function startJobsManager() {
    if (isJobsManagerStarted()) {
        return;
    }

    const jobsDatabasePath = configureJobsDatabasePath();
    logStartupSection('Jobs');
    logStartupDetail('🗂️', 'Queue DB', shortenHomePath(jobsDatabasePath));
    emitStartupJobsLoading();

    for (const definition of getRegisteredJobDefinitions()) {
        const binding = await ensureBinding(definition);
        await recoverInterruptedJobs(binding);
        await syncScheduledJob(binding);
    }

    emitStartupJobsReady(getRegisteredJobDefinitions().length);
    markJobsManagerStarted();
}

export { getJobBinding, getRegisteredJobDefinitions };

export async function refreshJobSchedule(
    slug: RegisteredJobSlug,
    options: {
        runImmediately?: boolean;
    } = {}
) {
    const binding = await getJobBinding(slug);
    await refreshBindingSchedule(binding, options);
}
