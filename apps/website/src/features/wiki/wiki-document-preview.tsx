import type { WikiPageDetail } from './types.ts';
import { type WikiLinkNavigate, WikiMarkdownViewer } from './wiki-markdown-viewer.tsx';

export function WikiDocumentPreview({
    draft,
    draftOwnsTitle,
    onNavigate,
    page,
}: {
    draft: string;
    draftOwnsTitle: boolean;
    onNavigate?: WikiLinkNavigate;
    page: WikiPageDetail;
}) {
    return (
        <>
            {draftOwnsTitle ? null : (
                <h2 className="text-pretty font-semibold text-2xl tracking-tight">{page.title}</h2>
            )}
            <DocumentPreviewBody draft={draft} onNavigate={onNavigate} pagePath={page.path} />
        </>
    );
}

function DocumentPreviewBody({
    draft,
    onNavigate,
    pagePath,
}: {
    draft: string;
    onNavigate?: WikiLinkNavigate;
    pagePath: string;
}) {
    return (
        <div className="mt-1">
            <WikiMarkdownViewer onNavigate={onNavigate} pagePath={pagePath} value={draft} />
        </div>
    );
}
