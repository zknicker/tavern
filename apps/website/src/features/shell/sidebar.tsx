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
import { SettingsSidebarNav } from '../settings/layout/sidebar-nav.tsx';
import { SidebarAuthItems } from './sidebar-auth-items.tsx';
import { AppSidebarChatList } from './sidebar-chat-list.tsx';
import { AppSidebarNav } from './sidebar-nav.tsx';
import { SidebarUpdateMenuItem } from './sidebar-update-menu-item.tsx';

interface AppSidebarProps {
    isSettingsRoute: boolean;
    onBackToApp: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onNavigateToSettings: () => void;
}

export function AppSidebar({
    isSettingsRoute,
    onBackToApp,
    onMouseEnter,
    onMouseLeave,
    onNavigateToSettings,
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
                        <AppSidebarNav />
                        <AppSidebarChatList />
                    </>
                )}
            </SidebarContent>
            {isSettingsRoute ? null : (
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarUpdateMenuItem />
                        <SidebarAuthItems />
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
