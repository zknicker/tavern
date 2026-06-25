import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const routeTabs = [
    { id: 'overview', label: 'Tavern', path: '/dashboard/overview' },
    { id: 'cron', label: 'Tasks', path: '/dashboard/cron' },
    { id: 'memory', label: 'Memory', path: '/dashboard/memory' },
    { id: 'vault', label: 'Vault', path: '/dashboard/vault' },
] as const;

type RouteTab = (typeof routeTabs)[number]['id'];

const routeTabIds = new Set<RouteTab>(routeTabs.map((tab) => tab.id));

function isRouteTab(value: string | null): value is RouteTab {
    return value !== null && routeTabIds.has(value as RouteTab);
}

export function getRouteTab(pathname: string): RouteTab | null {
    const segments = pathname.split('/').filter(Boolean);
    const primaryTab = segments[1] ?? null;
    const secondaryTab = segments[2] ?? null;

    if (isRouteTab(primaryTab)) {
        return primaryTab;
    }

    if (isRouteTab(secondaryTab)) {
        return secondaryTab;
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
                navigate(nextRoute ?? '/dashboard/overview');
            },
        }),
        [activeTab, navigate]
    );
}

export type { RouteTab };
