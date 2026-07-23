import { Notification03Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useRelativeNow } from '../../../components/time/relative-time.tsx';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../../components/ui/empty.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useReminderList, useReminderRuns } from '../../../hooks/reminders/use-reminder-list.ts';
import { buildReminderList } from '../../reminders/reminder-list-data.ts';
import { RemindersList } from '../../reminders/reminders-list.tsx';

export function AgentRemindersTab({ agentId }: { agentId: string }) {
    const remindersQuery = useReminderList();
    const runsQuery = useReminderRuns();
    const relativeNow = useRelativeNow();
    const reminders = React.useMemo(
        () =>
            buildReminderList(
                (remindersQuery.data?.reminders ?? []).filter(
                    ({ owner_agent_id }) => owner_agent_id === agentId
                ),
                runsQuery.data?.runs ?? [],
                relativeNow
            ),
        [agentId, relativeNow, remindersQuery.data?.reminders, runsQuery.data?.runs]
    );

    if (reminders.length > 0) {
        return <RemindersList readOnly reminders={reminders} />;
    }

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Icon icon={Notification03Icon} />
                </EmptyMedia>
                <EmptyTitle className="text-base">Reminders</EmptyTitle>
                <EmptyDescription className="text-sm">
                    Just tell your agent what to remember and when.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
