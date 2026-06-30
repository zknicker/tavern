import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from './components/ui/app-shell.tsx';
import { SidebarProvider } from './components/ui/sidebar.tsx';
import { TavernBrowserShell } from './features/shell/browser-shell/tavern-browser-shell.tsx';
import { shouldShowMainTopDragFade } from './features/shell/main-top-drag-fade.ts';
import { AppSidebar } from './features/shell/sidebar.tsx';
import { AppSidebarTopbar } from './features/shell/topbar.tsx';
import { useSidebarPreviewHover } from './features/shell/use-sidebar-preview-hover.ts';
import {
    useAppLayoutPreference,
    useAppLayoutSearchParam,
} from './hooks/shell/use-app-layout-preference.ts';
import { useRouteTab } from './hooks/shell/use-route-tab.ts';
import { appRoutes } from './lib/app-routes.ts';
import { getDesktopBridge, getDesktopSurface } from './lib/desktop-bridge.ts';

export interface AppLayoutContextValue {
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
    const {
        closeSidebarPreview,
        openSidebarPreview,
        scheduleSidebarPreviewClose,
        showSidebarPreview,
    } = useSidebarPreviewHover({
        enabled: appLayout.mode === 'sidebar',
        isPinnedOpen: isSidebarPinnedOpen,
        sidebarWrapperRef,
    });
    const setSidebarPinnedOpen = React.useCallback((open: boolean) => {
        setIsSidebarPinnedOpenState(open);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(sidebarPinnedOpenStorageKey, String(open));
        }
    }, []);

    const isSettingsRoute = location.pathname.startsWith(appRoutes.settings);
    const showMainTopDragFade = shouldShowMainTopDragFade(location.pathname);
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const lastAppPathRef = React.useRef<string>(appRoutes.overview);
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
    const outlet = (
        <Outlet
            context={{
                navigateToSettings,
            }}
        />
    );

    // A per-tab content view (desktop WebContentsView): render only the page, no chrome —
    // the window's chrome web contents draws the tab strip and toolbar.
    if (getDesktopSurface() === 'content') {
        return (
            <div className="app-reference-theme flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[var(--browser-card)]">
                <ContentViewNavigation />
                <div
                    className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                    data-slot="app-shell-main"
                >
                    {outlet}
                </div>
            </div>
        );
    }

    if (appLayout.mode === 'sidebar') {
        return (
            <SidebarProvider
                className="app-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0"
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
        <div className="app-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <TavernBrowserShell
                activeRouteTab={activeTab}
                isSettingsRoute={isSettingsRoute}
                onNavigateToSettings={navigateToSettings}
                onSelectRouteTab={setActiveTab}
            >
                {outlet}
            </TavernBrowserShell>
        </div>
    );
}

/** Applies chrome-initiated navigation (toolbar nav, tab activate) to this content view. */
function ContentViewNavigation() {
    const navigate = useNavigate();

    React.useEffect(() => {
        const bridge = getDesktopBridge();

        return bridge?.onNavigateTo?.((route) => {
            void navigate(route);
        });
    }, [navigate]);

    return null;
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
