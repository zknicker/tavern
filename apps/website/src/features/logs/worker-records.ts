import { formatRelativeTime, formatTimestamp, truncate } from '../../lib/format.ts';
import type { LogListOutput } from '../../lib/trpc.tsx';

function getWorkerStatus(level: LogListOutput['logs'][number]['level']) {
    switch (level) {
        case 'error':
            return 'failed' as const;
        case 'debug':
            return 'idle' as const;
        case 'warn':
            return 'running' as const;
        default:
            return 'done' as const;
    }
}

export function buildWorkerRecords(logs: LogListOutput['logs'], now = Date.now()) {
    return logs.map((log) => ({
        channel: log.source,
        completedAt: formatRelativeTime(log.time, now),
        duration: 'live',
        id: log.id,
        name: truncate(log.message, 52),
        result: {
            campaigns: [],
            focus: log.level.toUpperCase(),
            metrics: [
                { metric: 'Source', value: log.source },
                { metric: 'Time', value: formatTimestamp(log.time) },
                { metric: 'Tags', value: log.tags.join(', ') || 'none' },
            ],
            period: formatTimestamp(log.time),
            title: truncate(log.message, 96),
        },
        status: getWorkerStatus(log.level),
        toolCount: log.tags.length,
        type: 'log',
    }));
}

export type WorkerRecord = ReturnType<typeof buildWorkerRecords>[number];
