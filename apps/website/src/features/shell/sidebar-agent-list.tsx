import { NavLink, useLocation } from 'react-router-dom';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { AgentRailItem } from '../../hooks/agents/use-agent-rail.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { buildAgentPath, getActiveAgentPage } from '../agents/agent-path.ts';

const supportsLiveSidebarAgentActivity = false;

export function resolveSidebarAgentActive(agent: AgentRailItem) {
    return supportsLiveSidebarAgentActivity ? agent.isThinking : false;
}

export function AppSidebarAgentList({ sidebarAgents }: { sidebarAgents: AgentRailItem[] }) {
    const location = useLocation();
    const activeAgentPage = getActiveAgentPage(location.pathname);
    const agent = sidebarAgents[0] ?? null;
    const agentPath = agent ? buildAgentPath(agent.id) : appRoutes.settingsSessions;
    const isActiveAgent = activeAgentPage !== null;
    const hasLiveActivity = agent ? resolveSidebarAgentActive(agent) : false;

    return (
        <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Agent</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {agent ? (
                        <SidebarMenuItem key={agent.id}>
                            <SidebarMenuButton
                                isActive={isActiveAgent || hasLiveActivity}
                                render={<NavLink to={agentPath} />}
                                tooltip={agent.name}
                            >
                                <span className="min-w-0 truncate">{agent.name}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ) : null}

                    {agent ? null : (
                        <SidebarMenuItem>
                            <div className="px-2 py-3 text-sidebar-muted text-xs">
                                No agent synced
                            </div>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
