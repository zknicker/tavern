import { Button } from '../../../components/ui/primitives/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';
import {
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
    useCapability,
} from '../../../hooks/connections/use-capability.ts';
import type { RouteTab } from '../../../hooks/shell/use-route-tab.ts';
import { routeTabs } from '../../../hooks/shell/use-route-tab.ts';
import { RouteTabIcon } from '../route-tab-presentation.tsx';

/**
 * The borderless toolbar row at the top of the content card — the section nav as icon
 * buttons (Aside-style), plus the active section label. `data-toolbar` marks the
 * strip/card boundary the shell hairline is measured against.
 */
export function BrowserToolbarNav({
    activeRouteTab,
    isSettingsRoute,
    onSelectRouteTab,
}: {
    activeRouteTab: RouteTab | null;
    isSettingsRoute: boolean;
    onSelectRouteTab: (tab: RouteTab) => void;
}) {
    const activeLabel = isSettingsRoute
        ? 'Settings'
        : (routeTabs.find((tab) => tab.id === activeRouteTab)?.label ?? null);

    return (
        <div
            className="no-drag relative z-0 flex h-[38px] shrink-0 items-center gap-1 border-border/60 border-b px-2"
            data-toolbar
        >
            {routeTabs.map((tab) => (
                <BrowserNavButton
                    active={!isSettingsRoute && tab.id === activeRouteTab}
                    key={tab.id}
                    onSelect={onSelectRouteTab}
                    tab={tab.id}
                />
            ))}
            <div aria-hidden="true" className="mx-2 h-5 w-px bg-border/60" />
            {activeLabel ? (
                <span className="truncate text-[13px] text-muted-foreground">{activeLabel}</span>
            ) : null}
        </div>
    );
}

function BrowserNavButton({
    active,
    onSelect,
    tab,
}: {
    active: boolean;
    onSelect: (tab: RouteTab) => void;
    tab: RouteTab;
}) {
    const capability = useCapability();
    const gate = capability(routeTabCapabilityRequirements[tab]);
    const disabledReason = gate.healthy ? null : formatCapabilityDisabledReason(gate);
    const label = routeTabs.find((entry) => entry.id === tab)?.label ?? tab;

    const button = (
        <Button
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className="size-8 rounded-full"
            disabled={!gate.healthy}
            onClick={() => onSelect(tab)}
            size="icon-sm"
            title={disabledReason ?? label}
            variant={active ? 'secondary' : 'ghost'}
        >
            <RouteTabIcon className="size-[18px]" tab={tab} />
        </Button>
    );

    if (!disabledReason) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
            <TooltipContent side="bottom">{disabledReason}</TooltipContent>
        </Tooltip>
    );
}
