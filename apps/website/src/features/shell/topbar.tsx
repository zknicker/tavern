import type { MouseEventHandler } from 'react';
import { AppShellTopbar, AppShellTopbarSidebarSlot } from '../../components/ui/app-shell.tsx';
import { SidebarTrigger } from '../../components/ui/sidebar.tsx';
export function AppSidebarTopbar({
    isExpanded,
    isPreview = false,
    onMouseEnter,
    onMouseLeave,
}: {
    isExpanded: boolean;
    isPreview?: boolean;
    onMouseEnter?: MouseEventHandler<HTMLElement>;
    onMouseLeave?: MouseEventHandler<HTMLElement>;
}) {
    if (!isExpanded) {
        return null;
    }

    const triggerOffset = isPreview ? 'translate-y-[4px]' : 'translate-x-[6px] translate-y-[4px]';

    return (
        <AppShellTopbar
            className="w-[var(--sidebar-width)]"
            nativeDragRegion={!isPreview}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <AppShellTopbarSidebarSlot className="items-center pt-0">
                <div className={`no-drag ml-auto flex items-center gap-1 ${triggerOffset}`}>
                    <SidebarTrigger activateOnPointerDown size="icon-sm" />
                </div>
            </AppShellTopbarSidebarSlot>
        </AppShellTopbar>
    );
}
