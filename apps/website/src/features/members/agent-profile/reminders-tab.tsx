import { Notification03Icon } from '@hugeicons-pro/core-stroke-rounded';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../../components/ui/empty.tsx';
import { Icon } from '../../../components/ui/icon.tsx';

export function AgentRemindersTab(_props: { agentId: string }) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Icon icon={Notification03Icon} />
                </EmptyMedia>
                <EmptyTitle className="text-base">Reminders</EmptyTitle>
                <EmptyDescription className="text-sm">
                    Reminders arrive with the tasks-and-reminders workstream. Until then, agents
                    have no scheduler.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
