import { SidebarProvider } from '../../../components/ui/sidebar.tsx';
import { AppSidebarChatList } from '../sidebar-chat-list.tsx';

/**
 * The static channels + direct-messages rail for the browser (tabs) shell. Renders the same
 * chat list as the sidebar layout, pinned to the left of the content so it stays put across
 * the home page and every chat. In a desktop content-view window the page view insets to the
 * right of this rail automatically — the content placeholder measures its own box.
 *
 * `open` keeps the COSS sidebar context expanded (the rail is never collapsed here) so the
 * menu items render full labels instead of collapsed-state tooltips.
 */
export function BrowserShellSidebar() {
    return (
        <SidebarProvider
            className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-sidebar-border border-r bg-[var(--sidebar)]"
            open
        >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-1">
                <AppSidebarChatList />
            </div>
        </SidebarProvider>
    );
}
