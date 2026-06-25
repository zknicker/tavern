import * as React from 'react';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { useVaultPage } from '../../hooks/vault/use-vault-page.ts';
import { trpc } from '../../lib/trpc.tsx';
import type { VaultPageNode } from '../vault/types.ts';
import { resolveVaultLinkTarget } from '../vault/utils.ts';
import { VaultMarkdownViewer } from '../vault/vault-markdown-viewer.tsx';
import { VaultPageFileTree } from '../vault/vault-page-sidebar-file-tree.tsx';
import { WorkspaceArtifactEmpty } from './chat-artifact-workspace-preview.tsx';

export function VaultBrowserContent({
    initialDirectoryPath = '',
}: {
    initialDirectoryPath?: string;
}) {
    const [query, setQuery] = React.useState('');
    const [selectedPage, setSelectedPage] = React.useState<VaultPageNode | null>(null);
    const initialDirectory = normalizeVaultPath(initialDirectoryPath);
    const listQuery = trpc.vault.list.useQuery();
    const pageQuery = useVaultPage(selectedPage);
    const fileSidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 440,
        minWidth: 220,
        storageKey: 'tavern.artifactPane.vaultSidebar.width',
    });

    React.useEffect(() => {
        setSelectedPage(null);
        setQuery('');
    }, []);

    if (listQuery.isPending) {
        return <WorkspaceArtifactEmpty detail="Loading Vault pages..." title="Vault" />;
    }

    if (listQuery.error) {
        return <WorkspaceArtifactEmpty detail="Unable to browse Vault." title="Vault" />;
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
                    <VaultPageFileTree
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
                <VaultBrowserPreview
                    emptyDetail={
                        initialDirectory
                            ? `Select a Markdown page from ${initialDirectory}.`
                            : 'Select a Markdown page from the Vault sidebar.'
                    }
                    isLoading={pageQuery.isPending && Boolean(selectedPage)}
                    onNavigate={(target) => {
                        if (!(selectedPage && listQuery.data)) {
                            return;
                        }
                        const resolved = resolveVaultLinkTarget(
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

function VaultBrowserPreview({
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
        return <WorkspaceArtifactEmpty detail="Loading Vault page..." title={pagePath} />;
    }

    if (pageBody === null) {
        return <WorkspaceArtifactEmpty detail="Unable to load this Vault page." title={pagePath} />;
    }

    return (
        <ScrollArea className="h-full min-h-0" scrollFade>
            <article className="mx-auto max-w-[42rem] px-7 pt-7 pb-12">
                <VaultMarkdownViewer onNavigate={onNavigate} value={pageBody} />
            </article>
        </ScrollArea>
    );
}

function normalizeVaultPath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}
