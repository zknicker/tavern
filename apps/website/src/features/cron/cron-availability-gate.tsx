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
    const gate = capability(routeTabCapabilityRequirements.reminders);
    const { navigateToSettings } = useLayoutContext();

    if (gate.healthy) {
        return children;
    }

    return (
        <EmptyState
            actionLabel="Open Grotto Runtime settings"
            description={runtimeUnhealthyTooltip}
            eyebrow="Reminders"
            onAction={navigateToSettings}
            title="Reminders are waiting on Grotto Runtime."
        />
    );
}
