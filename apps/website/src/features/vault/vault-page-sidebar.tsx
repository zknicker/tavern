import { FileAddIcon, FolderAddIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
} from '../../components/ui/sidebar.tsx';
import type { VaultPageNode } from './types.ts';
import type { VaultDeleteTarget } from './vault-dialogs.tsx';
import { VaultPageFileTree } from './vault-page-sidebar-file-tree.tsx';

export interface VaultMoveTarget {
    fromPath: string;
    kind: 'folder' | 'page';
    toFolderPath: string;
}

export interface VaultRenameTarget {
    fromPath: string;
    kind: 'folder' | 'page';
    toPath: string;
}

export function VaultPageSidebar({
    folders,
    onCreate,
    onDelete,
    onMove,
    onRenamePath,
    onSelect,
    pages,
    selectedPageKey,
}: {
    folders: string[];
    onCreate: (kind: 'folder' | 'page', parentPath?: string) => void;
    onDelete: (target: VaultDeleteTarget) => void;
    onMove: (target: VaultMoveTarget) => void;
    onRenamePath: (target: VaultRenameTarget) => void;
    onSelect: (page: VaultPageNode) => void;
    pages: VaultPageNode[];
    selectedPageKey: string | null;
}) {
    const [query, setQuery] = React.useState('');

    return (
        <aside className="flex min-h-0 w-[276px] shrink-0 flex-col overflow-x-hidden border-border/70 border-r bg-sidebar/35 text-sidebar-foreground">
            <VaultPageSidebarContent
                folders={folders}
                onCreate={onCreate}
                onDelete={onDelete}
                onMove={onMove}
                onRenamePath={onRenamePath}
                onSelect={onSelect}
                pages={pages}
                query={query}
                selectedPageKey={selectedPageKey}
                setQuery={setQuery}
            />
        </aside>
    );
}

function VaultPageSidebarContent({
    folders,
    onCreate,
    onDelete,
    onMove,
    onRenamePath,
    onSelect,
    pages,
    query,
    selectedPageKey,
    setQuery,
}: {
    folders: string[];
    onCreate: (kind: 'folder' | 'page', parentPath?: string) => void;
    onDelete: (target: VaultDeleteTarget) => void;
    onMove: (target: VaultMoveTarget) => void;
    onRenamePath: (target: VaultRenameTarget) => void;
    onSelect: (page: VaultPageNode) => void;
    pages: VaultPageNode[];
    query: string;
    selectedPageKey: string | null;
    setQuery: React.Dispatch<React.SetStateAction<string>>;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
            <SidebarHeader className="h-12 border-border/60 border-b px-2 py-2">
                <div className="flex items-center gap-1">
                    <SearchInput
                        className="min-w-0 flex-1"
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Search pages"
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
                <SidebarGroup className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-2 py-2">
                    <SidebarGroupContent className="flex min-h-0 flex-1 overflow-x-hidden">
                        <VaultPageFileTree
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
