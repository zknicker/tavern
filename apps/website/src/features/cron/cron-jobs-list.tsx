import * as React from 'react';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { CardStack, CardStackItem } from '../../components/ui/card-stack.tsx';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { CronJobActions } from './cron-job-actions.tsx';
import { CronJobLastRun, CronJobResultBadge } from './cron-job-status.tsx';
import type { CronListItem } from './cron-list-data.ts';

interface CronJobsListProps {
    activeDeleteJobId: string | null;
    activeRunJobId: string | null;
    activeToggleJobId: string | null;
    avatarDirectory: DashboardAvatarDirectory;
    canEdit: boolean;
    jobs: CronListItem[];
    onDelete: (job: CronListItem) => Promise<void>;
    onEdit: (job: CronListItem) => void;
    onHistory: (job: CronListItem) => void;
    onRun: (job: CronListItem) => Promise<void>;
    onToggle: (job: CronListItem, enabled: boolean) => Promise<void>;
}

interface CronJobCardProps extends Omit<CronJobsListProps, 'avatarDirectory' | 'jobs'> {
    avatarDirectory: DashboardAvatarDirectory;
    job: CronListItem;
}

function CronJobCard({
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    avatarDirectory,
    canEdit,
    job,
    onDelete,
    onEdit,
    onHistory,
    onRun,
    onToggle,
}: CronJobCardProps) {
    const agentAvatar = avatarDirectory.get(job.job.agentId ?? job.channelId);
    const openJob = React.useCallback(() => onEdit(job), [job, onEdit]);

    return (
        <CardStackItem
            actions={
                <CronJobActions
                    canEdit={canEdit}
                    isDeleting={activeDeleteJobId === job.id}
                    isRunning={activeRunJobId === job.id}
                    isToggling={activeToggleJobId === job.id}
                    job={job}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    onRun={onRun}
                    onToggle={onToggle}
                />
            }
            onOpen={openJob}
            openLabel={`Open ${job.name}`}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <AgentAvatar
                    avatar={agentAvatar.avatar}
                    backgroundColor={agentAvatar.backgroundColor}
                    className="size-7 shrink-0"
                    name={job.channelId}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">{job.name}</p>
                        <span className="hidden text-muted-foreground text-sm md:inline">·</span>
                        <span className="hidden min-w-0 truncate font-mono text-muted-foreground text-sm md:inline">
                            {job.schedule}
                        </span>
                        <span className="hidden text-muted-foreground text-sm lg:inline">·</span>
                        <div className="hidden items-center gap-2 lg:flex">
                            <CronJobLastRun job={job} />
                            <CronJobResultBadge job={job} />
                        </div>
                    </div>
                    {job.lastErrorMessage ? (
                        <p
                            className="max-w-[48rem] truncate text-error-foreground text-xs"
                            title={job.lastErrorRaw ?? job.lastErrorMessage}
                        >
                            {job.lastErrorMessage}
                        </p>
                    ) : null}
                </div>
            </div>
        </CardStackItem>
    );
}

export function CronJobsList({
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    avatarDirectory,
    canEdit,
    jobs,
    onDelete,
    onEdit,
    onHistory,
    onRun,
    onToggle,
}: CronJobsListProps) {
    return (
        <CardStack>
            {jobs.map((job) => (
                <CronJobCard
                    activeDeleteJobId={activeDeleteJobId}
                    activeRunJobId={activeRunJobId}
                    activeToggleJobId={activeToggleJobId}
                    avatarDirectory={avatarDirectory}
                    canEdit={canEdit}
                    job={job}
                    key={job.id}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    onRun={onRun}
                    onToggle={onToggle}
                />
            ))}
        </CardStack>
    );
}
