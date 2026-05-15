import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from './components/ui/app-shell.tsx';
import { SidebarProvider } from './components/ui/sidebar.tsx';
import { SessionDrawerHost } from './features/sessions/session-drawer.tsx';
import { AppSidebar } from './features/shell/sidebar.tsx';
import { AppTopbar } from './features/shell/topbar.tsx';
import { useAgentActivity } from './hooks/agents/use-agent-activity.ts';
import { usePrimaryAgent } from './hooks/agents/use-agent-list.ts';
import { useAgentRail } from './hooks/agents/use-agent-rail.ts';
import { useRouteTab } from './hooks/dashboard/use-route-tab.ts';
import { useWindowNavigation } from './hooks/navigation/use-window-navigation.ts';
import { SessionDrawerProvider } from './hooks/sessions/use-session-drawer.ts';

export interface DashboardLayoutContextValue {
    navigateToSettings: () => void;
}

export function Layout() {
    const primaryAgentQuery = usePrimaryAgent();
    const agentActivityQuery = useAgentActivity();
    const { activeTab, setActiveTab } = useRouteTab();
    const location = useLocation();
    const navigate = useNavigate();
    const windowNavigation = useWindowNavigation();
    const sidebarAgents = useAgentRail(
        primaryAgentQuery.data?.agent ? [primaryAgentQuery.data.agent] : [],
        agentActivityQuery.data?.activity ?? []
    );

    const navigateToSettings = React.useCallback(() => navigate('/dashboard/settings'), [navigate]);
    const navigateToApp = React.useCallback(() => navigate('/dashboard/overview'), [navigate]);
    const isSettingsRoute = location.pathname.startsWith('/dashboard/settings');

    return (
        <SidebarProvider className="dashboard-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <AppShell className="w-full">
                <AppShellDragRegion />
                <AppTopbar
                    canGoBack={windowNavigation.canGoBack}
                    canGoForward={windowNavigation.canGoForward}
                    onGoBack={windowNavigation.goBack}
                    onGoForward={windowNavigation.goForward}
                />
                <AppShellBody>
                    <AppSidebar
                        activeTab={activeTab}
                        isSettingsRoute={isSettingsRoute}
                        onBackToApp={navigateToApp}
                        onNavigateToSettings={navigateToSettings}
                        onSelectTab={setActiveTab}
                        sidebarAgents={sidebarAgents}
                    />

                    <AppShellMain>
                        <SessionDrawerProvider>
                            <Outlet
                                context={{
                                    navigateToSettings,
                                }}
                            />
                            <SessionDrawerHost />
                        </SessionDrawerProvider>
                    </AppShellMain>
                </AppShellBody>
            </AppShell>
        </SidebarProvider>
    );
}
