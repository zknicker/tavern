import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';

export const routeTabs = [
    { id: 'overview', label: 'Grotto', path: appRoutes.overview },
    { id: 'tasks', label: 'Tasks', path: appRoutes.tasks },
    { id: 'automations', label: 'Automations', path: appRoutes.automations },
    { id: 'workspace', label: 'Workspace', path: appRoutes.workspace },
    { id: 'wiki', label: 'Wiki', path: appRoutes.wiki },
] as const;

type RouteTab = (typeof routeTabs)[number]['id'];

const routeTabIds = new Set<RouteTab>(routeTabs.map((tab) => tab.id));

function isRouteTab(value: string | null): value is RouteTab {
    return value !== null && routeTabIds.has(value as RouteTab);
}

export function getRouteTab(pathname: string): RouteTab | null {
    const segments = pathname.split('/').filter(Boolean);
    const primaryTab = segments[0] === 'dashboard' ? (segments[1] ?? null) : (segments[0] ?? null);

    if (primaryTab === 'cron') {
        return 'automations';
    }

    if (isRouteTab(primaryTab)) {
        return primaryTab;
    }

    return null;
}

export function useRouteTab() {
    const location = useLocation();
    const navigate = useNavigate();
    const activeTab = getRouteTab(location.pathname);

    return React.useMemo(
        () => ({
            activeTab,
            tabs: routeTabs,
            setActiveTab(nextTab: RouteTab) {
                const nextRoute = routeTabs.find((tab) => tab.id === nextTab)?.path;
                navigate(nextRoute ?? appRoutes.overview);
            },
        }),
        [activeTab, navigate]
    );
}

export type { RouteTab };
