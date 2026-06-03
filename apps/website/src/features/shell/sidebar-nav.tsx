import type { IconSvgElement } from '@hugeicons/react';
import { Atom02Icon, Home09Icon, HourglassIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import {
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { routeTabs } from '../../hooks/dashboard/use-route-tab.ts';

const tabIcons = {
    overview: Home09Icon,
    cron: HourglassIcon,
    cortex: Atom02Icon,
} satisfies Record<RouteTab, IconSvgElement>;

interface AppSidebarNavProps {
    activeTab: RouteTab | null;
    onSelectTab: (tab: RouteTab) => void;
}

export function AppSidebarNav({ activeTab, onSelectTab }: AppSidebarNavProps) {
    const capability = useCapability();

    return (
        <SidebarGroup className="pt-2">
            <SidebarGroupContent>
                <SidebarMenu>
                    {routeTabs.map((tab) => {
                        const icon = tabIcons[tab.id];
                        const isActive = activeTab === tab.id;
                        const gate = capability(routeTabCapabilityRequirements[tab.id]);
                        const disabledReason = gate.healthy
                            ? null
                            : formatCapabilityDisabledReason(gate);

                        return (
                            <SidebarMenuItem key={tab.id}>
                                <SidebarMenuButton
                                    className={gate.healthy ? undefined : 'w-fit max-w-full'}
                                    disabled={!gate.healthy}
                                    isActive={isActive}
                                    onClick={() => {
                                        if (gate.healthy) {
                                            onSelectTab(tab.id);
                                        }
                                    }}
                                    tooltip={disabledReason ?? tab.label}
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
