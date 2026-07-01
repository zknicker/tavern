import { AppShellTopbar, AppShellTopbarSidebarSlot } from '../../components/ui/app-shell.tsx';
import { SidebarTrigger } from '../../components/ui/sidebar.tsx';

export function AppSidebarTopbar({ isExpanded }: { isExpanded: boolean }) {
    if (!isExpanded) {
        return null;
    }

    return (
        <AppShellTopbar className="w-[var(--sidebar-width)]" nativeDragRegion={false}>
            <AppShellTopbarSidebarSlot className="items-center pt-0">
                <div
                    className="no-drag ml-auto flex translate-x-[6px] items-center gap-1"
                    data-window-drag-disabled=""
                >
                    <SidebarTrigger activateOnPointerDown size="icon-sm" />
                </div>
            </AppShellTopbarSidebarSlot>
        </AppShellTopbar>
    );
}
