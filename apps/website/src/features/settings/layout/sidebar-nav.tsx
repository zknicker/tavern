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
import { backToAppIcon, settingsNavSections } from './navigation.ts';

interface SettingsSidebarNavProps {
    onBackToApp: () => void;
}

export function SettingsSidebarNav({ onBackToApp }: SettingsSidebarNavProps) {
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
        </>
    );
}
