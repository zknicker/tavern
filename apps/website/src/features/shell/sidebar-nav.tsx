import type { IconSvgElement } from '@hugeicons/react';
import {
    Activity01Icon,
    Atom02Icon,
    Home09Icon,
    HourglassIcon,
    ZapIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { routeTabs } from '../../hooks/dashboard/use-route-tab.ts';

const tabIcons = {
    overview: Home09Icon,
    stats: Activity01Icon,
    cron: HourglassIcon,
    memory: Atom02Icon,
    skills: ZapIcon,
} satisfies Record<RouteTab, IconSvgElement>;

interface AppSidebarNavProps {
    activeTab: RouteTab | null;
    onSelectTab: (tab: RouteTab) => void;
}

export function AppSidebarNav({ activeTab, onSelectTab }: AppSidebarNavProps) {
    return (
        <SidebarGroup className="pt-2">
            <SidebarGroupContent>
                <SidebarMenu>
                    {routeTabs.map((tab) => {
                        const icon = tabIcons[tab.id];
                        const isActive = activeTab === tab.id;

                        return (
                            <SidebarMenuItem key={tab.id}>
                                <SidebarMenuButton
                                    isActive={isActive}
                                    onClick={() => onSelectTab(tab.id)}
                                    tooltip={tab.label}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="shrink-0"
                                        icon={icon}
                                        size={18}
                                    />
                                    <span className="min-w-0 truncate">{tab.label}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
