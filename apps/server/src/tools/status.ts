import { parseJsonRecord } from './values.ts';

export function isErrorStatus(status: string | null) {
    if (!status) {
        return false;
    }

    const normalizedStatus = status.toLowerCase();
    return (
        normalizedStatus.includes('error') ||
        normalizedStatus.includes('forbidden') ||
        normalizedStatus.includes('failed')
    );
}

export function getCronJobCount(text: unknown) {
    const parsed = parseJsonRecord(text);
    const jobs = parsed?.jobs;
    return Array.isArray(jobs) ? jobs.length : null;
}
