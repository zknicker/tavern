interface PendingIntervalRun {
    id: string;
    timestamp: number;
}

interface RecordedIntervalRun {
    finishedOn?: number;
    processedOn?: number;
    timestamp: number;
}

export function getRecordedRunTimestamp(run: RecordedIntervalRun) {
    return run.finishedOn ?? run.processedOn ?? run.timestamp;
}

export function getStalePendingRunIds(runs: PendingIntervalRun[]) {
    if (runs.length < 2) {
        return [];
    }

    return [...runs]
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(1)
        .map((run) => run.id);
}

export function hasRecentIntervalRun(
    runs: RecordedIntervalRun[],
    options: {
        intervalMs: number;
        nowMs: number;
    }
) {
    if (runs.length === 0) {
        return false;
    }

    const latestTimestamp = Math.max(...runs.map((run) => getRecordedRunTimestamp(run)));

    return latestTimestamp >= options.nowMs - options.intervalMs;
}
