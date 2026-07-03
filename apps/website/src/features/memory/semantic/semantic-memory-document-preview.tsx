import {
    type SemanticMemoryLinkNavigate,
    SemanticMemoryMarkdownViewer,
} from './semantic-memory-markdown-viewer.tsx';
import type { SemanticMemoryPageDetail } from './types.ts';

export function SemanticMemoryDocumentPreview({
    draft,
    draftOwnsTitle,
    onNavigate,
    page,
}: {
    draft: string;
    draftOwnsTitle: boolean;
    onNavigate?: SemanticMemoryLinkNavigate;
    page: SemanticMemoryPageDetail;
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
    onNavigate?: SemanticMemoryLinkNavigate;
}) {
    return (
        <div className="mt-1">
            <SemanticMemoryMarkdownViewer onNavigate={onNavigate} value={draft} />
        </div>
    );
}
