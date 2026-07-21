import { Activity03Icon } from '@hugeicons-pro/core-stroke-rounded';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import { appRoutes } from '../../lib/app-routes.ts';

/**
 * Home-section nav at the top of the sidebar panel. The icon rail owns the
 * app sections; this panel covers the Home section itself: the Activity
 * page (overview) above the channel and DM lists.
 */
export function SidebarHomeNav() {
    const location = useLocation();

    return (
        <SidebarGroup className="shrink-0 pt-0">
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            isActive={location.pathname === appRoutes.overview}
                            render={<NavLink to={appRoutes.overview} />}
                        >
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={Activity03Icon}
                                size={18}
                            />
                            <span>Activity</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
