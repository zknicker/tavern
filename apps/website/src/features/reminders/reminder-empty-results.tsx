import type { ReminderFilter } from './filter-reminders.ts';

interface ReminderEmptyResultsProps {
    filter: ReminderFilter;
    onClearFilters: () => void;
    query: string;
}

// Ported from cron-empty-results.tsx.
export function ReminderEmptyResults({ filter, onClearFilters, query }: ReminderEmptyResultsProps) {
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
