import { Badge } from '../../components/ui/badge.tsx';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';
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
        <Tabs onValueChange={(value) => onFilterChange(value as CronFilter)} value={filter}>
            <TabsList className={compact ? 'h-7 gap-0.5' : undefined}>
                <TabsTrigger
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="all"
                >
                    All
                    <CronFilterCount compact={compact} count={totalJobs} />
                </TabsTrigger>
                <TabsTrigger
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="active"
                >
                    Active
                    <CronFilterCount compact={compact} count={enabledJobs} />
                </TabsTrigger>
                <TabsTrigger
                    className={compact ? 'h-6 px-2 text-xs' : undefined}
                    size="sm"
                    value="paused"
                >
                    Paused
                    <CronFilterCount compact={compact} count={pausedJobs} />
                </TabsTrigger>
            </TabsList>
        </Tabs>
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
