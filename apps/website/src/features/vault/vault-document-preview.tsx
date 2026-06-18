import type { VaultPageDetail } from './types.ts';
import { type VaultLinkNavigate, VaultMarkdownViewer } from './vault-markdown-viewer.tsx';

export function VaultDocumentPreview({
    draft,
    draftOwnsTitle,
    onNavigate,
    page,
}: {
    draft: string;
    draftOwnsTitle: boolean;
    onNavigate?: VaultLinkNavigate;
    page: VaultPageDetail;
}) {
    return (
        <>
            {draftOwnsTitle ? null : (
                <h2 className="text-pretty font-semibold text-2xl tracking-tight">{page.title}</h2>
            )}
            <DocumentPreviewBody draft={draft} onNavigate={onNavigate} />
        </>
    );
}

function DocumentPreviewBody({
    draft,
    onNavigate,
}: {
    draft: string;
    onNavigate?: VaultLinkNavigate;
}) {
    return (
        <div className="mt-1">
            <VaultMarkdownViewer onNavigate={onNavigate} value={draft} />
        </div>
    );
}
