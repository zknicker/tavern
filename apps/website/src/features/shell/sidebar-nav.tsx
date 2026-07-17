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
import type { RouteTab } from '../../hooks/shell/use-route-tab.ts';
import { routeTabs, useRouteTab } from '../../hooks/shell/use-route-tab.ts';
import { RouteTabIcon } from './route-tab-presentation.tsx';

// The sidebar surfaces only the tool sections. Overview is the new-tab/home
// page (reached by tabs and breadcrumbs, not a nav row) and Workspace is
// intentionally unlisted — its files are reachable from the chat artifact
// pane.
const sidebarNavTabIds = ['tasks', 'automations', 'wiki'] satisfies RouteTab[];
const sidebarNavTabs = routeTabs.filter((tab) =>
    (sidebarNavTabIds as readonly string[]).includes(tab.id)
);

export function AppSidebarNav() {
    const { activeTab, setActiveTab } = useRouteTab();
    const capability = useCapability();

    return (
        <SidebarGroup className="shrink-0 pt-2">
            <SidebarGroupContent>
                <SidebarMenu>
                    {sidebarNavTabs.map((tab) => {
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
                                            setActiveTab(tab.id);
                                        }
                                    }}
                                    tooltip={disabledReason ?? undefined}
                                >
                                    <RouteTabIcon className="size-4.5" tab={tab.id} />
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
