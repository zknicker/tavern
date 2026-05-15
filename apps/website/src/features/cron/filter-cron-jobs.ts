import type { CronListItem } from './cron-list-data.ts';

export type CronFilter = 'all' | 'active' | 'paused';

interface FilterCronJobsInput {
    cronJobs: CronListItem[];
    filter: CronFilter;
    query: string;
}

export function filterCronJobs({ cronJobs, filter, query }: FilterCronJobsInput): CronListItem[] {
    return cronJobs.filter((job) => {
        if (filter === 'active' && !job.enabled) {
            return false;
        }

        if (filter === 'paused' && job.enabled) {
            return false;
        }

        if (query.length === 0) {
            return true;
        }

        return (
            job.name.toLowerCase().includes(query) ||
            job.description.toLowerCase().includes(query) ||
            job.schedule.toLowerCase().includes(query)
        );
    });
}
