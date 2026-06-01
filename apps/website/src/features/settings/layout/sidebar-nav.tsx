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
import { settingsNavItems, settingsNavSections } from './navigation.ts';

const settingsNavItemsById = new Map(settingsNavItems.map((item) => [item.id, item]));

export function SettingsSidebarNav() {
    return (
        <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-border/60 border-r bg-transparent">
            {settingsNavSections.map((section) => (
                <SidebarGroup key={section.id}>
                    <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {section.itemIds.map((itemId) => {
                                const item = settingsNavItemsById.get(itemId);

                                if (!item) {
                                    return null;
                                }

                                return (
                                    <SidebarMenuItem key={item.id}>
                                        <NavLink className="contents" to={item.to}>
                                            {({ isActive }) => (
                                                <SidebarMenuButton
                                                    isActive={isActive}
                                                    render={<div />}
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
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}
        </aside>
    );
}
