import * as React from 'react';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { trpc } from '../../lib/trpc.tsx';
import type { WikiPageNode } from '../wiki/types.ts';
import { resolveWikiLinkTarget } from '../wiki/utils.ts';
import { WikiPageFileTree } from '../wiki/wiki-page-sidebar-file-tree.tsx';
import { ChatArtifactWikiPage } from './chat-artifact-wiki-page.tsx';
import { WorkspaceArtifactEmpty } from './chat-artifact-workspace-preview.tsx';

export function WikiBrowserContent({
    initialDirectoryPath = '',
}: {
    initialDirectoryPath?: string;
}) {
    const [query, setQuery] = React.useState('');
    const [selectedPage, setSelectedPage] = React.useState<WikiPageNode | null>(null);
    const initialDirectory = normalizeWikiPath(initialDirectoryPath);
    const listQuery = trpc.wiki.list.useQuery();
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
                <ChatArtifactWikiPage
                    emptyDetail={
                        initialDirectory
                            ? `Select a Markdown page from ${initialDirectory}.`
                            : 'Select a Markdown page from the Wiki sidebar.'
                    }
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
                    path={selectedPage?.path ?? null}
                />
            </main>
        </div>
    );
}

function normalizeWikiPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}
