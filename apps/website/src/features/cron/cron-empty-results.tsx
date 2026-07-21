import type { CronFilter } from './filter-cron-jobs.ts';

interface CronEmptyResultsProps {
    filter: CronFilter;
    onClearFilters: () => void;
    query: string;
}

export function CronEmptyResults({ filter, onClearFilters, query }: CronEmptyResultsProps) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">
                No reminders match
                {filter !== 'all' ? ` "${filter}"` : ''}
                {query ? ` "${query}"` : ''}
            </p>
            <button
                className="mt-2 text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
                onClick={onClearFilters}
                type="button"
            >
                Clear filters
            </button>
        </div>
    );
}
