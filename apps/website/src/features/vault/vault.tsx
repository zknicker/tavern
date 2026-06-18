import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVaultListSuspense } from '../../hooks/vault/use-vault-list.ts';
import {
    useCreateVaultFolder,
    useCreateVaultPage,
    useDeleteVaultFolder,
    useDeleteVaultPage,
    useMoveVaultPath,
    useSaveVaultPage,
} from '../../hooks/vault/use-vault-mutations.ts';
import { useVaultPage } from '../../hooks/vault/use-vault-page.ts';
import type { VaultPageNode } from './types.ts';
import { pageKey, resolveSelectedPage, resolveVaultLinkTarget } from './utils.ts';
import {
    VaultDeleteDialog,
    type VaultDeleteTarget,
    VaultPathDialog,
    type VaultPathDialogState,
} from './vault-dialogs.tsx';
import { VaultDocumentPane } from './vault-document-pane.tsx';
import {
    type VaultMoveTarget,
    VaultPageSidebar,
    type VaultRenameTarget,
} from './vault-page-sidebar.tsx';

export function Vault() {
    const [searchParams] = useSearchParams();
    const [selectedPage, setSelectedPage] = React.useState<{ path: string } | null>(() => {
        const path = searchParams.get('path');
        return path ? { path } : null;
    });
    const [pathDialog, setPathDialog] = React.useState<VaultPathDialogState | null>(null);
    const [pathDialogError, setPathDialogError] = React.useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<VaultDeleteTarget | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [moveError, setMoveError] = React.useState<string | null>(null);
    const [list] = useVaultListSuspense();
    const pageNode = resolveSelectedPage(list, selectedPage);
    const pageDetailQuery = useVaultPage(pageNode ? { path: pageNode.path } : null);
    const createPage = useCreateVaultPage();
    const savePage = useSaveVaultPage();
    const createFolder = useCreateVaultFolder();
    const deletePage = useDeleteVaultPage();
    const deleteFolder = useDeleteVaultFolder();
    const movePath = useMoveVaultPath();

    React.useEffect(() => {
        if (pageNode && (!selectedPage || pageNode.path !== selectedPage.path)) {
            setSelectedPage({ path: pageNode.path });
        }
        if (!pageNode && selectedPage) {
            setSelectedPage(null);
        }
    }, [pageNode, selectedPage]);

    function handleSelect(page: VaultPageNode) {
        setSelectedPage({ path: page.path });
    }

    function handleSelectPage(page: { path: string }) {
        setSelectedPage(page);
    }

    function handleCreate(kind: 'folder' | 'page', parentPath?: string) {
        setPathDialogError(null);
        setPathDialog({
            mode: kind,
            parentPath,
            title: kind === 'folder' ? 'New folder' : 'New page',
        });
    }

    async function handlePathDialogSubmit(path: string) {
        if (!pathDialog) {
            return;
        }

        setPathDialogError(null);
        try {
            const nextPath = joinVaultPath(pathDialog.parentPath, path);
            if (pathDialog.mode === 'page') {
                const result = await createPage.mutateAsync({ path: nextPath });
                if (result.page) {
                    setSelectedPage({ path: result.page.path });
                }
            } else {
                await createFolder.mutateAsync({ path: nextPath });
            }
            setPathDialog(null);
        } catch (error) {
            setPathDialogError(getErrorMessage(error));
        }
    }

    async function handleRenamePath(target: VaultRenameTarget) {
        const toPath = normalizeDialogPath(target.toPath);
        if (target.fromPath === toPath) {
            return;
        }
        if (target.kind === 'folder' && isPathInFolder(toPath, target.fromPath)) {
            return;
        }

        setMoveError(null);
        try {
            const result = await movePath.mutateAsync({
                fromPath: target.fromPath,
                kind: target.kind,
                toPath,
            });
            if (target.kind === 'page' && selectedPage?.path === target.fromPath && result.page) {
                setSelectedPage({ path: result.page.path });
            } else if (target.kind === 'folder') {
                setSelectedPage((current) =>
                    current
                        ? { path: replacePathPrefix(current.path, target.fromPath, result.path) }
                        : null
                );
            }
        } catch (error) {
            setMoveError(getErrorMessage(error));
        }
    }

    function handleDelete(target: VaultDeleteTarget) {
        setDeleteError(null);
        setDeleteTarget(target);
    }

    async function handleConfirmDelete() {
        if (!deleteTarget) {
            return;
        }

        setDeleteError(null);
        try {
            if (deleteTarget.kind === 'page') {
                await deletePage.mutateAsync({ path: deleteTarget.path });
                if (selectedPage?.path === deleteTarget.path) {
                    setSelectedPage(null);
                }
            } else {
                await deleteFolder.mutateAsync({ path: deleteTarget.path });
                if (selectedPage && isPathInFolder(selectedPage.path, deleteTarget.path)) {
                    setSelectedPage(null);
                }
            }
            setDeleteTarget(null);
        } catch (error) {
            setDeleteError(getErrorMessage(error));
        }
    }

    async function handleMove(target: VaultMoveTarget) {
        const toPath = joinVaultPath(target.toFolderPath, lastPathSegment(target.fromPath));
        if (target.fromPath === toPath) {
            return;
        }
        if (target.kind === 'folder' && isPathInFolder(target.toFolderPath, target.fromPath)) {
            return;
        }

        setMoveError(null);
        try {
            const result = await movePath.mutateAsync({
                fromPath: target.fromPath,
                kind: target.kind,
                toPath,
            });
            if (target.kind === 'page' && selectedPage?.path === target.fromPath && result.page) {
                setSelectedPage({ path: result.page.path });
            } else if (target.kind === 'folder') {
                setSelectedPage((current) =>
                    current
                        ? { path: replacePathPrefix(current.path, target.fromPath, result.path) }
                        : null
                );
            }
        } catch (error) {
            setMoveError(getErrorMessage(error));
        }
    }

    async function handleSave(body: string) {
        if (!pageDetailQuery.data) {
            return;
        }
        await savePage.mutateAsync({ body, path: pageDetailQuery.data.path });
    }

    function handleNavigate(target: string) {
        if (!pageNode) {
            return;
        }
        const resolved = resolveVaultLinkTarget(list.pages, pageNode, target);
        if (resolved) {
            setSelectedPage({ path: resolved.path });
        }
    }

    return (
        <div className="grid min-h-0 flex-1 bg-background">
            <div className="grid min-h-0 grid-cols-[276px_minmax(0,1fr)] overflow-hidden">
                <VaultPageSidebar
                    folders={list.folders}
                    onCreate={handleCreate}
                    onDelete={handleDelete}
                    onMove={(target) => void handleMove(target)}
                    onRenamePath={(target) => void handleRenamePath(target)}
                    onSelect={handleSelect}
                    pages={list.pages}
                    selectedPageKey={pageNode ? pageKey(pageNode) : null}
                />
                <main className="min-h-0 overflow-hidden">
                    <div className="h-full min-h-0">
                        {moveError ? (
                            <div className="border-border/70 border-b bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                                {moveError}
                            </div>
                        ) : null}
                        <VaultDocumentPane
                            isLoading={pageDetailQuery.isFetching}
                            isSaving={savePage.isPending}
                            onNavigate={handleNavigate}
                            onSave={handleSave}
                            onSelectPage={handleSelectPage}
                            page={pageDetailQuery.data ?? null}
                            saveErrorMessage={
                                savePage.error ? getErrorMessage(savePage.error) : null
                            }
                        />
                    </div>
                </main>
            </div>
            <VaultPathDialog
                errorMessage={pathDialogError}
                isPending={createPage.isPending || createFolder.isPending || movePath.isPending}
                onClose={() => {
                    setPathDialog(null);
                    setPathDialogError(null);
                }}
                onSubmit={handlePathDialogSubmit}
                state={pathDialog}
            />
            <VaultDeleteDialog
                errorMessage={deleteError}
                isPending={deletePage.isPending || deleteFolder.isPending}
                onClose={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                }}
                onDelete={handleConfirmDelete}
                target={deleteTarget}
            />
        </div>
    );
}

function joinVaultPath(parentPath: string | undefined, childPath: string) {
    const normalizedChild = normalizeDialogPath(childPath);
    if (!parentPath) {
        return normalizedChild;
    }
    return `${normalizeDialogPath(parentPath)}/${normalizedChild}`;
}

function normalizeDialogPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}

function lastPathSegment(path: string) {
    return normalizeDialogPath(path).split('/').at(-1) ?? path;
}

function isPathInFolder(path: string, folderPath: string) {
    return path === folderPath || path.startsWith(`${folderPath}/`);
}

function replacePathPrefix(path: string, fromPrefix: string, toPrefix: string) {
    if (!isPathInFolder(path, fromPrefix)) {
        return path;
    }
    return `${toPrefix}${path.slice(fromPrefix.length)}`;
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Vault update failed.';
}
