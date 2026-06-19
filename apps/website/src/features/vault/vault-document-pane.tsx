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
    inspectorOpen,
    isLoading,
    isSaving,
    onDraftChange,
    onNavigate,
    onSave,
    onSelectPage,
    page,
    saveErrorMessage,
    saveDisabled,
}: {
    draft: string;
    editorMode: VaultEditorMode;
    inspectorOpen: boolean;
    isLoading: boolean;
    isSaving: boolean;
    onDraftChange: (draft: string) => void;
    onNavigate?: VaultLinkNavigate;
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
                    {isLoading ? 'Loading page...' : 'No Vault page selected.'}
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
                                'h-full min-h-0 overflow-hidden',
                                showPreview && 'border-border/70 border-r'
                            )}
                        >
                            <VaultMarkdownEditor
                                className="h-full"
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
                                'h-full min-h-0 overflow-auto px-6 pt-6 pb-10',
                                editorMode === 'preview' && 'mx-auto w-full max-w-4xl px-8'
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
