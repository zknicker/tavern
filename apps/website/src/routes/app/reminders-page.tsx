import { Notification03Icon } from '@hugeicons-pro/core-stroke-rounded';
import { WorkstreamEmptyPage } from '../../features/shell/workstream-empty-page.tsx';

export function RemindersPage() {
    return (
        <WorkstreamEmptyPage
            description="Reminders arrive with the tasks-and-reminders workstream. Until then, agents have no scheduler."
            icon={Notification03Icon}
            title="Reminders"
        />
    );
}
