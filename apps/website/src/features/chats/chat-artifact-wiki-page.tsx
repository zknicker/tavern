import { WorkHistoryIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { SelectionQuoteContainer } from '../../components/quote/selection-quote.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { usePaneEditorHost } from '../../hooks/pane/use-pane-editor-host.ts';
import { useCreateWikiPage } from '../../hooks/wiki/use-wiki-mutations.ts';
import { useWikiPage } from '../../hooks/wiki/use-wiki-page.ts';
import { useWikiPaneEditorAdapter } from '../../hooks/wiki/use-wiki-pane-editor-adapter.ts';
import type { WikiPageDetail } from '../wiki/types.ts';
import { WikiMarkdownEditor } from '../wiki/wiki-markdown-editor.tsx';
import { type WikiLinkNavigate, WikiMarkdownViewer } from '../wiki/wiki-markdown-viewer.tsx';
import { WikiPageHistoryPanel } from '../wiki/wiki-page-history.tsx';
import { formatTavernResourceLink } from './tavern-resource-link.ts';

export function ChatArtifactWikiPage({
    emptyDetail = 'No Wiki page exists at this path.',
    onNavigate,
    path,
}: {
    emptyDetail?: string;
    onNavigate?: WikiLinkNavigate;
    path: string | null;
}) {
    const pageQuery = useWikiPage(path ? { path } : null);

    if (!path) {
        return <WikiPageEmpty detail={emptyDetail} title="No page selected" />;
    }

    if (pageQuery.isPending) {
        return <WikiPageEmpty detail="Loading Wiki page..." title={path} />;
    }

    return (
        <ChatArtifactWikiPageContent
            emptyDetail={pageQuery.error ? 'Unable to load this Wiki page.' : emptyDetail}
            isLoading={pageQuery.isFetching}
            key={path}
            onNavigate={onNavigate}
            page={pageQuery.data ?? null}
            path={path}
        />
    );
}

export function ChatArtifactWikiPageContent({
    emptyDetail = 'No Wiki page exists at this path.',
    isLoading = false,
    onNavigate,
    page,
    path,
}: {
    emptyDetail?: string;
    isLoading?: boolean;
    onNavigate?: WikiLinkNavigate;
    page: WikiPageDetail | null;
    path: string;
}) {
    const adapter = useWikiPaneEditorAdapter(path, page, isLoading);
    const editor = usePaneEditorHost(adapter);
    const createPage = useCreateWikiPage();
    const [mode, setMode] = React.useState<'edit' | 'history' | 'view'>('view');
    const [restoreError, setRestoreError] = React.useState<string | null>(null);
    const visiblePage = page ?? editor.lastSnapshot?.document ?? null;
    const isPersisting = adapter.isWriting || createPage.isPending;

    async function recreatePage() {
        const previous = editor.lastSnapshot?.document;
        setRestoreError(null);
        try {
            const result = await createPage.mutateAsync({
                body: editor.draft,
                frontmatter: previous?.frontmatter,
                path,
            });
            if (!result.page) {
                throw new Error('Wiki create did not return the restored page.');
            }
            editor.replaceSnapshot({
                content: result.page.body,
                document: result.page,
                revision: result.page.hash,
            });
        } catch (error) {
            setRestoreError(error instanceof Error ? error.message : 'Unable to recreate page.');
        }
    }

    function discardMissingPage() {
        editor.reload();
        setRestoreError(null);
    }

    if (!visiblePage) {
        return <WikiPageEmpty detail={emptyDetail} title={path} />;
    }

    return (
        <div className="relative flex h-full min-h-0 flex-col">
            <WikiPageToolbar
                isSaving={isPersisting}
                mode={mode}
                onModeChange={setMode}
                onSave={() => void editor.save()}
                saveDisabled={!(page && editor.canSave)}
            />
            {editor.saveError || restoreError ? (
                <div className="shrink-0 border-border/70 border-b bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                    {editor.saveError ?? restoreError}
                </div>
            ) : null}
            {editor.externalChange === 'changed' ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-border/70 border-b bg-warning/8 px-4 py-2 text-sm">
                    <span>This page changed since it was opened.</span>
                    <div className="flex gap-2">
                        <Button onClick={editor.reload} size="xs" variant="outline">
                            Reload
                        </Button>
                        <Button onClick={editor.keepDraft} size="xs" variant="ghost">
                            Keep draft
                        </Button>
                    </div>
                </div>
            ) : null}
            {editor.externalChange === 'missing' ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-border/70 border-b bg-warning/8 px-4 py-2 text-sm">
                    <span>This page was removed. Your draft is preserved.</span>
                    <div className="flex shrink-0 gap-2">
                        <Button onClick={discardMissingPage} size="xs" variant="outline">
                            Discard
                        </Button>
                        <Button
                            disabled={createPage.isPending}
                            onClick={() => void recreatePage()}
                            size="xs"
                            variant="secondary"
                        >
                            Recreate
                        </Button>
                    </div>
                </div>
            ) : null}
            {mode === 'edit' ? (
                <WikiMarkdownEditor
                    className="min-h-0 flex-1"
                    disabled={isPersisting}
                    onChange={editor.setDraft}
                    onImageUpload={adapter.uploadImage}
                    onSave={() => void editor.save()}
                    resolveImagePreview={adapter.imagePreview}
                    saveDisabled={!(page && editor.canSave)}
                    value={editor.draft}
                />
            ) : (
                <WikiPageReadMode
                    mode={mode}
                    onNavigate={onNavigate}
                    path={visiblePage.path}
                    value={editor.draft}
                />
            )}
        </div>
    );
}

