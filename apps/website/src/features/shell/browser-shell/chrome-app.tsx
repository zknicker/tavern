import * as React from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { getRouteTab, routeTabs } from '../../../hooks/dashboard/use-route-tab.ts';
import { getDesktopBridge } from '../../../lib/desktop-bridge.ts';
import { ChromeTabsProvider } from './chrome-tabs-provider.tsx';
import { useShell } from './shell-context.tsx';
import { TavernBrowserShellFrame } from './tavern-browser-shell.tsx';

/**
 * The desktop "chrome" surface: the window's own web contents renders just the tab strip and
 * toolbar. Each tab's page lives in a separate WebContentsView positioned by the main process
 * into the {@link ContentViewPlaceholder} region. A scratch MemoryRouter is a navigation sink
 * so router-driven menus (e.g. all-chats) forward to the active view.
 */
export function ChromeApp() {
    return (
        <MemoryRouter>
            <ChromeNavigationBridge />
            <ChromeTabsProvider>
                <ChromeShellFrame />
            </ChromeTabsProvider>
        </MemoryRouter>
    );
}

function ChromeShellFrame() {
    const { state } = useShell();
    const bridge = getDesktopBridge();
    const navigate = useNavigate();
    const activeRoute =
        state.tabs.find((tab) => tab.id === state.activeId)?.route ?? '/dashboard/overview';
    const pathname = activeRoute.split('?')[0];

    // Mirror the active tab's route into the scratch router so the static channel rail (which
    // reads useLocation) highlights the right chat. Guarded by a ref so it fires only when the
    // active tab's route truly changes: react-router recreates `navigate` on every navigation,
    // and without the guard the effect would re-run on a channel click and revert the scratch
    // router back to the previous tab's route before the forward lands.
    const syncedRouteRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (syncedRouteRef.current === activeRoute) {
            return;
        }

        syncedRouteRef.current = activeRoute;
        navigate(activeRoute, { replace: true });
    }, [activeRoute, navigate]);

    return (
        <TavernBrowserShellFrame
            activeRouteTab={getRouteTab(pathname)}
            isSettingsRoute={pathname.startsWith('/dashboard/settings')}
            onNavigateToSettings={() => void bridge?.navigateActiveView('/dashboard/settings')}
            onSelectRouteTab={(tab) => {
                const path = routeTabs.find((entry) => entry.id === tab)?.path;

                if (path) {
                    void bridge?.navigateActiveView(path);
                }
            }}
        >
            <ContentViewPlaceholder />
        </TavernBrowserShellFrame>
    );
}

/** Reports the content card's live bounds so main can position the active view over it. */
function ContentViewPlaceholder() {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const element = ref.current;
        const bridge = getDesktopBridge();

        if (!(element && bridge)) {
            return;
        }

        const report = () => {
            const rect = element.getBoundingClientRect();
            void bridge.setContentBounds({
                height: rect.height,
                width: rect.width,
                x: rect.left,
                y: rect.top,
            });
        };

        report();
        const observer = new ResizeObserver(report);
        observer.observe(element);
        window.addEventListener('resize', report);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', report);
        };
    }, []);

    return <div className="absolute inset-0" ref={ref} />;
}

/** Forwards scratch-router navigations (router-driven menus) to the active content view. */
function ChromeNavigationBridge() {
    const location = useLocation();
    const isInitial = React.useRef(true);

    React.useEffect(() => {
        if (isInitial.current) {
            isInitial.current = false;
            return;
        }

        void getDesktopBridge()?.navigateActiveView(`${location.pathname}${location.search}`);
    }, [location]);

    return null;
}
