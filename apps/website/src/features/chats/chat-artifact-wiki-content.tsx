import * as React from 'react';
import { SelectionQuoteContainer } from '../../components/quote/selection-quote.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { useWikiPage } from '../../hooks/wiki/use-wiki-page.ts';
import { trpc } from '../../lib/trpc.tsx';
import type { WikiPageNode } from '../wiki/types.ts';
import { resolveWikiLinkTarget } from '../wiki/utils.ts';
import { WikiMarkdownViewer } from '../wiki/wiki-markdown-viewer.tsx';
import { WikiPageFileTree } from '../wiki/wiki-page-sidebar-file-tree.tsx';
import { WorkspaceArtifactEmpty } from './chat-artifact-workspace-preview.tsx';
import { formatTavernResourceLink } from './tavern-resource-link.ts';

export function WikiBrowserContent({
    initialDirectoryPath = '',
}: {
    initialDirectoryPath?: string;
}) {
    const [query, setQuery] = React.useState('');
    const [selectedPage, setSelectedPage] = React.useState<WikiPageNode | null>(null);
    const initialDirectory = normalizeWikiPath(initialDirectoryPath);
    const listQuery = trpc.wiki.list.useQuery();
    const pageQuery = useWikiPage(selectedPage);
    const fileSidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 440,
        minWidth: 220,
        storageKey: 'tavern.artifactPane.wikiSidebar.width',
    });

    React.useEffect(() => {
        setSelectedPage(null);
        setQuery('');
    }, []);

    if (listQuery.isPending) {
        return <WorkspaceArtifactEmpty detail="Loading Wiki pages..." title="Wiki" />;
    }

    if (listQuery.error) {
        return <WorkspaceArtifactEmpty detail="Unable to browse Wiki." title="Wiki" />;
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
                        size="sm"
                        value={query}
                    />
                </div>
                <div className="min-h-0 flex-1 px-1 py-2">
                    <WikiPageFileTree
                        folders={listQuery.data.folders}
                        onSelect={setSelectedPage}
                        pages={listQuery.data.pages}
                        query={query}
                        readOnly
                        selectedPageKey={selectedPage?.path ?? null}
                    />
                </div>
            </aside>
            <main className="flex min-h-0 min-w-0 flex-col">
                <WikiBrowserPreview
                    emptyDetail={
                        initialDirectory
                            ? `Select a Markdown page from ${initialDirectory}.`
                            : 'Select a Markdown page from the Wiki sidebar.'
                    }
                    isLoading={pageQuery.isPending && Boolean(selectedPage)}
                    onNavigate={(target) => {
                        if (!(selectedPage && listQuery.data)) {
                            return;
                        }
                        const resolved = resolveWikiLinkTarget(
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
            </main>
        </div>
    );
}

function WikiBrowserPreview({
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
        return <WorkspaceArtifactEmpty detail="Loading Wiki page..." title={pagePath} />;
    }

    if (pageBody === null) {
        return <WorkspaceArtifactEmpty detail="Unable to load this Wiki page." title={pagePath} />;
    }

    return (
        <ScrollArea className="h-full min-h-0" scrollFade>
            <SelectionQuoteContainer
                source={{
                    href: formatTavernResourceLink({ kind: 'wikiPage', path: pagePath }),
                    label: pagePath,
                }}
            >
                <article className="mx-auto max-w-[42rem] px-7 pt-7 pb-12">
                    <WikiMarkdownViewer onNavigate={onNavigate} value={pageBody} />
                </article>
            </SelectionQuoteContainer>
        </ScrollArea>
    );
}

function normalizeWikiPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}
