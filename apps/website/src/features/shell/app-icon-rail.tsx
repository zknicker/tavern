import { Home09Icon, Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import {
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import type { RouteTab } from '../../hooks/shell/use-route-tab.ts';
import { routeTabs, useRouteTab } from '../../hooks/shell/use-route-tab.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { RouteTabIcon } from './route-tab-presentation.tsx';

const railToolTabIds = ['tasks', 'automations', 'wiki'] satisfies RouteTab[];
const railToolTabs = routeTabs.filter((tab) =>
    (railToolTabIds as readonly string[]).includes(tab.id)
);

/**
 * The always-present section rail: Home (chats and activity), the tool
 * sections, and Settings as icons. The panel beside it belongs to the
 * active section — the Home panel lists activity, channels, and DMs; tool
 * pages bring their own panel; settings swaps in its nav.
 */
export function AppIconRail() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeTab, setActiveTab } = useRouteTab();
    const capability = useCapability();
    const isSettingsActive = location.pathname.startsWith(appRoutes.settings);
    const isToolActive = (railToolTabIds as readonly string[]).includes(activeTab ?? '');
    const isHomeActive = !(isSettingsActive || isToolActive);

    return (
        <nav
            aria-label="Sections"
            className="z-30 flex w-12 shrink-0 flex-col items-center gap-1 bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)] pb-2"
        >
            <RailButton
                isActive={isHomeActive}
                label="Home"
                onClick={() => navigate(appRoutes.overview)}
            >
                <Icon aria-hidden="true" className="size-4.5" icon={Home09Icon} size={20} />
            </RailButton>
            {railToolTabs.map((tab) => {
                const gate = capability(routeTabCapabilityRequirements[tab.id]);
                const disabledReason = gate.healthy ? null : formatCapabilityDisabledReason(gate);

                return (
                    <RailButton
                        disabled={!gate.healthy}
                        isActive={activeTab === tab.id}
                        key={tab.id}
                        label={disabledReason ?? tab.label}
                        onClick={() => {
                            if (gate.healthy) {
                                setActiveTab(tab.id);
                            }
                        }}
                    >
                        <RouteTabIcon className="size-4.5" tab={tab.id} />
                    </RailButton>
                );
            })}
            <div className="flex-1" />
            <RailButton
                isActive={isSettingsActive}
                label="Settings"
                onClick={() => navigate(appRoutes.settings)}
            >
                <Icon aria-hidden="true" className="size-4.5" icon={Setting07Icon} size={20} />
            </RailButton>
        </nav>
    );
}

// Matches the nav-row selection language: solid secondary plate, inset input
// ring, and the 2px press slab (DESIGN.md "inked outline + press-slab").
function RailButton({
    children,
    disabled,
    isActive,
    label,
    onClick,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    isActive: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            className={cn(
                'no-drag flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sidebar-foreground outline-none',
                isActive
                    ? 'bg-secondary shadow-[0_2px_0_0_var(--hard-shadow)] ring-1 ring-input ring-inset'
                    : 'hover:bg-[var(--nav-hover)]',
                disabled ? 'cursor-default opacity-50' : null
            )}
            disabled={disabled}
            onClick={onClick}
            title={label}
            type="button"
        >
            {children}
        </button>
    );
}
