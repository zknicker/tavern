import { Button } from '../../components/ui/primitives/button.tsx';
import { cn } from '../../lib/utils.ts';
import type { VaultPageDetail } from './types.ts';
import { VaultDocumentInspector } from './vault-document-inspector.tsx';
import { VaultDocumentPreview } from './vault-document-preview.tsx';
import { VaultMarkdownEditor } from './vault-markdown-editor.tsx';
import type { VaultLinkNavigate } from './vault-markdown-viewer.tsx';
import type { VaultEditorMode } from './vault-topbar.tsx';

export function VaultDocumentPane({
    draft,
    editorMode,
    externalChangeState,
    inspectorOpen,
    isLoading,
    isSaving,
    onDraftChange,
    onDiscardMissingPage,
    onKeepDraft,
    onNavigate,
    onRecreateMissingPage,
    onReloadPage,
    onSave,
    onSelectPage,
    page,
    saveErrorMessage,
    saveDisabled,
}: {
    draft: string;
    editorMode: VaultEditorMode;
    externalChangeState: 'changed' | 'missing' | null;
    inspectorOpen: boolean;
    isLoading: boolean;
    isSaving: boolean;
    onDraftChange: (draft: string) => void;
    onDiscardMissingPage: () => void;
    onKeepDraft: () => void;
    onNavigate?: VaultLinkNavigate;
    onRecreateMissingPage: () => void;
    onReloadPage: () => void;
    onSave: (body: string) => Promise<void>;
    onSelectPage?: (page: { path: string }) => void;
    page: VaultPageDetail | null;
    saveErrorMessage: string | null;
    saveDisabled: boolean;
}) {
    if (!page) {
        return (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                    {isLoading ? 'Loading file...' : 'No memory file selected.'}
                </div>
            </div>
        );
    }

    const draftOwnsTitle = /^#{1,6}\s+/u.test(draft.trimStart());
    const showEditor = editorMode !== 'preview';
    const showPreview = editorMode !== 'edit';

    return (
        <div className="flex h-full min-h-0 flex-col">
            {saveErrorMessage ? (
                <div className="border-border/70 border-b bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                    {saveErrorMessage}
                </div>
            ) : null}
            {externalChangeState === 'changed' ? (
                <div className="flex items-center justify-between gap-3 border-border/70 border-b bg-warning/8 px-4 py-2 text-sm">
                    <span className="min-w-0 text-foreground">This page changed on disk.</span>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button onClick={onReloadPage} size="xs" variant="outline">
                            Reload
                        </Button>
                        <Button onClick={onKeepDraft} size="xs" variant="ghost">
                            Keep draft
                        </Button>
                    </div>
                </div>
            ) : null}
            {externalChangeState === 'missing' ? (
                <div className="flex items-center justify-between gap-3 border-border/70 border-b bg-warning/8 px-4 py-2 text-sm">
                    <span className="min-w-0 text-foreground">This page was removed on disk.</span>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button onClick={onDiscardMissingPage} size="xs" variant="outline">
                            Discard
                        </Button>
                        <Button
                            disabled={isSaving}
                            onClick={onRecreateMissingPage}
                            size="xs"
                            variant="secondary"
                        >
                            Recreate
                        </Button>
                    </div>
                </div>
            ) : null}
            <div className="flex h-full min-h-0 flex-1 overflow-hidden">
                <article
                    className={cn(
                        'grid h-full min-h-0 flex-1 overflow-hidden',
                        editorMode === 'split'
                            ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
                            : 'grid-cols-1'
                    )}
                >
                    {showEditor ? (
                        <section
                            className={cn(
                                'flex h-full min-h-0 overflow-hidden',
                                showPreview && 'border-border/70 border-r'
                            )}
                        >
                            <VaultMarkdownEditor
                                className="h-full min-h-0 flex-1"
                                disabled={isSaving}
                                key={page.path}
                                onChange={onDraftChange}
                                onSave={() => void onSave(draft)}
                                saveDisabled={saveDisabled}
                                value={draft}
                            />
                        </section>
                    ) : null}
                    {showPreview ? (
                        <section
                            className={cn(
                                'h-full min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-12',
                                editorMode === 'preview' && 'mx-auto w-full max-w-4xl px-8 pt-8'
                            )}
                        >
                            <VaultDocumentPreview
                                draft={draft}
                                draftOwnsTitle={draftOwnsTitle}
                                onNavigate={onNavigate}
                                page={page}
                            />
                        </section>
                    ) : null}
                </article>
                <aside
                    aria-label="Page metadata"
                    className={cn(
                        'h-full min-h-0 overflow-hidden border-border/70 border-l bg-sidebar/35 transition-[width,opacity,transform,border-color] duration-200 ease-out',
                        inspectorOpen
                            ? 'w-[320px] translate-x-0 opacity-100'
                            : 'w-0 translate-x-4 border-l-transparent opacity-0'
                    )}
                >
                    {inspectorOpen ? (
                        <div className="h-full w-[320px]">
                            <VaultDocumentInspector onSelectPage={onSelectPage} page={page} />
                        </div>
                    ) : null}
                </aside>
            </div>
        </div>
    );
}
