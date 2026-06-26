import { AddCircleIcon, Delete02Icon, FileAddIcon } from '@hugeicons-pro/core-stroke-rounded';
import type {
    ContextMenuItem as FileTreeContextMenuItem,
    ContextMenuOpenContext as FileTreeContextMenuOpenContext,
    FileTreeDropResult,
    FileTreeRenameEvent,
    FileTreeSortEntry,
} from '@pierre/trees';
import { FileTree as TreesFileTree, useFileTree } from '@pierre/trees/react';
import * as React from 'react';
import {
    ContextMenuAnchoredPopup,
    ContextMenuItem,
    ContextMenuSeparator,
} from '../../components/ui/context-menu.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { VaultPageNode } from './types.ts';
import type { VaultDeleteTarget } from './vault-dialogs.tsx';
import type { VaultMoveTarget, VaultRenameTarget } from './vault-page-sidebar.tsx';

type TreeHostStyle = React.CSSProperties & Record<`--${string}`, string>;

interface VaultPageFileTreeProps {
    folders: string[];
    onCreate?: (kind: 'folder' | 'page', parentPath?: string) => void;
    onDelete?: (target: VaultDeleteTarget) => void;
    onMove?: (target: VaultMoveTarget) => void;
    onRenamePath?: (target: VaultRenameTarget) => void;
    onSelect: (page: VaultPageNode) => void;
    pages: VaultPageNode[];
    query: string;
    readOnly?: boolean;
    selectedPageKey: string | null;
}

const treeUnsafeCss = `
button[data-type='item'] {
  --tavern-tree-row-bg: var(--trees-bg);
  border-radius: 8px;
}

button[data-type='item']:hover {
  --tavern-tree-row-bg: var(--trees-bg-muted);
}

button[data-type='item'][aria-selected='true'] {
  --tavern-tree-row-bg: var(--trees-selected-bg);
}

button[data-type='item'][data-item-dragging='true'] {
  opacity: 1;
}

[data-file-tree-virtualized-scroll='true'] {
  overflow-x: hidden;
}
`;

export function VaultPageFileTree({
    folders,
    onCreate,
    onDelete,
    onMove,
    onRenamePath,
    onSelect,
    pages,
    query,
    readOnly = false,
    selectedPageKey,
}: VaultPageFileTreeProps) {
    const canEdit = !readOnly && onCreate && onDelete && onMove && onRenamePath;
    const treePaths = React.useMemo(
        () => buildVaultFileTreePaths(pages, folders),
        [folders, pages]
    );
    const pagesByTreePath = React.useMemo(() => {
        return new Map(pages.map((page) => [toTreePagePath(page.path), page]));
    }, [pages]);
    const callbacksRef = useLatestRef({
        onCreate,
        onDelete,
        onMove,
        onRenamePath,
        onSelect,
        pagesByTreePath,
        selectedPageKey,
    });
    const initialSelectedPath = selectedPageKey ? toTreePagePath(selectedPageKey) : undefined;
    const { model } = useFileTree({
        density: 'compact',
        ...(canEdit
            ? {
                  composition: {
                      contextMenu: {
                          buttonVisibility: 'when-needed' as const,
                          enabled: true,
                          triggerMode: 'both' as const,
                      },
                  },
                  dragAndDrop: {
                      onDropComplete(event: FileTreeDropResult) {
                          if (callbacksRef.current.onMove) {
                              handleDropComplete(event, callbacksRef.current.onMove);
                          }
                      },
                      openOnDropDelay: 420,
                  },
                  renaming: {
                      onRename(event: FileTreeRenameEvent) {
                          if (callbacksRef.current.onRenamePath) {
                              handleRename(event, callbacksRef.current.onRenamePath);
                          }
                      },
                  },
              }
            : {}),
        fileTreeSearchMode: 'hide-non-matches',
        flattenEmptyDirectories: false,
        initialExpansion: 'open',
        initialSearchQuery: query.trim() || null,
        initialSelectedPaths: initialSelectedPath ? [initialSelectedPath] : [],
        itemHeight: 28,
        onSelectionChange(selectedPaths) {
            const selectedPath = selectedPaths.find((path) => !isTreeFolderPath(path));
            if (!selectedPath) {
                return;
            }
            const current = callbacksRef.current;
            const page = current.pagesByTreePath.get(selectedPath);
            if (page && page.path !== current.selectedPageKey) {
                current.onSelect(page);
            }
        },
        paths: treePaths,
        sort: compareFileTreeEntries,
        unsafeCSS: treeUnsafeCss,
    });

    React.useEffect(() => {
        model.resetPaths(treePaths);
        syncTreeSelection(model, selectedPageKey);
    }, [model, selectedPageKey, treePaths]);

    React.useEffect(() => {
        model.setSearch(query.trim() || null);
    }, [model, query]);

    if (treePaths.length === 0) {
        return (
            <div className="px-1 py-2 text-muted-foreground text-sm">No memory files found.</div>
        );
    }

    return (
        <TreesFileTree
            className="h-full min-h-0 w-full flex-1 overflow-hidden"
            model={model}
            renderContextMenu={
                canEdit
                    ? (item, context) => (
                          <VaultTreeContextMenu
                              context={context}
                              item={item}
                              model={model}
                              onCreate={onCreate}
                              onDelete={onDelete}
                          />
                      )
                    : undefined
            }
            style={treeHostStyle}
        />
    );
}