function WikiPageToolbar({
    isSaving,
    mode,
    onModeChange,
    onSave,
    saveDisabled,
}: {
    isSaving: boolean;
    mode: 'edit' | 'history' | 'view';
    onModeChange: (mode: 'edit' | 'history' | 'view') => void;
    onSave: () => void;
    saveDisabled: boolean;
}) {
    return (
        <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-border/70 border-b px-3">
            <Button
                onClick={() => onModeChange('view')}
                size="sm"
                variant={mode === 'view' ? 'secondary' : 'ghost'}
            >
                View
            </Button>
            <Button
                onClick={() => onModeChange('edit')}
                size="sm"
                variant={mode === 'edit' ? 'secondary' : 'ghost'}
            >
                Edit
            </Button>
            <Button
                onClick={() => onModeChange('history')}
                size="sm"
                variant={mode === 'history' ? 'secondary' : 'ghost'}
            >
                <Icon icon={WorkHistoryIcon} />
                History
            </Button>
            {mode === 'edit' ? (
                <Button disabled={saveDisabled} onClick={onSave} size="sm">
                    {isSaving ? 'Saving...' : 'Save'}
                </Button>
            ) : null}
        </div>
    );
}

function WikiPageReadMode({
    mode,
    onNavigate,
    path,
    value,
}: {
    mode: 'history' | 'view';
    onNavigate?: WikiLinkNavigate;
    path: string;
    value: string;
}) {
    return (
        <ScrollArea className="h-full min-h-0" scrollFade>
            {mode === 'history' ? (
                <div className="mx-auto max-w-[42rem] px-7 pt-12 pb-12">
                    <WikiPageHistoryPanel path={path} />
                </div>
            ) : (
                <SelectionQuoteContainer
                    source={{
                        href: formatTavernResourceLink({ kind: 'wikiPage', path }),
                        label: path,
                    }}
                >
                    <article className="mx-auto max-w-[42rem] px-7 pt-7 pb-12">
                        <WikiMarkdownViewer onNavigate={onNavigate} pagePath={path} value={value} />
                    </article>
                </SelectionQuoteContainer>
            )}
        </ScrollArea>
    );
}

function WikiPageEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        <div className="grid h-full min-h-0 place-items-center px-8 text-center">
            <div className="max-w-sm">
                <div className="font-medium text-sm">{title}</div>
                <div className="mt-1 text-muted-foreground text-sm leading-6">{detail}</div>
            </div>
        </div>
    );
}
