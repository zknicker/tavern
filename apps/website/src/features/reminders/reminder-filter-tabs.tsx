import { Badge } from '../../components/ui/badge.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import type { ReminderFilter } from './filter-reminders.ts';

interface ReminderFilterTabsProps {
    canceledCount: number;
    compact?: boolean;
    filter: ReminderFilter;
    firedCount: number;
    onFilterChange: (filter: ReminderFilter) => void;
    scheduledCount: number;
    totalCount: number;
}

// Ported from cron-filter-tabs.tsx: the compact status tabs for narrow widths.
export function ReminderFilterTabs({
    canceledCount,
    compact = false,
    filter,
    firedCount,
    onFilterChange,
    scheduledCount,
    totalCount,
}: ReminderFilterTabsProps) {
    return (
        <TabsSubtle
            onValueChange={(value) => onFilterChange(value as ReminderFilter)}
            value={filter}
        >
            <TabsSubtleList className={compact ? 'h-7 gap-0.5' : undefined}>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="all"
                >
                    All
                    <ReminderFilterCount compact={compact} count={totalCount} />
                </TabsSubtleItem>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="scheduled"
                >
                    Scheduled
                    <ReminderFilterCount compact={compact} count={scheduledCount} />
                </TabsSubtleItem>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="fired"
                >
                    Fired
                    <ReminderFilterCount compact={compact} count={firedCount} />
                </TabsSubtleItem>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="canceled"
                >
                    Canceled
                    <ReminderFilterCount compact={compact} count={canceledCount} />
                </TabsSubtleItem>
            </TabsSubtleList>
        </TabsSubtle>
    );
}

function ReminderFilterCount({ compact, count }: { compact: boolean; count: number }) {
    if (compact) {
        return <Badge variant="secondary">{count}</Badge>;
    }

    return (
        <span className="text-muted-foreground/64 tabular-nums data-active:text-foreground/48">
            {count}
        </span>
    );
}
