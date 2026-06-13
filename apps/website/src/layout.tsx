import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from './components/ui/app-shell.tsx';
import { AppTopbar } from './features/shell/topbar.tsx';
import { useRouteTab } from './hooks/dashboard/use-route-tab.ts';

export interface DashboardLayoutContextValue {
    navigateToSettings: () => void;
}

export function Layout() {
    const { activeTab, setActiveTab } = useRouteTab();
    const location = useLocation();
    const navigate = useNavigate();

    const navigateToSettings = React.useCallback(() => navigate('/dashboard/settings'), [navigate]);
    const isSettingsRoute = location.pathname.startsWith('/dashboard/settings');

    return (
        <div className="dashboard-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <AppShell className="w-full">
                <AppShellDragRegion />
                <AppTopbar
                    activeTab={activeTab}
                    isSettingsRoute={isSettingsRoute}
                    onNavigateToSettings={navigateToSettings}
                    onSelectTab={setActiveTab}
                />
                <AppShellBody>
                    <AppShellMain>
                        <Outlet
                            context={{
                                navigateToSettings,
                            }}
                        />
                    </AppShellMain>
                </AppShellBody>
            </AppShell>
        </div>
    );
}
