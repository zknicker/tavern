import type { MemoryJobDetail, MemoryJobSummary } from '@tavern/api';

/**
 * Customer-facing language for Memory worker runs. Internally these are
 * extraction and dream jobs; the page never says so.
 */

/** tRPC output inference makes z.unknown() fields optional. */
export type MemoryJobDetailView = Omit<MemoryJobDetail, 'transcript' | 'usage'> & {
    transcript?: unknown;
    usage?: unknown;
};

export interface MemoryJobBadge {
    label: string;
    variant: 'error' | 'info' | 'subtle';
}

export function memoryJobTitle(job: MemoryJobSummary, chatName: string | null) {
    if (job.kind === 'dream') {
        return 'Organized memory';
    }
    const source = chatName ? `“${chatName}”` : 'a chat';
    return job.status === 'skipped' ? `Reviewed ${source}` : `Remembered from ${source}`;
}

export function memoryJobKindLabel(job: MemoryJobSummary) {
    return job.kind === 'dream' ? 'Dream' : 'Capture';
}

export function memoryJobDetailLine(job: MemoryJobSummary) {
    if (job.status === 'skipped') {
        return 'Nothing new to save';
    }
    if (job.kind === 'dream' && job.status === 'completed' && job.fileChangeCount > 0) {
        return job.fileChangeCount === 1
            ? 'Updated 1 file'
            : `Updated ${job.fileChangeCount} files`;
    }
    return null;
}

export function memoryJobBadge(job: MemoryJobSummary): MemoryJobBadge | null {
    switch (job.status) {
        case 'failed':
            return { label: 'Failed', variant: 'error' };
        case 'queued':
            return { label: 'Queued', variant: 'subtle' };
        case 'running':
            return { label: 'Running', variant: 'info' };
        default:
            return null;
    }
}

export function memoryJobObservations(job: MemoryJobDetailView) {
    if (job.kind !== 'extraction') {
        return null;
    }
    const observations = job.metadata.observations;
    return typeof observations === 'string' && observations.trim() ? observations.trim() : null;
}

export function memoryDreamSummary(job: MemoryJobDetailView) {
    if (job.kind !== 'dream') {
        return null;
    }
    const summary = job.metadata.summary;
    return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
}

export function memoryFileChangeLabel(change: MemoryJobDetail['fileChanges'][number]) {
    return `${change.beforeHash === null ? 'Created' : 'Updated'} ${change.path}`;
}
