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
import { routeTabs } from '../../hooks/shell/use-route-tab.ts';
import { RouteTabIcon } from './route-tab-presentation.tsx';

interface AppSidebarNavProps {
    activeTab: RouteTab | null;
    onSelectTab: (tab: RouteTab) => void;
}

export function AppSidebarNav({ activeTab, onSelectTab }: AppSidebarNavProps) {
    const capability = useCapability();

    return (
        <SidebarGroup className="shrink-0 pt-2">
            <SidebarGroupContent>
                <SidebarMenu>
                    {routeTabs.map((tab) => {
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
