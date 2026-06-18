import type { IconSvgElement } from '@hugeicons/react';
import {
    BookOpenTextIcon,
    EyeIcon,
    FileEditIcon,
    InputLongTextIcon,
    LayoutTwoColumnIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { TabItem, Tabs, TabsList } from '../../components/ui/tabs.tsx';
import { Tooltip } from '../../components/ui/tooltip.tsx';
import { cn } from '../../lib/utils.ts';
import type { VaultPageDetail } from './types.ts';
import { VaultDocumentInspector } from './vault-document-inspector.tsx';
import { VaultDocumentPreview } from './vault-document-preview.tsx';
import { VaultMarkdownEditor } from './vault-markdown-editor.tsx';
import type { VaultLinkNavigate } from './vault-markdown-viewer.tsx';

type VaultEditorMode = 'edit' | 'preview' | 'split';

export function VaultDocumentPane({
    isLoading,
    isSaving,
    onNavigate,
    onSave,
    onSelectPage,
    page,
    saveErrorMessage,
}: {
    isLoading: boolean;
    isSaving: boolean;
    onNavigate?: VaultLinkNavigate;
    onSave: (body: string) => Promise<void>;
    onSelectPage?: (page: { path: string }) => void;
    page: VaultPageDetail | null;
    saveErrorMessage: string | null;
}) {
    const [draft, setDraft] = React.useState('');
    const [editorMode, setEditorMode] = React.useState<VaultEditorMode>('edit');
    const [inspectorOpen, setInspectorOpen] = React.useState(false);
    const pagePath = page?.path ?? '';

    React.useEffect(() => {
        setDraft(pagePath ? (page?.body ?? '') : '');
    }, [page?.body, pagePath]);

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
    const isDirty = draft !== page.body;
    const showEditor = editorMode !== 'preview';
    const showPreview = editorMode !== 'edit';
    const canSave = isDirty && !isSaving;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex h-12 shrink-0 items-center justify-end gap-3 border-border/70 border-b px-4">
                <Tabs
                    onValueChange={(value) => setEditorMode(value as VaultEditorMode)}
                    value={editorMode}
                >
                    <TabsList>
                        <TabItem icon={InputLongTextIcon} iconOnly label="Edit" value="edit" />
                        <TabItem icon={LayoutTwoColumnIcon} iconOnly label="Split" value="split" />
                        <TabItem icon={EyeIcon} iconOnly label="Preview" value="preview" />
                    </TabsList>
                </Tabs>
                <ModeButton
                    active={inspectorOpen}
                    icon={BookOpenTextIcon}
                    label="Metadata"
                    onClick={() => setInspectorOpen((open) => !open)}
                />
                <Button
                    disabled={!canSave}
                    loading={isSaving}
                    onClick={() => void onSave(draft)}
                    size="sm"
                    variant={isDirty ? 'default' : 'secondary'}
                >
                    <Icon icon={FileEditIcon} />
                    Save
                </Button>
            </header>
            {saveErrorMessage ? (
                <div className="border-border/70 border-b bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                    {saveErrorMessage}
                </div>
            ) : null}
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <article
                    className={cn(
                        'grid min-h-0 flex-1 overflow-hidden',
                        editorMode === 'split'
                            ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
                            : 'grid-cols-1'
                    )}
                >
                    {showEditor ? (
                        <section
                            className={cn(
                                'min-h-0 overflow-hidden',
                                showPreview && 'border-border/70 border-r'
                            )}
                        >
                            <VaultMarkdownEditor
                                className="h-full"
                                disabled={isSaving}
                                onChange={setDraft}
                                onSave={() => void onSave(draft)}
                                saveDisabled={!canSave}
                                value={draft}
                            />
                        </section>
                    ) : null}
                    {showPreview ? (
                        <section
                            className={cn(
                                'min-h-0 overflow-auto px-6 pt-6 pb-10',
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
                        'min-h-0 overflow-hidden border-border/70 border-l bg-sidebar/35 transition-[width,opacity,transform,border-color] duration-200 ease-out',
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

function ModeButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: IconSvgElement;
    label: string;
    onClick: () => void;
}) {
    return (
        <Tooltip content={label}>
            <Button
                aria-label={label}
                onClick={onClick}
                size="icon-sm"
                variant={active ? 'secondary' : 'ghost'}
            >
                <Icon icon={icon} />
            </Button>
        </Tooltip>
    );
}
