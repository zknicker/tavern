import type { ReactNode } from 'react';
import {
    routeTabCapabilityRequirements,
    runtimeUnhealthyTooltip,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { useLayoutContext } from '../shell/use-layout-context.ts';

export function CronAvailabilityGate({ children }: { children: ReactNode }) {
    const capability = useCapability();
    const gate = capability(routeTabCapabilityRequirements.automations);
    const { navigateToSettings } = useLayoutContext();

    if (gate.healthy) {
        return children;
    }

    return (
        <EmptyState
            actionLabel="Open Tavern Runtime settings"
            description={runtimeUnhealthyTooltip}
            eyebrow="Automations"
            onAction={navigateToSettings}
            title="Automations are waiting on Tavern Runtime."
        />
    );
}
