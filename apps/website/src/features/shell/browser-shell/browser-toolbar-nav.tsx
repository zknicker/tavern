import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';
import {
    formatCapabilityDisabledReason,
    routeTabCapabilityRequirements,
    useCapability,
} from '../../../hooks/connections/use-capability.ts';
import { useHistoryNav } from '../../../hooks/shell/use-history-nav.ts';
import type { RouteTab } from '../../../hooks/shell/use-route-tab.ts';
import { routeTabs } from '../../../hooks/shell/use-route-tab.ts';
import { cn } from '../../../lib/utils.ts';
import type { ChatListItem } from '../../chats/chat-list-data.ts';
import { ChatParticipantFacepile } from '../../chats/chat-participant-facepile.tsx';
import { ChatParticipantsEditButton } from '../../chats/chat-participants-edit-button.tsx';
import { RouteTabIcon } from '../route-tab-presentation.tsx';
import { ToolbarBreadcrumb } from './toolbar-breadcrumb.tsx';
import { ToolbarDevMenu } from './toolbar-dev-menu.tsx';
import { useActiveChat } from './use-active-chat.ts';

/**
 * The borderless toolbar row at the top of the content card — history controls,
 * then the section nav as icon buttons (Aside-style), plus the active section
 * label. Buttons keep the bar's soft-rectangle radius; no circular hovers.
 * `data-toolbar` marks the strip/card boundary the shell hairline is measured
 * against.
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
    return (
        <div
            className="no-drag relative z-0 flex h-[38px] shrink-0 items-center gap-0.5 border-border/60 border-b px-2"
            data-toolbar
        >
            <HistoryNavButtons />
            <ToolbarDivider />
            {routeTabs.map((tab) => (
                <BrowserNavButton
                    active={!isSettingsRoute && tab.id === activeRouteTab}
                    key={tab.id}
                    onSelect={onSelectRouteTab}
                    tab={tab.id}
                />
            ))}
            <ToolbarDivider />
            <ToolbarBreadcrumb />
            <div className="flex-1" />
            <ToolbarRightActions />
        </div>
    );
}

// Right-aligned participants slot: the active chat's facepile lives in the
// shell toolbar now that chat views render no topbar of their own.
function ToolbarRightActions() {
    const { chat } = useActiveChat();
    const devToolkit = useCapability('devToolkit');

    if (!chat) {
        return null;
    }

    return (
        <div className="flex items-center gap-0.5">
            {devToolkit.healthy ? (
                <>
                    <ToolbarDevMenu chatId={chat.id} />
                    <ToolbarDivider />
                </>
            ) : null}
            <ToolbarParticipants chat={chat} />
        </div>
    );
}

function ToolbarParticipants({ chat }: { chat: ChatListItem }) {
    return (
        <div className="flex items-center gap-1">
            <ChatParticipantFacepile chat={chat} />
            <ChatParticipantsEditButton chat={chat} />
        </div>
    );
}

function HistoryNavButtons() {
    const nav = useHistoryNav();

    return (
        <>
            <Button
                aria-label="Back"
                className="text-muted-foreground hover:text-foreground"
                disabled={!nav.canGoBack}
                onClick={nav.back}
                size="icon-sm"
                title="Back"
                variant="ghost"
            >
                <Icon className="size-[18px]" icon={ArrowLeft01Icon} strokeWidth={1.8} />
            </Button>
            <Button
                aria-label="Forward"
                className="text-muted-foreground hover:text-foreground"
                disabled={!nav.canGoForward}
                onClick={nav.forward}
                size="icon-sm"
                title="Forward"
                variant="ghost"
            >
                <Icon className="size-[18px]" icon={ArrowRight01Icon} strokeWidth={1.8} />
            </Button>
        </>
    );
}

function ToolbarDivider() {
    return <div aria-hidden="true" className="mx-1.5 h-4 w-px bg-border/60" />;
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
            className={cn(
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
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
