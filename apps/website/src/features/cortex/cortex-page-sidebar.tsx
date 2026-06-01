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
        <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-border/60 border-r bg-transparent">
            <div className="px-5 pt-4 pb-3 font-medium text-[var(--nav-section-label)] text-caption">
                Pages
            </div>
            {pages.length === 0 ? (
                <div className="px-5 py-2 text-muted-foreground text-sm">
                    No Cortex pages found.
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
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
                </div>
            )}
        </aside>
    );
}
