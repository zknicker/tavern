import { CheckListIcon } from '@hugeicons-pro/core-stroke-rounded';
import { WorkstreamEmptyPage } from '../../features/shell/workstream-empty-page.tsx';

export function TasksPage() {
    return (
        <WorkstreamEmptyPage
            description="Tasks return with the chat-first tasks workstream."
            icon={CheckListIcon}
            title="Tasks"
        />
    );
}
