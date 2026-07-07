import * as React from 'react';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { useSemanticMemoryPage } from '../../hooks/semantic-memory/use-semantic-memory-page.ts';
import { trpc } from '../../lib/trpc.tsx';
import { SemanticMemoryMarkdownViewer } from '../memory/semantic/semantic-memory-markdown-viewer.tsx';
import { SemanticMemoryPageFileTree } from '../memory/semantic/semantic-memory-page-sidebar-file-tree.tsx';
import type { SemanticMemoryPageNode } from '../memory/semantic/types.ts';
import { resolveSemanticMemoryLinkTarget } from '../memory/semantic/utils.ts';
import { WorkspaceArtifactEmpty } from './chat-artifact-workspace-preview.tsx';

export function SemanticMemoryBrowserContent({
    initialDirectoryPath = '',
}: {
    initialDirectoryPath?: string;
}) {
    const [query, setQuery] = React.useState('');
    const [selectedPage, setSelectedPage] = React.useState<SemanticMemoryPageNode | null>(null);
    const initialDirectory = normalizeMemoryPath(initialDirectoryPath);
    const listQuery = trpc.semanticMemory.list.useQuery();
    const pageQuery = useSemanticMemoryPage(selectedPage);
    const fileSidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 440,
        minWidth: 220,
        storageKey: 'tavern.artifactPane.semanticMemorySidebar.width',
    });

    React.useEffect(() => {
        setSelectedPage(null);
        setQuery('');
    }, []);

    if (listQuery.isPending) {
        return <WorkspaceArtifactEmpty detail="Loading Memory pages..." title="Memory" />;
    }

    if (listQuery.error) {
        return <WorkspaceArtifactEmpty detail="Unable to browse Memory." title="Memory" />;
    }

    return (
        <div
            className="grid h-full min-h-0 overflow-hidden bg-background"
            style={{ gridTemplateColumns: `${fileSidebarWidth.width}px minmax(0, 1fr)` }}
        >
            <aside className="relative flex min-h-0 flex-col border-border/70 border-r bg-sidebar/35">
                <ResizablePaneRail
                    maxWidth={440}
                    minWidth={220}
                    onWidthChange={fileSidebarWidth.setWidth}
                    onWidthCommit={fileSidebarWidth.persistWidth}
                    side="right"
                    width={fileSidebarWidth.width}
                />
                <div className="shrink-0 border-border/70 border-b p-2">
                    <SearchInput
                        className="w-full"
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Search pages"
                        size="default"
                        value={query}
                    />
                </div>
                <div className="min-h-0 flex-1 px-1 py-2">
                    <SemanticMemoryPageFileTree
                        folders={listQuery.data.folders}
                        onSelect={setSelectedPage}
                        pages={listQuery.data.pages}
                        query={query}
                        readOnly
                        selectedPageKey={selectedPage?.path ?? null}
                    />
                </div>
            </aside>
            <section className="flex min-h-0 min-w-0 flex-col">
                <SemanticMemoryBrowserPreview
                    emptyDetail={
                        initialDirectory
                            ? `Select a Markdown page from ${initialDirectory}.`
                            : 'Select a Markdown page from the Memory sidebar.'
                    }
                    isLoading={pageQuery.isPending && Boolean(selectedPage)}
                    onNavigate={(target) => {
                        if (!(selectedPage && listQuery.data)) {
                            return;
                        }
                        const resolved = resolveSemanticMemoryLinkTarget(
                            listQuery.data.pages,
                            selectedPage,
                            target
                        );
                        if (resolved) {
                            setSelectedPage(resolved);
                        }
                    }}
                    pageBody={pageQuery.data?.body ?? null}
                    pagePath={selectedPage?.path ?? null}
                />
            </section>
        </div>
    );
}

function SemanticMemoryBrowserPreview({
    emptyDetail,
    isLoading,
    onNavigate,
    pageBody,
    pagePath,
}: {
    emptyDetail: string;
    isLoading: boolean;
    onNavigate: (target: string) => void;
    pageBody: null | string;
    pagePath: null | string;
}) {
    if (!pagePath) {
        return <WorkspaceArtifactEmpty detail={emptyDetail} title="No page selected" />;
    }

    if (isLoading) {
        return <WorkspaceArtifactEmpty detail="Loading Memory page..." title={pagePath} />;
    }

    if (pageBody === null) {
        return (
            <WorkspaceArtifactEmpty detail="Unable to load this Memory page." title={pagePath} />
        );
    }

    return (
        <ScrollArea className="h-full min-h-0" scrollFade>
            <article className="mx-auto max-w-[42rem] px-7 pt-7 pb-12">
                <SemanticMemoryMarkdownViewer onNavigate={onNavigate} value={pageBody} />
            </article>
        </ScrollArea>
    );
}

function normalizeMemoryPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}
