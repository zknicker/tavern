import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { usePaneEditorHost } from '../../hooks/pane/use-pane-editor-host.ts';
import { useWikiListSuspense } from '../../hooks/wiki/use-wiki-list.ts';
import {
    useCreateWikiFolder,
    useCreateWikiPage,
    useDeleteWikiFolder,
    useDeleteWikiPage,
    useMoveWikiPath,
} from '../../hooks/wiki/use-wiki-mutations.ts';
import { useWikiPage } from '../../hooks/wiki/use-wiki-page.ts';
import { useWikiPaneEditorAdapter } from '../../hooks/wiki/use-wiki-pane-editor-adapter.ts';
import {
    getErrorMessage,
    isPathInFolder,
    joinWikiPath,
    lastPathSegment,
    normalizeDialogPath,
    pageKey,
    replacePathPrefix,
    resolveSelectedPage,
    resolveWikiLinkTarget,
} from './utils.ts';
import {
    WikiDeleteDialog,
    type WikiDeleteTarget,
    WikiPathDialog,
    type WikiPathDialogState,
} from './wiki-dialogs.tsx';
import { WikiDocumentPane } from './wiki-document-pane.tsx';
import {
    type WikiMoveTarget,
    WikiPageSidebar,
    type WikiRenameTarget,
} from './wiki-page-sidebar.tsx';
import { type WikiEditorMode, WikiTopbar } from './wiki-topbar.tsx';

export function Wiki() {
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
    const [pathDialog, setPathDialog] = React.useState<WikiPathDialogState | null>(null);
    const [pathDialogError, setPathDialogError] = React.useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<WikiDeleteTarget | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [moveError, setMoveError] = React.useState<string | null>(null);
    const [query, setQuery] = React.useState('');
    const [editorMode, setEditorMode] = React.useState<WikiEditorMode>('edit');
    const [inspectorOpen, setInspectorOpen] = React.useState(false);
    const sidebarWidth = useResizablePaneWidth({
        defaultWidth: 276,
        maxWidth: 440,
        minWidth: 220,
        storageKey: 'tavern.wiki.sidebar.width',
    });
    const [restoreError, setRestoreError] = React.useState<string | null>(null);
    const [list] = useWikiListSuspense();
    const selectedPageExists = selectedPage
        ? list.pages.some((page) => page.path === selectedPage.path)
        : false;
    const selectedPageMissing = Boolean(selectedPage && !selectedPageExists);
    const pageNode = selectedPageMissing ? null : resolveSelectedPage(list, selectedPage);
    const selectedPath = selectedPage?.path ?? pageNode?.path ?? null;
    const pageDetailQuery = useWikiPage(selectedPageMissing ? selectedPage : pageNode);
    const createPage = useCreateWikiPage();
    const createFolder = useCreateWikiFolder();
    const deletePage = useDeleteWikiPage();
    const deleteFolder = useDeleteWikiFolder();
    const movePath = useMoveWikiPath();
    const pageDetail = pageDetailQuery.data ?? null;
    const editorAdapter = useWikiPaneEditorAdapter(
        selectedPath ?? '',
        pageDetail,
        pageDetailQuery.isFetching
    );
    const editor = usePaneEditorHost(editorAdapter);
    const hasDirtyDraft = editor.dirty;
    const lastPage = editor.lastSnapshot?.document ?? null;
    const visiblePage = pageDetail ?? (lastPage?.path === selectedPath ? lastPage : null);
    const pagePath = visiblePage?.path ?? '';
    const isPersistingPage = editorAdapter.isWriting || createPage.isPending;
    const canSave = Boolean(pageDetail && editor.canSave);

    React.useEffect(() => {
        if (pageNode && (!selectedPage || pageNode.path !== selectedPage.path)) {
            setSelectedPage({ path: pageNode.path });
        }
        if (selectedPageMissing && selectedPage && !hasDirtyDraft) {
            setSelectedPage(null);
        }
    }, [hasDirtyDraft, pageNode, selectedPage, selectedPageMissing, setSelectedPage]);

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
            const nextPath = joinWikiPath(pathDialog.parentPath, path);
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

    async function handleRenamePath(target: WikiRenameTarget) {
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

    function handleDelete(target: WikiDeleteTarget) {
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

    async function handleMove(target: WikiMoveTarget) {
        const toPath = joinWikiPath(target.toFolderPath, lastPathSegment(target.fromPath));
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

    function handleReloadExternalChange() {
        if (!pageDetail) {
            editor.reload();
            setRestoreError(null);
            setSelectedPage(null);
            return;
        }
        editor.reload();
        setRestoreError(null);
    }

    async function handleRecreateMissingPage() {
        const previous = editor.lastSnapshot?.document;
        if (!(previous && previous.path === selectedPath)) {
            return;
        }

        setRestoreError(null);
        try {
            const result = await createPage.mutateAsync({
                body: editor.draft,
                frontmatter: previous.frontmatter,
                path: previous.path,
            });
            if (result.page) {
                editor.replaceSnapshot({
                    content: result.page.body,
                    document: result.page,
                    revision: result.page.hash,
                });
                setSelectedPage({ path: result.page.path });
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
        const resolved = resolveWikiLinkTarget(list.pages, pageNode, target);
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
            className="grid h-full min-h-0 flex-1 grid-rows-[var(--content-topbar-height)_minmax(0,1fr)] overflow-hidden bg-background"
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
                <WikiPageSidebar
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
                <WikiTopbar
                    canSave={canSave}
                    editorMode={editorMode}
                    inspectorOpen={inspectorOpen}
                    isSaving={isPersistingPage}
                    onEditorModeChange={setEditorMode}
                    onInspectorOpenChange={setInspectorOpen}
                    onSave={() => void editor.save()}
                    onSelectPath={handleSelectBreadcrumbPath}
                    pagePath={pagePath}
                    pageSelected={Boolean(pageDetail)}
                />
            </div>
            <section className="col-start-2 row-start-2 flex min-h-0 flex-col overflow-hidden">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                    {moveError ? (
                        <div className="border-border/70 border-b bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                            {moveError}
                        </div>
                    ) : null}
                    <WikiDocumentPane
                        draft={editor.draft}
                        editorMode={editorMode}
                        externalChangeState={editor.externalChange}
                        inspectorOpen={inspectorOpen}
                        isLoading={pageDetailQuery.isFetching}
                        isSaving={isPersistingPage}
                        onDiscardMissingPage={handleReloadExternalChange}
                        onDraftChange={editor.setDraft}
                        onImagePreview={editorAdapter.imagePreview}
                        onImageUpload={editorAdapter.uploadImage}
                        onKeepDraft={editor.keepDraft}
                        onNavigate={handleNavigate}
                        onRecreateMissingPage={() => void handleRecreateMissingPage()}
                        onReloadPage={handleReloadExternalChange}
                        onSave={editor.save}
                        onSelectPage={setSelectedPage}
                        page={visiblePage}
                        saveDisabled={!canSave}
                        saveErrorMessage={editor.saveError ?? restoreError}
                    />
                </div>
            </section>
            <WikiPathDialog
                errorMessage={pathDialogError}
                isPending={createPage.isPending || createFolder.isPending || movePath.isPending}
                onClose={() => {
                    setPathDialog(null);
                    setPathDialogError(null);
                }}
                onSubmit={handlePathDialogSubmit}
                state={pathDialog}
            />
            <WikiDeleteDialog
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
