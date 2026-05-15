import { AgentAvatar } from '@tavern/agent-avatars';
import { NavLink } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../../components/ui/sidebar.tsx';
import type { AgentRailItem } from '../../../hooks/agents/use-agent-rail.ts';
import { buildAgentSettingsPath } from '../../agents/agent-path.ts';
import { backToAppIcon, settingsNavSections } from './navigation.ts';

interface SettingsSidebarNavProps {
    onBackToApp: () => void;
    sidebarAgents: AgentRailItem[];
}

export function SettingsSidebarNav({ onBackToApp, sidebarAgents }: SettingsSidebarNavProps) {
    const agent = sidebarAgents[0] ?? null;

    return (
        <>
            <SidebarGroup className="pt-2">
                <SidebarGroupContent>
                    <SidebarMenu className="gap-2">
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                className="text-sidebar-muted"
                                onClick={onBackToApp}
                                tooltip="Back to app"
                            >
                                <Icon
                                    aria-hidden="true"
                                    className="shrink-0"
                                    icon={backToAppIcon}
                                    size={18}
                                />
                                <span className="min-w-0 truncate">Back to app</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            {settingsNavSections.map((section) => (
                <SidebarGroup className="py-1" key={section.id}>
                    <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {section.items.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <NavLink className="contents" to={item.to}>
                                        {({ isActive }) => (
                                            <SidebarMenuButton
                                                isActive={isActive}
                                                render={<div />}
                                                tooltip={item.label}
                                            >
                                                <Icon
                                                    aria-hidden="true"
                                                    className="shrink-0"
                                                    icon={item.icon}
                                                    size={18}
                                                />
                                                <span className="min-w-0 truncate">
                                                    {item.label}
                                                </span>
                                            </SidebarMenuButton>
                                        )}
                                    </NavLink>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}

            <SidebarGroup className="min-h-0 flex-1 py-1">
                <SidebarGroupLabel>Agent</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {agent ? (
                            <SidebarMenuItem key={agent.id}>
                                <NavLink className="contents" to={buildAgentSettingsPath(agent.id)}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton
                                            isActive={isActive}
                                            render={<div />}
                                            tooltip={agent.name}
                                        >
                                            <AgentAvatar
                                                avatar={agent.avatar}
                                                backgroundColor={agent.primaryColor ?? '#64748b'}
                                                className="size-5"
                                                name={agent.name}
                                            />
                                            <span className="min-w-0 truncate">{agent.name}</span>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
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
        </>
    );
}
