import { Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import { DesktopUpdateIndicator } from '../../components/desktop-update-indicator.tsx';
import { AppShellTopbar, AppShellTopbarSidebarSlot } from '../../components/ui/app-shell.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SidebarTrigger } from '../../components/ui/sidebar.tsx';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { TopbarAllChatsMenuButton, TopbarChatTabs } from './topbar-chat-tabs.tsx';

interface AppTopbarProps {
    activeTab: RouteTab | null;
    isSettingsRoute: boolean;
    onNavigateToSettings: () => void;
    onSelectTab: (tab: RouteTab) => void;
}

export function AppTopbar({
    activeTab,
    isSettingsRoute,
    onNavigateToSettings,
    onSelectTab,
}: AppTopbarProps) {
    return (
        <AppShellTopbar>
            <div className="flex h-full min-w-0 flex-1 items-center gap-2 pr-3 pl-[var(--traffic-light-inset)]">
                <TopbarChatTabs activeRouteTab={activeTab} onSelectRouteTab={onSelectTab} />

                <div className="no-drag ml-auto flex shrink-0 items-center gap-1">
                    <TopbarAllChatsMenuButton />
                    <Button
                        aria-current={isSettingsRoute ? 'page' : undefined}
                        aria-label="Settings"
                        className="size-7 rounded-md"
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
            </div>
        </AppShellTopbar>
    );
}

export function AppSidebarTopbar({ isExpanded }: { isExpanded: boolean }) {
    const collapsedTopbarWidth = 'w-[calc(var(--traffic-light-inset)_+_2.75rem)]';
    const collapsedTopbarSlotWidth =
        'items-center pt-0 md:w-[calc(var(--traffic-light-inset)_+_2.75rem)]';

    return (
        <AppShellTopbar className={isExpanded ? 'w-[var(--sidebar-width)]' : collapsedTopbarWidth}>
            <AppShellTopbarSidebarSlot
                className={isExpanded ? 'items-center pt-0' : collapsedTopbarSlotWidth}
            >
                <div className="no-drag ml-auto flex items-center gap-1">
                    <SidebarTrigger
                        activateOnPointerDown
                        className="size-7 rounded-md"
                        size="icon-sm"
                    />
                </div>
            </AppShellTopbarSidebarSlot>
        </AppShellTopbar>
    );
}
