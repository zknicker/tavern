import { ChatAddIcon, CheckListIcon, ClockAddIcon } from '@hugeicons-pro/core-stroke-rounded';
import {
    agentCapabilityRequirements,
    formatCapabilityDisabledReason,
    newChatCapabilityRequirements,
    routeTabCapabilityRequirements,
} from '../hooks/connections/use-capability.ts';
import { appRoutes } from '../lib/app-routes.ts';
import type { AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildCreateCommandGroup(context: AppCommandBuildContext): AppCommandGroup {
    const newChatGate = context.resolveCapability(newChatCapabilityRequirements);
    const newTaskGate = context.resolveCapability(routeTabCapabilityRequirements.tasks);
    const newAutomationGate = context.resolveCapability([
        ...agentCapabilityRequirements,
        'cron',
    ] as const);

    return {
        commands: [
            {
                disabledReason: newChatGate.healthy
                    ? null
                    : formatCapabilityDisabledReason(newChatGate),
                icon: ChatAddIcon,
                id: 'create.chat',
                keywords: ['chat', 'dm', 'message', 'start'],
                run: () => context.navigate(appRoutes.newChatDraft),
                title: 'New Chat',
            },
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
                disabledReason: newAutomationGate.healthy
                    ? null
                    : formatCapabilityDisabledReason(newAutomationGate),
                icon: ClockAddIcon,
                id: 'create.automation',
                keywords: ['automation', 'cron', 'scheduled work', 'job'],
                run: () => context.navigate(appRoutes.newAutomation),
                title: 'New Automation',
            },
        ],
        id: 'create',
        title: 'Create',
    };
}
