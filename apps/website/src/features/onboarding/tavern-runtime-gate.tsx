import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAgentRuntimeConnection } from '../../hooks/connections/use-agent-runtime-connection.ts';

export function TavernRuntimeGate() {
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const location = useLocation();
    const isChatLayoutPreviewRoute = location.pathname.startsWith('/dashboard/chat-layout-preview');
    const isRuntimeSettingsRoute = location.pathname.startsWith(
        '/dashboard/settings/agent-runtime'
    );

    if (agentRuntimeConnection.status === 'checking' && !isChatLayoutPreviewRoute) {
        return <p className="p-6 text-muted-foreground text-sm">Loading Tavern Runtime…</p>;
    }

    if (
        agentRuntimeConnection.status === 'unconfigured' &&
        !(isRuntimeSettingsRoute || isChatLayoutPreviewRoute)
    ) {
        return <Navigate replace state={{ from: location }} to="/onboarding" />;
    }

    return <Outlet />;
}
