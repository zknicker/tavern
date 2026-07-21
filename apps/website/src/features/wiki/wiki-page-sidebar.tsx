import { FileAddIcon, FolderAddIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
} from '../../components/ui/sidebar.tsx';
import type { WikiPageNode } from './types.ts';
import type { WikiDeleteTarget } from './wiki-dialogs.tsx';
import { WikiPageFileTree } from './wiki-page-sidebar-file-tree.tsx';

export interface WikiMoveTarget {
    fromPath: string;
    kind: 'folder' | 'page';
    toFolderPath: string;
}

export interface WikiRenameTarget {
    fromPath: string;
    kind: 'folder' | 'page';
    toPath: string;
}

export function WikiPageSidebar({
    folders,
    onCreate,
    onDelete,
    onMove,
    onQueryChange,
    onRenamePath,
    onSelect,
    pages,
    query,
    selectedPageKey,
}: {
    folders: string[];
    onCreate: (kind: 'folder' | 'page', parentPath?: string) => void;
    onDelete: (target: WikiDeleteTarget) => void;
    onMove: (target: WikiMoveTarget) => void;
    onQueryChange: (query: string) => void;
    onRenamePath: (target: WikiRenameTarget) => void;
    onSelect: (page: WikiPageNode) => void;
    pages: WikiPageNode[];
    query: string;
    selectedPageKey: string | null;
}) {
    return (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-x-hidden border-[var(--content-card-border)] border-r bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)] text-sidebar-foreground">
            <WikiPageSidebarContent
                folders={folders}
                onCreate={onCreate}
                onDelete={onDelete}
                onMove={onMove}
                onQueryChange={onQueryChange}
                onRenamePath={onRenamePath}
                onSelect={onSelect}
                pages={pages}
                query={query}
                selectedPageKey={selectedPageKey}
            />
        </aside>
    );
}

function WikiPageSidebarContent({
    folders,
    onCreate,
    onDelete,
    onMove,
    onQueryChange,
    onRenamePath,
    onSelect,
    pages,
    query,
    selectedPageKey,
}: {
    folders: string[];
    onCreate: (kind: 'folder' | 'page', parentPath?: string) => void;
    onDelete: (target: WikiDeleteTarget) => void;
    onMove: (target: WikiMoveTarget) => void;
    onQueryChange: (query: string) => void;
    onRenamePath: (target: WikiRenameTarget) => void;
    onSelect: (page: WikiPageNode) => void;
    pages: WikiPageNode[];
    query: string;
    selectedPageKey: string | null;
}) {
    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-x-hidden">
            <SidebarHeader className="px-2 pt-0 pb-1">
                <div className="flex items-center gap-1">
                    <SearchInput
                        className="min-w-0 flex-1"
                        onChange={(event) => onQueryChange(event.currentTarget.value)}
                        placeholder="Search memory"
                        size="default"
                        value={query}
                    />
                    <Button
                        aria-label="New page"
                        onClick={() => onCreate('page')}
                        size="icon-sm"
                        title="New page"
                        variant="ghost"
                    >
                        <Icon icon={FileAddIcon} />
                    </Button>
                    <Button
                        aria-label="New folder"
                        onClick={() => onCreate('folder')}
                        size="icon-sm"
                        title="New folder"
                        variant="ghost"
                    >
                        <Icon icon={FolderAddIcon} />
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarContent className="min-h-0 flex-1 overflow-x-hidden">
                <SidebarGroup className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-1 py-2">
                    <SidebarGroupContent className="flex min-h-0 flex-1 overflow-x-hidden">
                        <WikiPageFileTree
                            folders={folders}
                            onCreate={onCreate}
                            onDelete={onDelete}
                            onMove={onMove}
                            onRenamePath={onRenamePath}
                            onSelect={onSelect}
                            pages={pages}
                            query={query}
                            selectedPageKey={selectedPageKey}
                        />
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </div>
    );
}
