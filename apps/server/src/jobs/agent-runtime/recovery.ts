import { emitJobsUpdated } from '../../api/invalidation-events.ts';
import { recordRecoveredInterruptedJob } from '../execution-history.ts';
import type { QueueBinding } from './shared.ts';

const interruptedJobFailureReason = 'Interrupted by Tavern restart.';

export async function recoverInterruptedJobs(binding: QueueBinding) {
    const activeJobs = await binding.queue.getActiveAsync(0, 100);

    if (activeJobs.length === 0) {
        return;
    }

    let recoveredCount = 0;

    for (const job of activeJobs) {
        try {
            await job.log(interruptedJobFailureReason);
            await job.moveToFailed(new Error(interruptedJobFailureReason), job.token, false);
            await recordRecoveredInterruptedJob(binding, job, interruptedJobFailureReason);
            recoveredCount += 1;
        } catch (error) {
            console.error(
                `[tavern] jobs recovery failed (${binding.definition.slug}/${job.id})`,
                error
            );
        }
    }

    if (recoveredCount === 0) {
        return;
    }

    console.warn(
        `[tavern] jobs recovered ${recoveredCount} interrupted run(s) for ${binding.definition.slug}`
    );
    emitJobsUpdated();
}
