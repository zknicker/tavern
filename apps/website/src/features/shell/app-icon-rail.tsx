import { Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import {
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
    useCapability,
} from '../../hooks/connections/use-capability.ts';
import { useActivityUnseen, useTasksUnseen } from '../../hooks/shell/use-rail-unseen.ts';
import { routeTabs, useRouteTab } from '../../hooks/shell/use-route-tab.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { RouteTabIcon } from './route-tab-presentation.tsx';

/**
 * The always-present section rail. Full-width tools collapse the chat
 * sidebar; chat and activity keep it visible; settings swaps in its nav.
 */
export function AppIconRail() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeTab, setActiveTab } = useRouteTab();
    const capability = useCapability();
    const activityUnseen = useActivityUnseen();
    const tasksUnseen = useTasksUnseen();
    const isSettingsActive = location.pathname.startsWith(appRoutes.settings);

    return (
        <nav
            aria-label="Sections"
            className="z-30 flex w-12 shrink-0 flex-col items-center gap-1 bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)] pb-2"
        >
            {routeTabs.map((tab) => {
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
                        unseen={
                            (tab.id === 'activity' && activityUnseen) ||
                            (tab.id === 'tasks' && tasksUnseen)
                        }
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
    unseen,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    isActive: boolean;
    label: string;
    onClick: () => void;
    unseen?: boolean;
}) {
    return (
        <button
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            className={cn(
                'no-drag relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sidebar-foreground outline-none',
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
            {unseen && !isActive ? (
                <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                />
            ) : null}
        </button>
    );
}
