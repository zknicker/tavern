import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../../components/ui/resizable-pane-rail.tsx';
import { useSemanticMemoryListSuspense } from '../../../hooks/semantic-memory/use-semantic-memory-list.ts';
import {
    useCreateSemanticMemoryFolder,
    useCreateSemanticMemoryPage,
    useDeleteSemanticMemoryFolder,
    useDeleteSemanticMemoryPage,
    useMoveSemanticMemoryPath,
    useSaveSemanticMemoryPage,
} from '../../../hooks/semantic-memory/use-semantic-memory-mutations.ts';
import { useSemanticMemoryPage } from '../../../hooks/semantic-memory/use-semantic-memory-page.ts';
import {
    SemanticMemoryDeleteDialog,
    type SemanticMemoryDeleteTarget,
    SemanticMemoryPathDialog,
    type SemanticMemoryPathDialogState,
} from './semantic-memory-dialogs.tsx';
import { SemanticMemoryDocumentPane } from './semantic-memory-document-pane.tsx';
import {
    type SemanticMemoryMoveTarget,
    SemanticMemoryPageSidebar,
    type SemanticMemoryRenameTarget,
} from './semantic-memory-page-sidebar.tsx';
import { type SemanticMemoryEditorMode, SemanticMemoryTopbar } from './semantic-memory-topbar.tsx';
import type { SemanticMemoryPageDetail } from './types.ts';
import {
    getErrorMessage,
    isPathInFolder,
    joinSemanticMemoryPath,
    lastPathSegment,
    normalizeDialogPath,
    pageKey,
    replacePathPrefix,
    resolveSelectedPage,
    resolveSemanticMemoryLinkTarget,
} from './utils.ts';

export function SemanticMemory() {
    const [searchParams, setSearchParams] = useSearchParams();
    // The open page lives in the URL (`?path=`) so it is part of the tab's route and
    // survives the tab being torn off or merged into another window.
    const selectedPagePath = searchParams.get('path');
    const selectedPage = React.useMemo(
        () => (selectedPagePath ? { path: selectedPagePath } : null),
        [selectedPagePath]
    );
    const setSelectedPage = React.useCallback(
        (next: { path: string } | null) => {
            setSearchParams(
                (params) => {
                    const updated = new URLSearchParams(params);

                    if (next) {
                        updated.set('path', next.path);
                    } else {
                        updated.delete('path');
                    }

                    return updated;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );
    const [pathDialog, setPathDialog] = React.useState<SemanticMemoryPathDialogState | null>(null);
    const [pathDialogError, setPathDialogError] = React.useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<SemanticMemoryDeleteTarget | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [moveError, setMoveError] = React.useState<string | null>(null);
    const [query, setQuery] = React.useState('');
    const [draft, setDraft] = React.useState('');
    const [editorMode, setEditorMode] = React.useState<SemanticMemoryEditorMode>('edit');
    const [inspectorOpen, setInspectorOpen] = React.useState(false);
    const sidebarWidth = useResizablePaneWidth({
        defaultWidth: 276,
        maxWidth: 440,
        minWidth: 220,
        storageKey: 'tavern.semanticMemory.sidebar.width',
    });
    const [externalChangeState, setExternalChangeState] = React.useState<
        'changed' | 'missing' | null
    >(null);
    const [restoreError, setRestoreError] = React.useState<string | null>(null);
    const syncedPageRef = React.useRef<SemanticMemoryPageDetail | null>(null);
    const [list] = useSemanticMemoryListSuspense();
    const selectedPageExists = selectedPage
        ? list.pages.some((page) => page.path === selectedPage.path)
        : false;
    const selectedPageMissing = Boolean(selectedPage && !selectedPageExists);
    const pageNode = selectedPageMissing ? null : resolveSelectedPage(list, selectedPage);
    const selectedPath = selectedPage?.path ?? pageNode?.path ?? null;
    const pageDetailQuery = useSemanticMemoryPage(selectedPageMissing ? selectedPage : pageNode);
    const createPage = useCreateSemanticMemoryPage();
    const savePage = useSaveSemanticMemoryPage();
    const createFolder = useCreateSemanticMemoryFolder();
    const deletePage = useDeleteSemanticMemoryPage();
    const deleteFolder = useDeleteSemanticMemoryFolder();
    const movePath = useMoveSemanticMemoryPath();
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
    }, [hasDirtyDraft, pageNode, selectedPage, selectedPageMissing, setSelectedPage]);

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
            const nextPath = joinSemanticMemoryPath(pathDialog.parentPath, path);
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

    async function handleRenamePath(target: SemanticMemoryRenameTarget) {
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
            } else if (target.kind === 'folder' && selectedPage) {
                setSelectedPage({
                    path: replacePathPrefix(selectedPage.path, target.fromPath, result.path),
                });
            }
        } catch (error) {
            setMoveError(getErrorMessage(error));
        }
    }

    function handleDelete(target: SemanticMemoryDeleteTarget) {
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

    async function handleMove(target: SemanticMemoryMoveTarget) {
        const toPath = joinSemanticMemoryPath(
            target.toFolderPath,
            lastPathSegment(target.fromPath)
        );
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
            } else if (target.kind === 'folder' && selectedPage) {
                setSelectedPage({
                    path: replacePathPrefix(selectedPage.path, target.fromPath, result.path),
                });
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
        const resolved = resolveSemanticMemoryLinkTarget(list.pages, pageNode, target);
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
                <SemanticMemoryPageSidebar
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
                <SemanticMemoryTopbar
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
                    <SemanticMemoryDocumentPane
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
            <SemanticMemoryPathDialog
                errorMessage={pathDialogError}
                isPending={createPage.isPending || createFolder.isPending || movePath.isPending}
                onClose={() => {
                    setPathDialog(null);
                    setPathDialogError(null);
                }}
                onSubmit={handlePathDialogSubmit}
                state={pathDialog}
            />
            <SemanticMemoryDeleteDialog
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
