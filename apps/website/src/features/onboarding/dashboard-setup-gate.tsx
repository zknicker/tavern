import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AgentRuntimeConnectionStatus } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { useAgentRuntimeConnection } from '../../hooks/connections/use-agent-runtime-connection.ts';

export function DashboardSetupGate() {
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const location = useLocation();

    if (shouldRedirectToRuntimeOnboarding(agentRuntimeConnection.status)) {
        return <Navigate replace state={{ from: location }} to="/onboarding" />;
    }

    return <Outlet />;
}

export function shouldRedirectToRuntimeOnboarding(status: AgentRuntimeConnectionStatus) {
    return status === 'unconfigured' || status === 'version-mismatch';
}