function VaultTreeContextMenu({
    context,
    item,
    model,
    onCreate,
    onDelete,
}: {
    context: FileTreeContextMenuOpenContext;
    item: FileTreeContextMenuItem;
    model: ReturnType<typeof useFileTree>['model'];
    onCreate: (kind: 'folder' | 'page', parentPath?: string) => void;
    onDelete: (target: VaultDeleteTarget) => void;
}) {
    const target = toVaultDeleteTarget(item);
    const anchor = React.useMemo(
        () => ({
            getBoundingClientRect: () => context.anchorRect,
        }),
        [context.anchorRect]
    );

    function closeAndRun(action: () => void, restoreFocus = true) {
        context.close({ restoreFocus });
        action();
    }

    return (
        <ContextMenuAnchoredPopup
            anchor={anchor}
            className="w-[164px]"
            collisionAvoidance={{ align: 'shift', fallbackAxisSide: 'end', side: 'shift' }}
            collisionPadding={8}
            data-file-tree-context-menu-root="true"
            onOpenChange={(open) => {
                if (!open) {
                    context.close();
                }
            }}
            positionMethod="fixed"
            side="right"
            sideOffset={6}
        >
            {target.kind === 'folder' ? (
                <>
                    <ContextMenuItem
                        onClick={() => closeAndRun(() => onCreate('page', target.path))}
                    >
                        <Icon icon={FileAddIcon} />
                        New page
                    </ContextMenuItem>
                    <ContextMenuItem
                        onClick={() => closeAndRun(() => onCreate('folder', target.path))}
                    >
                        <Icon icon={AddCircleIcon} />
                        New folder
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                </>
            ) : null}
            <ContextMenuItem
                onClick={() => closeAndRun(() => model.startRenaming(item.path), false)}
            >
                Rename
            </ContextMenuItem>
            <ContextMenuItem
                onClick={() => closeAndRun(() => onDelete(target))}
                variant="destructive"
            >
                <Icon icon={Delete02Icon} />
                Delete
            </ContextMenuItem>
        </ContextMenuAnchoredPopup>
    );
}

function handleDropComplete(event: FileTreeDropResult, onMove: (target: VaultMoveTarget) => void) {
    const toFolderPath = fromTreeFolderPath(event.target.directoryPath);
    for (const path of event.draggedPaths) {
        onMove({
            fromPath: fromTreePath(path),
            kind: isTreeFolderPath(path) ? 'folder' : 'page',
            toFolderPath,
        });
    }
}

function handleRename(
    event: FileTreeRenameEvent,
    onRenamePath: (target: VaultRenameTarget) => void
) {
    onRenamePath({
        fromPath: fromTreePath(event.sourcePath),
        kind: event.isFolder ? 'folder' : 'page',
        toPath: event.isFolder
            ? fromTreeFolderPath(event.destinationPath)
            : toVaultPagePath(event.destinationPath),
    });
}

