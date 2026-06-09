import {
    ArrowDown01Icon,
    ArrowRight01Icon,
    File01Icon,
    Folder01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { SidebarMenu, SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import { cn } from '../../lib/utils.ts';
import type { CortexPageNode } from './types.ts';
import { buildCortexPageTree, type CortexPageTreeNode, getCortexDirectoryIds } from './utils.ts';

export function CortexPageSidebar({
    onSelect,
    pages,
    selectedPageKey,
}: {
    onSelect: (page: CortexPageNode) => void;
    pages: CortexPageNode[];
    selectedPageKey: string | null;
}) {
    const tree = React.useMemo(
        () => buildCortexPageTree(pages, { includeTopicRoot: true }),
        [pages]
    );
    const directoryIds = React.useMemo(() => getCortexDirectoryIds(tree), [tree]);
    const [collapsedDirectoryIds, setCollapsedDirectoryIds] = React.useState<Set<string>>(
        () => new Set()
    );

    React.useEffect(() => {
        setCollapsedDirectoryIds((current) => {
            const next = new Set([...current].filter((id) => directoryIds.includes(id)));
            return next.size === current.size ? current : next;
        });
    }, [directoryIds]);

    function toggleDirectory(id: string) {
        setCollapsedDirectoryIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    return (
        <aside className="flex min-h-0 w-[300px] shrink-0 flex-col border-border/60 border-r bg-transparent">
            {pages.length === 0 ? (
                <div className="px-5 py-2 text-muted-foreground text-sm">No wiki pages found.</div>
            ) : (
                <div className="min-h-0 flex-1 overflow-auto px-3 pt-4 pb-4">
                    <SidebarMenu>
                        <CortexTreeNodes
                            collapsedDirectoryIds={collapsedDirectoryIds}
                            nodes={tree}
                            onSelect={onSelect}
                            onToggleDirectory={toggleDirectory}
                            selectedPageKey={selectedPageKey}
                        />
                    </SidebarMenu>
                </div>
            )}
        </aside>
    );
}

function CortexTreeNodes({
    collapsedDirectoryIds,
    depth = 0,
    nodes,
    onSelect,
    onToggleDirectory,
    selectedPageKey,
}: {
    collapsedDirectoryIds: Set<string>;
    depth?: number;
    nodes: CortexPageTreeNode[];
    onSelect: (page: CortexPageNode) => void;
    onToggleDirectory: (id: string) => void;
    selectedPageKey: string | null;
}) {
    return nodes.map((node) => {
        if (node.kind === 'directory') {
            const collapsed = collapsedDirectoryIds.has(node.id);
            return (
                <React.Fragment key={node.id}>
                    <SidebarMenuItem>
                        <button
                            aria-expanded={!collapsed}
                            className="flex h-7 w-full cursor-default items-center gap-1.5 rounded-md px-2 text-left font-medium text-sidebar-foreground text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                            onClick={() => onToggleDirectory(node.id)}
                            style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
                            type="button"
                        >
                            <Icon
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-muted-foreground"
                                icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
                            />
                            <Icon
                                aria-hidden="true"
                                className="size-4 shrink-0"
                                icon={Folder01Icon}
                            />
                            <span className="min-w-0 flex-1 truncate">{node.name}</span>
                        </button>
                    </SidebarMenuItem>
                    {collapsed ? null : (
                        <CortexTreeNodes
                            collapsedDirectoryIds={collapsedDirectoryIds}
                            depth={depth + 1}
                            nodes={node.children}
                            onSelect={onSelect}
                            onToggleDirectory={onToggleDirectory}
                            selectedPageKey={selectedPageKey}
                        />
                    )}
                </React.Fragment>
            );
        }

        return (
            <SidebarMenuItem key={node.id}>
                <button
                    className={cn(
                        'flex h-7 w-full cursor-default items-center gap-2 overflow-hidden rounded-md px-2 text-left font-medium text-sidebar-foreground text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent active:text-sidebar-accent-foreground',
                        node.id === selectedPageKey &&
                            'bg-[var(--sidebar-accent-active)] text-sidebar-accent-foreground'
                    )}
                    onClick={() => onSelect(node.page)}
                    style={{ paddingLeft: `${1.375 + depth * 0.875}rem` }}
                    type="button"
                >
                    <Icon aria-hidden="true" className="size-4 shrink-0" icon={File01Icon} />
                    <span className="min-w-0 flex-1 truncate">{node.name}</span>
                </button>
            </SidebarMenuItem>
        );
    });
}
