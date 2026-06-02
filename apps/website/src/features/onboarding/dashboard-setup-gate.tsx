import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AgentRuntimeConnectionStatus } from '../../hooks/connections/use-agent-runtime-connection.ts';
import { useAgentRuntimeConnection } from '../../hooks/connections/use-agent-runtime-connection.ts';

export function DashboardSetupGate() {
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const location = useLocation();

    if (shouldRedirectToRuntimeOnboarding(agentRuntimeConnection.status, location.pathname)) {
        return <Navigate replace state={{ from: location }} to="/onboarding" />;
    }

    return <Outlet />;
}

export function shouldRedirectToRuntimeOnboarding(
    status: AgentRuntimeConnectionStatus,
    pathname = ''
) {
    if (pathname === '/dashboard/chat-layout-preview') {
        return false;
    }

    return status === 'unconfigured' || status === 'version-mismatch';
}