function buildVaultFileTreePaths(pages: VaultPageNode[], folders: string[]) {
    const paths = new Set<string>();
    for (const folder of folders) {
        addFolderAncestors(paths, folder);
        paths.add(toTreeFolderPath(folder));
    }
    for (const page of pages) {
        const treePath = toTreePagePath(page.path);
        addFolderAncestors(paths, treePath);
        paths.add(treePath);
    }
    return [...paths];
}

function addFolderAncestors(paths: Set<string>, path: string) {
    const segments = path.split('/').filter(Boolean);
    const folderSegments = isTreeFolderPath(path) ? segments : segments.slice(0, -1);
    for (let index = 0; index < folderSegments.length; index += 1) {
        paths.add(`${folderSegments.slice(0, index + 1).join('/')}/`);
    }
}

function compareFileTreeEntries(left: FileTreeSortEntry, right: FileTreeSortEntry) {
    if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
    }
    return left.basename.localeCompare(right.basename, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

function toVaultDeleteTarget(item: FileTreeContextMenuItem): VaultDeleteTarget {
    const path =
        item.kind === 'directory' ? fromTreeFolderPath(item.path) : fromTreePath(item.path);
    return {
        kind: item.kind === 'directory' ? 'folder' : 'page',
        path,
        title: trimTreeFolderSlash(item.name),
    };
}

function toTreePagePath(path: string) {
    return normalizeVaultPath(path);
}

function toVaultPagePath(path: string) {
    const normalized = normalizeVaultPath(path);
    return /\.md$/iu.test(normalized) ? normalized : `${normalized}.md`;
}

function toTreeFolderPath(path: string) {
    const normalized = normalizeVaultPath(path);
    return normalized ? `${normalized}/` : '';
}

function fromTreePath(path: string) {
    return isTreeFolderPath(path) ? fromTreeFolderPath(path) : toVaultPagePath(path);
}

function fromTreeFolderPath(path: string | null) {
    return path ? trimTreeFolderSlash(normalizeVaultPath(path)) : '';
}

function normalizeVaultPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}

function trimTreeFolderSlash(path: string) {
    return path.replace(/\/+$/u, '');
}

function isTreeFolderPath(path: string) {
    return path.endsWith('/');
}

function useLatestRef<T>(value: T) {
    const ref = React.useRef(value);
    ref.current = value;
    return ref;
}

function syncTreeSelection(
    model: ReturnType<typeof useFileTree>['model'],
    selectedPageKey: string | null
) {
    if (!selectedPageKey) {
        for (const selectedPath of model.getSelectedPaths()) {
            model.getItem(selectedPath)?.deselect();
        }
        return;
    }

    const nextSelectedPath = toTreePagePath(selectedPageKey);
    for (const selectedPath of model.getSelectedPaths()) {
        if (selectedPath !== nextSelectedPath) {
            model.getItem(selectedPath)?.deselect();
        }
    }
    const item = model.getItem(nextSelectedPath);
    if (item) {
        item.select();
        model.scrollToPath(nextSelectedPath, { focus: false, offset: 'nearest' });
    }
}

const treeHostStyle: TreeHostStyle = {
    '--trees-bg-override': 'var(--sidebar)',
    '--trees-bg-muted-override': 'var(--sidebar-accent)',
    '--trees-border-color-override': 'var(--sidebar-border)',
    '--trees-border-radius-override': '8px',
    '--trees-fg-muted-override': 'var(--muted-foreground)',
    '--trees-fg-override': 'var(--sidebar-foreground)',
    '--trees-file-icon-color': 'var(--sidebar-foreground)',
    '--trees-focus-ring-color-override': 'var(--sidebar-ring)',
    '--trees-font-family-override': 'inherit',
    '--trees-font-size-override': 'var(--text-sm)',
    '--trees-item-margin-x-override': '0px',
    '--trees-item-padding-x-override': '8px',
    '--trees-level-gap-override': '8px',
    '--trees-padding-inline-override': '4px',
    '--trees-scrollbar-gutter-override': '6px',
    '--trees-selected-bg-override': 'var(--sidebar-accent-active)',
    '--trees-selected-fg-override': 'var(--sidebar-accent-foreground)',
};
