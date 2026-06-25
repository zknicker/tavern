import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
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
import type { VaultPageDetail } from './types.ts';
import {
    getErrorMessage,
    isPathInFolder,
    joinVaultPath,
    lastPathSegment,
    normalizeDialogPath,
    pageKey,
    replacePathPrefix,
    resolveSelectedPage,
    resolveVaultLinkTarget,
} from './utils.ts';
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
import { type VaultEditorMode, VaultTopbar } from './vault-topbar.tsx';

export function Vault() {
    const [searchParams] = useSearchParams();
    const [selectedPage, setSelectedPage] = React.useState<{
        path: string;
    } | null>(() => {
        const path = searchParams.get('path');
        return path ? { path } : null;
    });
    const [pathDialog, setPathDialog] = React.useState<VaultPathDialogState | null>(null);
    const [pathDialogError, setPathDialogError] = React.useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<VaultDeleteTarget | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [moveError, setMoveError] = React.useState<string | null>(null);
    const [query, setQuery] = React.useState('');
    const [draft, setDraft] = React.useState('');
    const [editorMode, setEditorMode] = React.useState<VaultEditorMode>('edit');
    const [inspectorOpen, setInspectorOpen] = React.useState(false);
    const sidebarWidth = useResizablePaneWidth({
        defaultWidth: 276,
        maxWidth: 440,
        minWidth: 220,
        storageKey: 'tavern.vault.sidebar.width',
    });
    const [externalChangeState, setExternalChangeState] = React.useState<
        'changed' | 'missing' | null
    >(null);
    const [restoreError, setRestoreError] = React.useState<string | null>(null);
    const syncedPageRef = React.useRef<VaultPageDetail | null>(null);
    const [list] = useVaultListSuspense();
    const selectedPageExists = selectedPage
        ? list.pages.some((page) => page.path === selectedPage.path)
        : false;
    const selectedPageMissing = Boolean(selectedPage && !selectedPageExists);
    const pageNode = selectedPageMissing ? null : resolveSelectedPage(list, selectedPage);
    const selectedPath = selectedPage?.path ?? pageNode?.path ?? null;
    const pageDetailQuery = useVaultPage(selectedPageMissing ? selectedPage : pageNode);
    const createPage = useCreateVaultPage();
    const savePage = useSaveVaultPage();
    const createFolder = useCreateVaultFolder();
    const deletePage = useDeleteVaultPage();
    const deleteFolder = useDeleteVaultFolder();
    const movePath = useMoveVaultPath();
    const pageDetail = pageDetailQuery.data ?? null;
    const syncedPage = syncedPageRef.current;
    const hasDirtyDraft = Boolean(syncedPage && draft !== syncedPage.body);
    const hasDirtyDraftForSelectedPath = Boolean(
        hasDirtyDraft && syncedPage && syncedPage.path === selectedPath
    );
    const visiblePage = pageDetail ?? (hasDirtyDraftForSelectedPath ? syncedPage : null);
    const pagePath = visiblePage?.path ?? '';
    const isDirty = visiblePage ? draft !== visiblePage.body : false;
    const isPersistingPage = savePage.isPending || createPage.isPending;
    const canSave = Boolean(pageDetail && isDirty && !isPersistingPage);

    React.useEffect(() => {
        if (pageNode && (!selectedPage || pageNode.path !== selectedPage.path)) {
            setSelectedPage({ path: pageNode.path });
        }
        if (selectedPageMissing && selectedPage && !hasDirtyDraft) {
            setSelectedPage(null);
        }
    }, [hasDirtyDraft, pageNode, selectedPage, selectedPageMissing]);

    React.useEffect(() => {
        if (!pageDetail) {
            const previous = syncedPageRef.current;
            if (previous && previous.path === selectedPath && draft !== previous.body) {
                setExternalChangeState('missing');
                return;
            }

            syncedPageRef.current = null;
            setDraft('');
            setExternalChangeState(null);
            setRestoreError(null);
            return;
        }

        const previous = syncedPageRef.current;
        const samePage = previous?.path === pageDetail.path;
        const wasDirty = Boolean(samePage && draft !== previous.body);
        const serverChanged =
            !samePage ||
            previous.body !== pageDetail.body ||
            previous.updatedAt !== pageDetail.updatedAt;

        syncedPageRef.current = pageDetail;

        if (!(samePage && wasDirty)) {
            setDraft(pageDetail.body);
            setExternalChangeState(null);
            setRestoreError(null);
            return;
        }

        if (serverChanged) {
            setExternalChangeState('changed');
        }
    }, [draft, pageDetail, selectedPath]);

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
                        ? {
                              path: replacePathPrefix(current.path, target.fromPath, result.path),
                          }
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
                        ? {
                              path: replacePathPrefix(current.path, target.fromPath, result.path),
                          }
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
        const result = await savePage.mutateAsync({
            body,
            path: pageDetailQuery.data.path,
        });
        if (result.page) {
            syncedPageRef.current = result.page;
            setDraft(result.page.body);
        }
        setExternalChangeState(null);
        setRestoreError(null);
    }

    function handleReloadExternalChange() {
        if (!pageDetail) {
            syncedPageRef.current = null;
            setDraft('');
            setExternalChangeState(null);
            setRestoreError(null);
            setSelectedPage(null);
            return;
        }

        syncedPageRef.current = pageDetail;
        setDraft(pageDetail.body);
        setExternalChangeState(null);
        setRestoreError(null);
    }

    async function handleRecreateMissingPage() {
        const previous = syncedPageRef.current;
        if (!(previous && previous.path === selectedPath)) {
            return;
        }

        setRestoreError(null);
        try {
            const result = await createPage.mutateAsync({
                body: draft,
                path: previous.path,
            });
            if (result.page) {
                syncedPageRef.current = result.page;
                setDraft(result.page.body);
                setSelectedPage({ path: result.page.path });
                setExternalChangeState(null);
                setRestoreError(null);
            }
        } catch (error) {
            setRestoreError(getErrorMessage(error));
        }
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

    function handleSelectBreadcrumbPath(path: string) {
        const exactPage = list.pages.find((page) => page.path === path);
        const folderPage = list.pages.find((page) => isPathInFolder(page.path, path));
        const nextPage = exactPage ?? folderPage;
        if (nextPage) {
            setSelectedPage({ path: nextPage.path });
        }
    }

    return (
        <div
            className="grid h-full min-h-0 flex-1 grid-rows-[48px_minmax(0,1fr)] overflow-hidden bg-background"
            style={{ gridTemplateColumns: `${sidebarWidth.width}px minmax(0, 1fr)` }}
        >
            <div className="relative col-start-1 row-span-2 row-start-1 min-h-0">
                <ResizablePaneRail
                    maxWidth={440}
                    minWidth={220}
                    onWidthChange={sidebarWidth.setWidth}
                    onWidthCommit={sidebarWidth.persistWidth}
                    side="right"
                    width={sidebarWidth.width}
                />
                <VaultPageSidebar
                    folders={list.folders}
                    onCreate={handleCreate}
                    onDelete={handleDelete}
                    onMove={(target) => void handleMove(target)}
                    onQueryChange={setQuery}
                    onRenamePath={(target) => void handleRenamePath(target)}
                    onSelect={setSelectedPage}
                    pages={list.pages}
                    query={query}
                    selectedPageKey={pageNode ? pageKey(pageNode) : null}
                />
            </div>
            <div className="col-start-2 row-start-1 min-w-0">
                <VaultTopbar
                    canSave={canSave}
                    editorMode={editorMode}
                    inspectorOpen={inspectorOpen}
                    isSaving={isPersistingPage}
                    onEditorModeChange={setEditorMode}
                    onInspectorOpenChange={setInspectorOpen}
                    onSave={() => void handleSave(draft)}
                    onSelectPath={handleSelectBreadcrumbPath}
                    pagePath={pagePath}
                    pageSelected={Boolean(pageDetail)}
                />
            </div>
            <main className="col-start-2 row-start-2 flex min-h-0 flex-col overflow-hidden">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                    {moveError ? (
                        <div className="border-border/70 border-b bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                            {moveError}
                        </div>
                    ) : null}
                    <VaultDocumentPane
                        draft={draft}
                        editorMode={editorMode}
                        externalChangeState={externalChangeState}
                        inspectorOpen={inspectorOpen}
                        isLoading={pageDetailQuery.isFetching}
                        isSaving={isPersistingPage}
                        onDiscardMissingPage={handleReloadExternalChange}
                        onDraftChange={setDraft}
                        onKeepDraft={() => setExternalChangeState(null)}
                        onNavigate={handleNavigate}
                        onRecreateMissingPage={() => void handleRecreateMissingPage()}
                        onReloadPage={handleReloadExternalChange}
                        onSave={handleSave}
                        onSelectPage={setSelectedPage}
                        page={visiblePage}
                        saveDisabled={!canSave}
                        saveErrorMessage={
                            savePage.error ? getErrorMessage(savePage.error) : restoreError
                        }
                    />
                </div>
            </main>
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
