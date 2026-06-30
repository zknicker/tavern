import { Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '../../components/ui/sidebar.tsx';
import type { RouteTab } from '../../hooks/shell/use-route-tab.ts';
import { SettingsSidebarNav } from '../settings/layout/sidebar-nav.tsx';
import { AppSidebarChatList } from './sidebar-chat-list.tsx';
import { AppSidebarNav } from './sidebar-nav.tsx';
import { SidebarUpdateMenuItem } from './sidebar-update-menu-item.tsx';

interface AppSidebarProps {
    activeTab: RouteTab | null;
    isSettingsRoute: boolean;
    onBackToApp: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onNavigateToSettings: () => void;
    onSelectTab: (tab: RouteTab) => void;
}

export function AppSidebar({
    activeTab,
    isSettingsRoute,
    onBackToApp,
    onMouseEnter,
    onMouseLeave,
    onNavigateToSettings,
    onSelectTab,
}: AppSidebarProps) {
    return (
        <Sidebar
            className="app-shell-sidebar z-30 border-sidebar-border bg-transparent pt-[calc(var(--topbar-height)-4px)] group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0"
            collapsible="offcanvas"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <SidebarContent className="overflow-hidden">
                {isSettingsRoute ? (
                    <SettingsSidebarNav onBackToApp={onBackToApp} />
                ) : (
                    <>
                        <AppSidebarNav activeTab={activeTab} onSelectTab={onSelectTab} />
                        <AppSidebarChatList />
                    </>
                )}
            </SidebarContent>
            {isSettingsRoute ? null : (
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarUpdateMenuItem />
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={onNavigateToSettings}>
                                <Icon
                                    aria-hidden="true"
                                    className="shrink-0"
                                    icon={Setting07Icon}
                                    size={18}
                                />
                                <span>Settings</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            )}
            <SidebarRail />
        </Sidebar>
    );
}
