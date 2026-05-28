import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import type { CortexPageNode } from './types.ts';

export function CortexPageSidebar({
    onSelect,
    pages,
    selectedSlug,
}: {
    onSelect: (slug: string) => void;
    pages: CortexPageNode[];
    selectedSlug: string | null;
}) {
    return (
        <aside className="flex min-h-0 flex-col bg-transparent text-sidebar-foreground">
            <div className="min-h-0 flex-1 overflow-auto px-3 pt-2 pb-4">
                {pages.length === 0 ? (
                    <div className="px-4 py-3 text-muted-foreground text-sm">
                        No Cortex pages found.
                    </div>
                ) : (
                    <SidebarMenu>
                        {pages.map((page) => (
                            <SidebarMenuItem key={page.id}>
                                <SidebarMenuButton
                                    isActive={page.slug === selectedSlug}
                                    onClick={() => onSelect(page.slug)}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="shrink-0"
                                        icon={File01Icon}
                                        size={18}
                                    />
                                    <span className="min-w-0 truncate">{page.title}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
            </div>
        </aside>
    );
}
