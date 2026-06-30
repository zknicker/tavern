import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { RuntimeConnectionStatus } from '../../hooks/connections/use-runtime-connection.ts';
import { useRuntimeConnection } from '../../hooks/connections/use-runtime-connection.ts';

export function RuntimeSetupGate() {
    const runtimeConnection = useRuntimeConnection();
    const location = useLocation();

    if (
        shouldRedirectToRuntimeOnboarding(
            {
                hasConfiguredRuntime: Boolean(runtimeConnection.connection?.enabled),
                status: runtimeConnection.status,
            },
            location.pathname
        )
    ) {
        return <Navigate replace state={{ from: location }} to="/onboarding" />;
    }

    return <Outlet />;
}

export function shouldRedirectToRuntimeOnboarding(input: SetupGateState, _pathname = '') {
    if (input.status === 'checking' || input.status === 'error') {
        return false;
    }

    return !input.hasConfiguredRuntime;
}

interface SetupGateState {
    hasConfiguredRuntime: boolean;
    status: RuntimeConnectionStatus;
}
