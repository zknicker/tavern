import { FileAddIcon, FolderAddIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
} from '../../../components/ui/sidebar.tsx';
import type { SemanticMemoryDeleteTarget } from './semantic-memory-dialogs.tsx';
import { SemanticMemoryPageFileTree } from './semantic-memory-page-sidebar-file-tree.tsx';
import type { SemanticMemoryPageNode } from './types.ts';

export interface SemanticMemoryMoveTarget {
    fromPath: string;
    kind: 'folder' | 'page';
    toFolderPath: string;
}

export interface SemanticMemoryRenameTarget {
    fromPath: string;
    kind: 'folder' | 'page';
    toPath: string;
}

export function SemanticMemoryPageSidebar({
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
    onDelete: (target: SemanticMemoryDeleteTarget) => void;
    onMove: (target: SemanticMemoryMoveTarget) => void;
    onQueryChange: (query: string) => void;
    onRenamePath: (target: SemanticMemoryRenameTarget) => void;
    onSelect: (page: SemanticMemoryPageNode) => void;
    pages: SemanticMemoryPageNode[];
    query: string;
    selectedPageKey: string | null;
}) {
    return (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-x-hidden border-border/70 border-r bg-sidebar/35 text-sidebar-foreground">
            <SemanticMemoryPageSidebarContent
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

function SemanticMemoryPageSidebarContent({
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
    onDelete: (target: SemanticMemoryDeleteTarget) => void;
    onMove: (target: SemanticMemoryMoveTarget) => void;
    onQueryChange: (query: string) => void;
    onRenamePath: (target: SemanticMemoryRenameTarget) => void;
    onSelect: (page: SemanticMemoryPageNode) => void;
    pages: SemanticMemoryPageNode[];
    query: string;
    selectedPageKey: string | null;
}) {
    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-x-hidden">
            <SidebarHeader className="h-12 border-border/70 border-b py-2 pr-2 pl-2">
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
                        <SemanticMemoryPageFileTree
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
