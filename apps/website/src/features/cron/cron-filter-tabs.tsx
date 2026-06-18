import { Badge } from '../../components/ui/badge.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import type { CronFilter } from './filter-cron-jobs.ts';

interface CronFilterTabsProps {
    compact?: boolean;
    enabledJobs: number;
    filter: CronFilter;
    onFilterChange: (filter: CronFilter) => void;
    pausedJobs: number;
    totalJobs: number;
}

export function CronFilterTabs({
    compact = false,
    enabledJobs,
    filter,
    onFilterChange,
    pausedJobs,
    totalJobs,
}: CronFilterTabsProps) {
    return (
        <TabsSubtle onValueChange={(value) => onFilterChange(value as CronFilter)} value={filter}>
            <TabsSubtleList className={compact ? 'h-7 gap-0.5' : undefined}>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="all"
                >
                    All
                    <CronFilterCount compact={compact} count={totalJobs} />
                </TabsSubtleItem>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="active"
                >
                    Active
                    <CronFilterCount compact={compact} count={enabledJobs} />
                </TabsSubtleItem>
                <TabsSubtleItem
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="paused"
                >
                    Paused
                    <CronFilterCount compact={compact} count={pausedJobs} />
                </TabsSubtleItem>
            </TabsSubtleList>
        </TabsSubtle>
    );
}

function CronFilterCount({ compact, count }: { compact: boolean; count: number }) {
    if (compact) {
        return <Badge variant="secondary">{count}</Badge>;
    }

    return (
        <span className="text-muted-foreground/64 tabular-nums data-active:text-foreground/48">
            {count}
        </span>
    );
}
