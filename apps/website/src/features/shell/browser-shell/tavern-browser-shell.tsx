import { PlusSignIcon, Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DesktopUpdateIndicator } from '../../../components/desktop-update-indicator.tsx';
import { AppShell, AppShellDragRegion } from '../../../components/ui/app-shell.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import type { RouteTab } from '../../../hooks/shell/use-route-tab.ts';
import { BrowserAllChatsMenu } from './browser-all-chats-menu.tsx';
import { BrowserShellSidebar } from './browser-shell-sidebar.tsx';
import { BrowserToolbarNav } from './browser-toolbar-nav.tsx';
import { useShell } from './shell-context.tsx';
import { shouldShowBrowserShellSidebar } from './sidebar-visibility.ts';
import { TabOutline } from './tab-outline.tsx';
import { TabList, TabStrip } from './tab-strip.tsx';
import { TavernBrowserTabsProvider } from './tavern-browser-tabs-provider.tsx';

interface TavernBrowserShellProps {
    activeRouteTab: RouteTab | null;
    children: ReactNode;
    isSettingsRoute: boolean;
    onNavigateToSettings: () => void;
    onSelectRouteTab: (tab: RouteTab) => void;
}

/**
 * The Chrome/Aside-style browser shell for the topbar (tabs) layout. Open chats are the
 * connected tabs above; the dashboard section nav lives in the toolbar row atop the
 * content card. Backed by the Tavern tab provider so the same shape renders real chats.
 */
export function TavernBrowserShell(props: TavernBrowserShellProps) {
    return (
        <TavernBrowserTabsProvider>
            <TavernBrowserShellFrame {...props} />
        </TavernBrowserTabsProvider>
    );
}

export function TavernBrowserShellFrame({
    activeRouteTab,
    children,
    isSettingsRoute,
    onNavigateToSettings,
    onSelectRouteTab,
}: TavernBrowserShellProps) {
    const { meta } = useShell();
    const location = useLocation();
    // The channels/DMs rail belongs to the chat surface — the home hub and any chat. Utility
    // pages (settings, workspace, memory…) keep their own full-width layouts, so the rail does
    // not fight their navigation.
    const showChannelRail = shouldShowBrowserShellSidebar(location.pathname);

    return (
        <AppShell className="w-full bg-[var(--browser-strip-overlay)]" ref={meta.frameRef}>
            <AppShellDragRegion />
            <TabStrip className="z-0 min-h-[37px] shrink-0 pr-2 pl-[var(--traffic-light-inset)]">
                <TabList />
                <BrowserNewTabButton />
                <div className="flex-1" />
                <div className="no-drag flex shrink-0 items-center gap-1 self-center pr-1">
                    <BrowserAllChatsMenu />
                    <Button
                        aria-current={isSettingsRoute ? 'page' : undefined}
                        aria-label="Settings"
                        onClick={onNavigateToSettings}
                        size="icon-sm"
                        title="Settings"
                        variant={isSettingsRoute ? 'secondary' : 'ghost'}
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-5"
                            icon={Setting07Icon}
                            size={20}
                        />
                    </Button>
                    <DesktopUpdateIndicator />
                </div>
            </TabStrip>
            <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[16px] bg-[var(--browser-card)]">
                <BrowserToolbarNav
                    activeRouteTab={activeRouteTab}
                    isSettingsRoute={isSettingsRoute}
                    onSelectRouteTab={onSelectRouteTab}
                />
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {showChannelRail ? <BrowserShellSidebar /> : null}
                    <div
                        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                        data-slot="app-shell-main"
                    >
                        {children}
                    </div>
                </div>
            </div>
            <TabOutline />
        </AppShell>
    );
}

function BrowserNewTabButton() {
    const { actions } = useShell();

    return (
        <Button
            aria-label="New tab"
            className="no-drag ml-1 size-6 shrink-0 self-center rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => actions.add()}
            size="icon-sm"
            title="New tab"
            variant="ghost"
        >
            <Icon aria-hidden="true" className="size-4" icon={PlusSignIcon} size={16} />
        </Button>
    );
}
