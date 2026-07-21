import { getRouteTabIcon } from '../features/shell/route-tab-presentation.tsx';
import {
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
} from '../hooks/connections/use-capability.ts';
import { routeTabs } from '../hooks/shell/use-route-tab.ts';
import type { AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildNavigationCommandGroup(context: AppCommandBuildContext): AppCommandGroup {
    return {
        commands: routeTabs.map((tab) => {
            const gate = context.resolveCapability(routeTabCapabilityRequirements[tab.id]);

            return {
                disabledReason: gate.healthy ? null : formatCapabilityDisabledReason(gate),
                icon: getRouteTabIcon(tab.id),
                id: `navigation.${tab.id}`,
                keywords: ['go', 'open', tab.id, tab.label],
                run: () => context.navigate(tab.path),
                title: tab.label,
            };
        }),
        id: 'navigation',
        title: 'Navigation',
    };
}
