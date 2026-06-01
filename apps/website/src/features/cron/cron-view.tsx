import { Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { CronEmptyResults } from './cron-empty-results.tsx';
import { CronFilterTabs } from './cron-filter-tabs.tsx';
import { CronJobsList } from './cron-jobs-list.tsx';
import type { CronListItem } from './cron-list-data.ts';
import { CronMobileHeader } from './cron-mobile-header.tsx';
import type { CronFilter } from './filter-cron-jobs.ts';

interface CronViewProps {
    actionErrorMessage: string | null;
    activeDeleteJobId: string | null;
    activeRunJobId: string | null;
    activeToggleJobId: string | null;
    avatarDirectory: DashboardAvatarDirectory;
    canEdit: boolean;
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    cronJobs: CronListItem[];
    enabledJobs: number;
    filter: CronFilter;
    filteredJobs: CronListItem[];
    isMutating: boolean;
    onClearFilters: () => void;
    onCreate: () => void;
    onDelete: (job: CronListItem) => Promise<void>;
    onEdit: (job: CronListItem) => void;
    onFilterChange: (filter: CronFilter) => void;
    onNavigateToSettings: () => void;
    onQueryChange: (query: string) => void;
    onRun: (job: CronListItem) => Promise<void>;
    onToggle: (job: CronListItem, enabled: boolean) => Promise<void>;
    pausedJobs: number;
    query: string;
    totalJobs: number;
}

export function CronView({
    actionErrorMessage,
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    avatarDirectory,
    canEdit,
    connectionState,
    cronJobs,
    enabledJobs,
    filter,
    filteredJobs,
    isMutating,
    onCreate,
    onClearFilters,
    onDelete,
    onEdit,
    onFilterChange,
    onNavigateToSettings,
    onQueryChange,
    onRun,
    onToggle,
    pausedJobs,
    query,
    totalJobs,
}: CronViewProps) {
    if (cronJobs.length === 0 && connectionState !== 'reachable') {
        return (
            <EmptyState
                actionLabel="Open settings"
                description="Automations appear after Tavern can talk to Tavern Runtime. Connect or repair Tavern Runtime from settings, then any configured automations will show up here."
                eyebrow="Automations"
                onAction={onNavigateToSettings}
                title="Automations are waiting on Tavern Runtime."
            />
        );
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <CronMobileHeader
                enabledJobs={enabledJobs}
                filter={filter}
                isMutating={isMutating}
                onCreate={onCreate}
                onFilterChange={onFilterChange}
                pausedJobs={pausedJobs}
                totalJobs={totalJobs}
            />

            <div className="hidden justify-end py-3 pr-3 pl-5 md:flex">
                <Button disabled={isMutating} onClick={onCreate} type="button" variant="secondary">
                    <Icon aria-hidden="true" icon={Plus} />
                    New Automation
                </Button>
            </div>

            {actionErrorMessage ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{actionErrorMessage}</p>
                </div>
            ) : null}

            {cronJobs.length === 0 ? (
                <EmptyState
                    actionLabel="Create your first automation"
                    description="Create an automation to schedule recurring work for your agent."
                    eyebrow="Automations"
                    onAction={onCreate}
                    title="No automations configured"
                />
            ) : (
                <ScrollArea className="flex-1">
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <CronFilterTabs
                                enabledJobs={enabledJobs}
                                filter={filter}
                                onFilterChange={onFilterChange}
                                pausedJobs={pausedJobs}
                                totalJobs={totalJobs}
                            />
                            <SearchInput
                                aria-label="Search automations"
                                className="w-full sm:ml-auto sm:max-w-xs"
                                name="automation-search"
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Search automations..."
                                value={query}
                            />
                        </div>

                        {filteredJobs.length > 0 ? (
                            <CronJobsList
                                activeDeleteJobId={activeDeleteJobId}
                                activeRunJobId={activeRunJobId}
                                activeToggleJobId={activeToggleJobId}
                                avatarDirectory={avatarDirectory}
                                canEdit={canEdit}
                                jobs={filteredJobs}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onRun={onRun}
                                onToggle={onToggle}
                            />
                        ) : (
                            <CronEmptyResults
                                filter={filter}
                                onClearFilters={onClearFilters}
                                query={query}
                            />
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
