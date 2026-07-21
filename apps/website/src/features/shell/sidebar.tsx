import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
} from '../../components/ui/sidebar.tsx';
import { SettingsSidebarNav } from '../settings/layout/sidebar-nav.tsx';
import { SidebarAgentActivityStrip } from './sidebar-agent-activity-strip.tsx';
import { SidebarAuthItems } from './sidebar-auth-items.tsx';
import { AppSidebarChatList } from './sidebar-chat-list.tsx';
import { SidebarHomeNav } from './sidebar-home-nav.tsx';
import { SidebarUpdateMenuItem } from './sidebar-update-menu-item.tsx';

interface AppSidebarProps {
    isSettingsRoute: boolean;
    onBackToApp: () => void;
}

/**
 * The Home-section panel beside the icon rail: Activity, channels, and DMs.
 * Section navigation and Settings live on the rail; on settings routes the
 * panel swaps to the settings nav. Always visible — no collapse.
 */
export function AppSidebar({ isSettingsRoute, onBackToApp }: AppSidebarProps) {
    return (
        <Sidebar
            className="app-shell-sidebar z-30 shrink-0 bg-transparent pt-[calc(var(--topbar-height)-4px)]"
            collapsible="none"
        >
            <SidebarContent className="overflow-hidden">
                {isSettingsRoute ? (
                    <SettingsSidebarNav onBackToApp={onBackToApp} />
                ) : (
                    <>
                        <SidebarHomeNav />
                        <AppSidebarChatList />
                    </>
                )}
            </SidebarContent>
            {isSettingsRoute ? null : (
                <SidebarFooter>
                    <SidebarAgentActivityStrip />
                    <SidebarMenu>
                        <SidebarUpdateMenuItem />
                        <SidebarAuthItems />
                    </SidebarMenu>
                </SidebarFooter>
            )}
        </Sidebar>
    );
}
