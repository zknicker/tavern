import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import type { CortexPageNode, CortexTopicNode } from './types.ts';
import { pageKey } from './utils.ts';

export function CortexPageSidebar({
    onSelect,
    onTopicChange,
    pages,
    selectedPageKey,
    selectedTopic,
    topics,
}: {
    onSelect: (page: CortexPageNode) => void;
    onTopicChange: (topic: string | null) => void;
    pages: CortexPageNode[];
    selectedPageKey: string | null;
    selectedTopic: string | null;
    topics: CortexTopicNode[];
}) {
    return (
        <aside className="flex min-h-0 w-[300px] shrink-0 flex-col border-border/60 border-r bg-transparent">
            <div className="space-y-3 px-5 pt-4 pb-3">
                <div className="font-medium text-[var(--nav-section-label)] text-caption">
                    Topics
                </div>
                <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                    onChange={(event) => onTopicChange(event.target.value || null)}
                    value={selectedTopic ?? ''}
                >
                    <option value="">All topics</option>
                    {topics.map((topic) => (
                        <option key={topic.slug} value={topic.slug}>
                            {topic.title}
                            {topic.archived ? ' (archived)' : ''}
                        </option>
                    ))}
                </select>
            </div>
            <div className="px-5 pt-2 pb-3 font-medium text-[var(--nav-section-label)] text-caption">
                Pages
            </div>
            {pages.length === 0 ? (
                <div className="px-5 py-2 text-muted-foreground text-sm">No wiki pages found.</div>
            ) : (
                <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
                    <SidebarMenu>
                        {pages.map((page) => (
                            <SidebarMenuItem key={pageKey(page)}>
                                <SidebarMenuButton
                                    isActive={pageKey(page) === selectedPageKey}
                                    onClick={() => onSelect(page)}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="shrink-0"
                                        icon={File01Icon}
                                        size={18}
                                    />
                                    <span className="min-w-0 flex-1 truncate">{page.title}</span>
                                    <span className="shrink-0 text-muted-foreground text-xs">
                                        {page.section}
                                    </span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </div>
            )}
        </aside>
    );
}
