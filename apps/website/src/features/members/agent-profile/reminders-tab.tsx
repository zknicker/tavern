import { Notification03Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Badge } from '../../../components/ui/badge.tsx';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../../components/ui/empty.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { useCronList } from '../../../hooks/cron/use-cron-list.ts';
import { buildCronList } from '../../cron/cron-list-data.ts';
import { selectAgentReminders } from './reminders.ts';

export function AgentRemindersTab({ agentId }: { agentId: string }) {
    const jobsQuery = useCronList();
    const reminders = buildCronList(selectAgentReminders(jobsQuery.data?.jobs ?? [], agentId));

    if (jobsQuery.isPending) {
        return (
            <p className="flex items-center gap-2 px-6 py-10 text-muted-foreground text-sm">
                <Spinner className="size-4" />
                Loading reminders...
            </p>
        );
    }

    if (jobsQuery.isError) {
        return <p className="px-6 py-10 text-destructive text-sm">Could not load reminders.</p>;
    }

    if (reminders.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Icon icon={Notification03Icon} />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">No reminders yet</EmptyTitle>
                    <EmptyDescription className="text-sm">
                        This agent hasn&apos;t scheduled anything. To set one, just tell your agent:
                        {' “remind me tomorrow to follow up.”'}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl py-6">
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {reminders.map((reminder) => (
                    <li
                        className="flex items-start justify-between gap-4 px-4 py-3"
                        key={reminder.id}
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-semibold text-foreground text-sm">
                                    {reminder.name}
                                </span>
                                <Badge variant={reminder.enabled ? 'success' : 'secondary'}>
                                    {reminder.enabled ? 'Enabled' : 'Paused'}
                                </Badge>
                            </div>
                            {reminder.description ? (
                                <p className="mt-1 text-muted-foreground text-sm">
                                    {reminder.description}
                                </p>
                            ) : null}
                            <p className="mt-1 text-meta text-muted-foreground">
                                {reminder.schedule}
                            </p>
                        </div>
                        <div className="shrink-0 text-right text-meta text-muted-foreground">
                            <div>{reminder.lastRun}</div>
                            <div className="capitalize">{reminder.successRate}</div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
