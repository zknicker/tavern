import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export function publishMemoryJobUpdated(jobId?: string) {
    publishRuntimeEvent({
        jobId,
        timestamp: new Date().toISOString(),
        type: 'memoryJob.updated',
    });
}
