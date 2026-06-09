import type { ReactNode } from 'react';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { useLayoutContext } from '../shell/use-layout-context.ts';

export function StatsAvailabilityGate({ children }: { children: ReactNode }) {
    const gate = useCapability('models');
    const { navigateToSettings } = useLayoutContext();

    if (gate.healthy) {
        return children;
    }

    return (
        <EmptyState
            actionLabel="Open Tavern Runtime settings"
            description={runtimeUnhealthyTooltip}
            eyebrow="Stats"
            onAction={navigateToSettings}
            title="Stats are waiting on Tavern Runtime."
        />
    );
}
