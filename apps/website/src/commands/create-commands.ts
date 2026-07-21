import { CheckListIcon, ClockAddIcon } from '@hugeicons-pro/core-stroke-rounded';
import {
    agentCapabilityRequirements,
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
} from '../hooks/connections/use-capability.ts';
import { appRoutes } from '../lib/app-routes.ts';
import type { AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildCreateCommandGroup(context: AppCommandBuildContext): AppCommandGroup {
    const newTaskGate = context.resolveCapability(routeTabCapabilityRequirements.tasks);
    const newReminderGate = context.resolveCapability([...agentCapabilityRequirements, 'cron']);

    return {
        commands: [
            {
                disabledReason: newTaskGate.healthy
                    ? null
                    : formatCapabilityDisabledReason(newTaskGate),
                icon: CheckListIcon,
                id: 'create.task',
                keywords: ['task', 'issue', 'todo', 'tracker'],
                run: () => context.navigate(appRoutes.newTask),
                title: 'New Task',
            },
            {
                disabledReason: newReminderGate.healthy
                    ? null
                    : formatCapabilityDisabledReason(newReminderGate),
                icon: ClockAddIcon,
                id: 'create.reminder',
                keywords: ['reminder', 'cron', 'scheduled work', 'job'],
                run: () => context.navigate(appRoutes.newReminder),
                title: 'New Reminder',
            },
        ],
        id: 'create',
        title: 'Create',
    };
}
