import { Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { CronFilterTabs } from './cron-filter-tabs.tsx';
import type { CronFilter } from './filter-cron-jobs.ts';

interface CronMobileHeaderProps {
    enabledJobs: number;
    filter: CronFilter;
    isMutating: boolean;
    onCreate: () => void;
    onFilterChange: (filter: CronFilter) => void;
    pausedJobs: number;
    totalJobs: number;
}

export function CronMobileHeader({
    enabledJobs,
    filter,
    isMutating,
    onCreate,
    onFilterChange,
    pausedJobs,
    totalJobs,
}: CronMobileHeaderProps) {
    return (
        <div className="flex items-center gap-2 border-border/60 border-b px-3 py-1.5 md:hidden">
            <CronFilterTabs
                compact
                enabledJobs={enabledJobs}
                filter={filter}
                onFilterChange={onFilterChange}
                pausedJobs={pausedJobs}
                totalJobs={totalJobs}
            />

            <Button
                className="ml-auto gap-1.5"
                disabled={isMutating}
                onClick={onCreate}
                size="xs"
                type="button"
            >
                <Icon className="size-3.5" icon={Plus} />
                New Automation
            </Button>
        </div>
    );
}
