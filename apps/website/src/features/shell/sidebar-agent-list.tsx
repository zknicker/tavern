import { NavLink, useLocation } from 'react-router-dom';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { AgentRailItem } from '../../hooks/agents/use-agent-rail.ts';
import { buildAgentPath, getActiveAgentPage } from '../agents/agent-path.ts';

const supportsLiveSidebarAgentActivity = false;

export function resolveSidebarAgentAvatarActive(agent: AgentRailItem) {
    return supportsLiveSidebarAgentActivity ? agent.isThinking : false;
}

export function AppSidebarAgentList({ sidebarAgents }: { sidebarAgents: AgentRailItem[] }) {
    const location = useLocation();
    const activeAgentPage = getActiveAgentPage(location.pathname);
    const agent = sidebarAgents[0] ?? null;
    const agentPath = agent ? buildAgentPath(agent.id) : '/dashboard/agent';
    const isActiveAgent = activeAgentPage !== null;
    const isAvatarActive = agent ? isActiveAgent || resolveSidebarAgentAvatarActive(agent) : false;

    return (
        <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Agent</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {agent ? (
                        <SidebarMenuItem key={agent.id}>
                            <SidebarMenuButton
                                isActive={isActiveAgent}
                                render={<NavLink to={agentPath} />}
                                tooltip={agent.name}
                            >
                                <AgentAvatar
                                    active={isAvatarActive}
                                    avatar={agent.name}
                                    backgroundColor={agent.primaryColor ?? '#64748b'}
                                    className="size-5"
                                    name={agent.name}
                                />
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
