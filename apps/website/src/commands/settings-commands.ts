import { UserCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { staticSettingsNavItems } from '../features/settings/layout/navigation.ts';
import {
    formatCapabilityDisabledReason,
    settingsCapabilityRequirements,
} from '../hooks/connections/use-capability.ts';
import { appRoutes } from '../lib/app-routes.ts';
import type { AppCommand, AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildSettingsCommandGroup(context: AppCommandBuildContext): AppCommandGroup {
    const staticCommands: AppCommand[] = staticSettingsNavItems.map((item) => {
        const gate = context.resolveCapability(
            settingsCapabilityRequirements[
                item.id as keyof typeof settingsCapabilityRequirements
            ] ?? []
        );

        return {
            disabledReason: gate.healthy ? null : formatCapabilityDisabledReason(gate),
            icon: item.icon,
            id: `settings.${item.id}`,
            keywords: ['settings', 'preferences', item.id, item.label],
            run: () => context.navigate(item.to),
            title: item.label,
        };
    });

    return {
        commands: [
            {
                icon: UserCircleIcon,
                id: 'settings.agents',
                keywords: ['settings', 'agent', 'agents', 'assistant'],
                run: () => context.navigate(appRoutes.members),
                title: 'Members',
            },
            ...staticCommands,
        ],
        id: 'settings',
        title: 'Settings',
    };
}
