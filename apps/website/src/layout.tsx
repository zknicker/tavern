import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from './components/ui/app-shell.tsx';
import { SidebarProvider } from './components/ui/sidebar.tsx';
import { shouldShowMainTopDragFade } from './features/shell/main-top-drag-fade.ts';
import { AppSidebar } from './features/shell/sidebar.tsx';
import { AppSidebarTopbar, AppTopbar } from './features/shell/topbar.tsx';
import {
    useAppLayoutPreference,
    useAppLayoutSearchParam,
} from './hooks/dashboard/use-app-layout-preference.ts';
import { useRouteTab } from './hooks/dashboard/use-route-tab.ts';

export interface DashboardLayoutContextValue {
    navigateToSettings: () => void;
}

const sidebarPinnedOpenStorageKey = 'tavern.sidebar.pinnedOpen.v1';

export function Layout() {
    const { activeTab, setActiveTab } = useRouteTab();
    const appLayout = useAppLayoutPreference();
    const location = useLocation();
    const navigate = useNavigate();
    useAppLayoutSearchParam();
    const sidebarWrapperRef = React.useRef<HTMLDivElement | null>(null);
    const [isSidebarPinnedOpen, setIsSidebarPinnedOpenState] = React.useState(
        getInitialSidebarPinnedOpen
    );
    const [isSidebarPreviewOpen, setIsSidebarPreviewOpen] = React.useState(false);
    const sidebarPreviewCloseTimeoutRef = React.useRef<number | null>(null);
    const clearSidebarPreviewCloseTimeout = React.useCallback(() => {
        if (sidebarPreviewCloseTimeoutRef.current !== null) {
            window.clearTimeout(sidebarPreviewCloseTimeoutRef.current);
            sidebarPreviewCloseTimeoutRef.current = null;
        }
    }, []);
    const openSidebarPreview = React.useCallback(() => {
        clearSidebarPreviewCloseTimeout();
        setIsSidebarPreviewOpen(true);
    }, [clearSidebarPreviewCloseTimeout]);
    const closeSidebarPreview = React.useCallback(() => {
        clearSidebarPreviewCloseTimeout();
        setIsSidebarPreviewOpen(false);
    }, [clearSidebarPreviewCloseTimeout]);
    const scheduleSidebarPreviewClose = React.useCallback(() => {
        clearSidebarPreviewCloseTimeout();
        sidebarPreviewCloseTimeoutRef.current = window.setTimeout(() => {
            setIsSidebarPreviewOpen(false);
            sidebarPreviewCloseTimeoutRef.current = null;
        }, 120);
    }, [clearSidebarPreviewCloseTimeout]);
    React.useEffect(
        () => () => {
            clearSidebarPreviewCloseTimeout();
        },
        [clearSidebarPreviewCloseTimeout]
    );
    const setSidebarPinnedOpen = React.useCallback((open: boolean) => {
        setIsSidebarPinnedOpenState(open);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(sidebarPinnedOpenStorageKey, String(open));
        }
    }, []);

    const isSettingsRoute = location.pathname.startsWith('/dashboard/settings');
    const showSidebarPreview =
        appLayout.mode === 'sidebar' && !isSidebarPinnedOpen && isSidebarPreviewOpen;
    const showMainTopDragFade = shouldShowMainTopDragFade(location.pathname);
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const lastAppPathRef = React.useRef('/dashboard/overview');
    React.useEffect(() => {
        if (!isSettingsRoute) {
            lastAppPathRef.current = currentPath;
        }
    }, [currentPath, isSettingsRoute]);
    const navigateToSettings = React.useCallback(() => {
        if (!isSettingsRoute) {
            lastAppPathRef.current = currentPath;
        }

        navigate('/dashboard/settings');
    }, [currentPath, isSettingsRoute, navigate]);
    const navigateBackToApp = React.useCallback(() => navigate(lastAppPathRef.current), [navigate]);
    const outlet = (
        <Outlet
            context={{
                navigateToSettings,
            }}
        />
    );

    if (appLayout.mode === 'sidebar') {
        return (
            <SidebarProvider
                className="dashboard-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0"
                data-sidebar-preview-open={showSidebarPreview ? 'true' : undefined}
                onOpenChange={(open) => {
                    if (!open) {
                        blurFocusedSidebarElement(sidebarWrapperRef.current);
                    }
                    setSidebarPinnedOpen(open);
                    closeSidebarPreview();
                }}
                open={isSidebarPinnedOpen}
                ref={sidebarWrapperRef}
            >
                <AppShell className="w-full" data-app-layout="sidebar">
                    <AppShellDragRegion />
                    <AppSidebarTopbar
                        isExpanded={isSidebarPinnedOpen || showSidebarPreview}
                        isPreview={showSidebarPreview}
                        onMouseEnter={showSidebarPreview ? openSidebarPreview : undefined}
                        onMouseLeave={showSidebarPreview ? scheduleSidebarPreviewClose : undefined}
                    />
                    <AppShellBody className="pt-0 md:flex-row">
                        <AppSidebar
                            activeTab={activeTab}
                            isSettingsRoute={isSettingsRoute}
                            onBackToApp={navigateBackToApp}
                            onMouseEnter={openSidebarPreview}
                            onMouseLeave={scheduleSidebarPreviewClose}
                            onNavigateToSettings={navigateToSettings}
                            onSelectTab={setActiveTab}
                        />
                        <AppShellMain data-edge-to-edge="true">
                            {showMainTopDragFade ? <SidebarMainTopDragFade /> : null}
                            {outlet}
                        </AppShellMain>
                    </AppShellBody>
                    {isSidebarPinnedOpen || showSidebarPreview ? null : (
                        <SidebarHoverTarget
                            onPointerEnter={openSidebarPreview}
                            onPointerLeave={scheduleSidebarPreviewClose}
                            onPointerMove={openSidebarPreview}
                        />
                    )}
                </AppShell>
            </SidebarProvider>
        );
    }

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
                    <AppShellMain>{outlet}</AppShellMain>
                </AppShellBody>
            </AppShell>
        </div>
    );
}

function SidebarHoverTarget({
    onPointerEnter,
    onPointerLeave,
    onPointerMove,
}: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onPointerMove: () => void;
}) {
    return (
        <div
            aria-hidden="true"
            className="fixed inset-y-0 left-0 z-30 hidden w-8 md:block"
            data-sidebar-hover-target="true"
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onPointerMove={onPointerMove}
        />
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

function getInitialSidebarPinnedOpen() {
    if (typeof window === 'undefined') {
        return true;
    }

    const saved = window.localStorage.getItem(sidebarPinnedOpenStorageKey);

    return saved === null ? true : saved === 'true';
}

function blurFocusedSidebarElement(wrapper: HTMLElement | null) {
    const sidebarContainer = wrapper?.querySelector<HTMLElement>('[data-slot="sidebar-container"]');
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement && sidebarContainer?.contains(activeElement)) {
        activeElement.blur();
    }
}
