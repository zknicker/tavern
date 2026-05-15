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
import type { AgentRailItem } from '../../hooks/agents/use-agent-rail.ts';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { SettingsSidebarNav } from '../settings/layout/sidebar-nav.tsx';
import { AppSidebarAgentList } from './sidebar-agent-list.tsx';
import { AppSidebarChatList } from './sidebar-chat-list.tsx';
import { AppSidebarNav } from './sidebar-nav.tsx';

interface AppSidebarProps {
    activeTab: RouteTab | null;
    isSettingsRoute: boolean;
    onBackToApp: () => void;
    onNavigateToSettings: () => void;
    onSelectTab: (tab: RouteTab) => void;
    sidebarAgents: AgentRailItem[];
}

export function AppSidebar({
    activeTab,
    isSettingsRoute,
    onBackToApp,
    onNavigateToSettings,
    onSelectTab,
    sidebarAgents,
}: AppSidebarProps) {
    return (
        <Sidebar
            className="app-shell-sidebar border-sidebar-border bg-transparent pt-[calc(var(--topbar-height)-8px)] group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0"
            collapsible="icon"
        >
            <SidebarContent>
                {isSettingsRoute ? (
                    <SettingsSidebarNav onBackToApp={onBackToApp} sidebarAgents={sidebarAgents} />
                ) : (
                    <>
                        <AppSidebarNav activeTab={activeTab} onSelectTab={onSelectTab} />
                        <AppSidebarChatList />
                        <AppSidebarAgentList sidebarAgents={sidebarAgents} />
                    </>
                )}
            </SidebarContent>
            {isSettingsRoute ? null : (
                <SidebarFooter className="pb-4">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={onNavigateToSettings} tooltip="Settings">
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
