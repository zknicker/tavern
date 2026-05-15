import { emitJobsUpdated } from '../../api/invalidation-events.ts';
import { emitStartupJobEvent } from '../../startup-events.ts';
import { formatDurationMs, logStartupEvent } from '../../startup-log.ts';
import { getStalePendingRunIds, hasRecentIntervalRun } from '../interval-schedule.ts';
import type { QueueBinding } from './shared.ts';

function getStartupJobLabel(binding: QueueBinding) {
    return binding.definition.displayName;
}

async function listPendingRuns(binding: QueueBinding) {
    const counts = await binding.queue.getJobCountsAsync();
    const [waiting, delayed] = await Promise.all([
        counts.waiting > 0 ? binding.queue.getWaitingAsync(0, counts.waiting) : [],
        counts.delayed > 0 ? binding.queue.getDelayedAsync(0, counts.delayed) : [],
    ]);

    return [...waiting, ...delayed];
}

async function clearPendingRuns(binding: QueueBinding) {
    const pendingRuns = await listPendingRuns(binding);

    if (pendingRuns.length === 0) {
        return 0;
    }

    await Promise.all(pendingRuns.map((job) => binding.queue.remove(job.id)));
    return pendingRuns.length;
}

async function collapsePendingRuns(binding: QueueBinding) {
    const pendingRuns = await listPendingRuns(binding);
    const staleRunIds = getStalePendingRunIds(pendingRuns);

    if (staleRunIds.length === 0) {
        return pendingRuns;
    }

    await Promise.all(staleRunIds.map((jobId) => binding.queue.remove(jobId)));

    const staleRunIdsSet = new Set(staleRunIds);
    logStartupEvent(
        '🧹',
        `${getStartupJobLabel(binding)} · pruned ${staleRunIds.length} stale pending run(s)`
    );

    return pendingRuns.filter((job) => !staleRunIdsSet.has(job.id));
}

async function hasRecentRunForInterval(binding: QueueBinding, intervalMs: number) {
    const [completedRuns, failedRuns] = await Promise.all([
        binding.queue.getCompletedAsync(0, 1),
        binding.queue.getFailedAsync(0, 1),
    ]);

    return hasRecentIntervalRun([...completedRuns, ...failedRuns], {
        intervalMs,
        nowMs: Date.now(),
    });
}

export async function syncScheduledJob(
    binding: QueueBinding,
    options: {
        runImmediately?: boolean;
    } = {}
) {
    if (binding.definition.schedule.kind !== 'interval') {
        return;
    }

    if (!(await binding.definition.isEnabled())) {
        const scheduler = await binding.queue.getJobScheduler(binding.definition.slug);
        const clearedPendingRuns = await clearPendingRuns(binding);

        if (scheduler) {
            await binding.queue.removeJobScheduler(binding.definition.slug);
            logStartupEvent(
                '🛑',
                `${getStartupJobLabel(binding)} · disabled · scheduler removed`,
                'warning'
            );
        } else {
            logStartupEvent('⏭️', `${getStartupJobLabel(binding)} · disabled`, 'warning');
        }

        if (clearedPendingRuns > 0) {
            logStartupEvent(
                '🪣',
                `${getStartupJobLabel(binding)} · cleared ${clearedPendingRuns} pending run(s)`,
                'warning'
            );
        }

        emitStartupJobEvent({
            cadence: formatDurationMs(binding.definition.schedule.everyMs),
            immediate: false,
            key: binding.definition.slug,
            label: getStartupJobLabel(binding),
            state: 'disabled',
        });

        return;
    }

    const shouldRunImmediately = options.runImmediately ?? binding.definition.schedule.runOnStart;

    await binding.queue.upsertJobScheduler(
        binding.definition.slug,
        {
            every: binding.definition.schedule.everyMs,
        },
        {
            data: binding.definition.defaultInput,
            name: binding.definition.displayName,
        }
    );

    // Workaround: bunqueue ignores `immediately` in embedded mode, so manually
    // queue the first run when the job is configured to run on start.
    if (shouldRunImmediately) {
        const pendingRuns = await collapsePendingRuns(binding);

        if (
            pendingRuns.length === 0 &&
            !(await hasRecentRunForInterval(binding, binding.definition.schedule.everyMs))
        ) {
            await binding.queue.add(
                binding.definition.displayName,
                binding.definition.defaultInput
            );
        }
    }

    logStartupEvent(
        shouldRunImmediately ? '🚀' : '✅',
        `${getStartupJobLabel(binding)} · every ${formatDurationMs(binding.definition.schedule.everyMs)}${shouldRunImmediately ? ' · immediate' : ''}`,
        'success'
    );
    emitStartupJobEvent({
        cadence: formatDurationMs(binding.definition.schedule.everyMs),
        immediate: shouldRunImmediately,
        key: binding.definition.slug,
        label: getStartupJobLabel(binding),
        state: 'enabled',
    });
}

export async function refreshJobSchedule(
    binding: QueueBinding,
    options: {
        runImmediately?: boolean;
    } = {}
) {
    await syncScheduledJob(binding, options);
    emitJobsUpdated();
}
