import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from './components/ui/app-shell.tsx';
import { SidebarProvider } from './components/ui/sidebar.tsx';
import { AppIconRail } from './features/shell/app-icon-rail.tsx';
import { shouldShowMainTopDragFade } from './features/shell/main-top-drag-fade.ts';
import { AppSidebar } from './features/shell/sidebar.tsx';
import { appRoutes } from './lib/app-routes.ts';

export interface AppLayoutContextValue {
    navigateToSettings: () => void;
}

export function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    // Tool sections bring their own left panel, so the full rail collapses
    // to the icon strip there instead of nesting two sidebars.
    // Wiki keeps its tool-route layout while the page stays URL-reachable
    // (rail tab retired; the page itself goes with the memory/wiki cut).
    const isToolRoute = [
        appRoutes.search,
        appRoutes.tasks,
        appRoutes.reminders,
        appRoutes.members,
        appRoutes.wiki,
    ].some((path) => location.pathname.startsWith(path));

    const isSettingsRoute = location.pathname.startsWith(appRoutes.settings);
    const showMainTopDragFade = shouldShowMainTopDragFade(location.pathname);
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const lastAppPathRef = React.useRef<string>(appRoutes.activity);
    React.useEffect(() => {
        if (!isSettingsRoute) {
            lastAppPathRef.current = currentPath;
        }
    }, [currentPath, isSettingsRoute]);
    const navigateToSettings = React.useCallback(() => {
        if (!isSettingsRoute) {
            lastAppPathRef.current = currentPath;
        }

        navigate(appRoutes.settings);
    }, [currentPath, isSettingsRoute, navigate]);
    const navigateBackToApp = React.useCallback(() => navigate(lastAppPathRef.current), [navigate]);

    return (
        <SidebarProvider className="app-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <AppShell className="w-full" data-app-layout="sidebar">
                <AppShellDragRegion />
                <AppShellBody className="pt-0 md:flex-row">
                    <AppIconRail />
                    {isToolRoute ? null : (
                        <AppSidebar
                            isSettingsRoute={isSettingsRoute}
                            onBackToApp={navigateBackToApp}
                        />
                    )}
                    <AppShellMain
                        data-edge-to-edge="true"
                        data-rail-flush={isToolRoute ? 'true' : undefined}
                    >
                        {showMainTopDragFade ? <SidebarMainTopDragFade /> : null}
                        <Outlet
                            context={{
                                navigateToSettings,
                            }}
                        />
                    </AppShellMain>
                </AppShellBody>
            </AppShell>
        </SidebarProvider>
    );
}

function SidebarMainTopDragFade() {
    return (
        <div
            aria-hidden="true"
            className="app-shell-main-top-drag-fade"
            data-window-drag-region=""
        />
    );
}
