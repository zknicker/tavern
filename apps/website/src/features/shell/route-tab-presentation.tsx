import type { IconSvgElement } from '@hugeicons/react';
import { Database02Icon, Folder01Icon, Joystick04Icon } from '@hugeicons-pro/core-stroke-rounded';
import { TavernLogo } from '../../components/tavern-logo.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { RouteTab } from '../../hooks/dashboard/use-route-tab.ts';
import { cn } from '../../lib/utils.ts';

const routeTabIconNodeClassName =
    'size-5 shrink-0 opacity-70 transition-opacity duration-150 group-data-active:opacity-90';

export function RouteTabIcon({ className, tab }: { className?: string; tab: RouteTab }) {
    const icon = getRouteTabIcon(tab);

    if (icon) {
        return (
            <Icon aria-hidden="true" className={cn('shrink-0', className)} icon={icon} size={18} />
        );
    }

    return getRouteTabIconNode(tab, cn('shrink-0', className));
}

export function getRouteTabIcon(tab: RouteTab): IconSvgElement | undefined {
    switch (tab) {
        case 'workspace':
            return Folder01Icon;
        case 'memory':
            return Database02Icon;
        case 'cron':
        case 'overview':
            return undefined;
    }
}

export function getRouteTabIconNode(tab: RouteTab, className = routeTabIconNodeClassName) {
    switch (tab) {
        case 'cron':
            return (
                <Icon aria-hidden="true" className={className} icon={Joystick04Icon} size={20} />
            );
        case 'overview':
            return <TavernLogo aria-hidden="true" className={className} />;
        case 'workspace':
        case 'memory':
            return undefined;
    }
}
