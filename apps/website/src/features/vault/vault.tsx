import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVaultListSuspense } from '../../hooks/vault/use-vault-list.ts';
import { useVaultPage } from '../../hooks/vault/use-vault-page.ts';
import type { VaultPageNode } from './types.ts';
import { pageKey, resolveSelectedPage, resolveVaultLinkTarget } from './utils.ts';
import { VaultDocumentPane } from './vault-document-pane.tsx';
import { VaultPageSidebar } from './vault-page-sidebar.tsx';

export function Vault() {
    const [searchParams] = useSearchParams();
    const [selectedPage, setSelectedPage] = React.useState<{ path: string } | null>(() => {
        const path = searchParams.get('path');
        return path ? { path } : null;
    });
    const [list] = useVaultListSuspense();
    const pageNode = resolveSelectedPage(list, selectedPage);
    const pageDetailQuery = useVaultPage(pageNode ? { path: pageNode.path } : null);

    React.useEffect(() => {
        if (pageNode && (!selectedPage || pageNode.path !== selectedPage.path)) {
            setSelectedPage({ path: pageNode.path });
        }
        if (!pageNode && selectedPage) {
            setSelectedPage(null);
        }
    }, [pageNode, selectedPage]);

    function handleSelect(page: VaultPageNode) {
        setSelectedPage({ path: page.path });
    }

    function handleSelectPage(page: { path: string }) {
        setSelectedPage(page);
    }

    function handleNavigate(target: string) {
        if (!pageNode) {
            return;
        }
        const resolved = resolveVaultLinkTarget(list.pages, pageNode, target);
        if (resolved) {
            setSelectedPage({ path: resolved.path });
        }
    }

    return (
        <div className="grid min-h-0 flex-1 bg-background">
            <div className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)] overflow-hidden">
                <VaultPageSidebar
                    onSelect={handleSelect}
                    pages={list.pages}
                    selectedPageKey={pageNode ? pageKey(pageNode) : null}
                />
                <main className="min-h-0 overflow-hidden">
                    <div className="h-full min-h-0">
                        <VaultDocumentPane
                            isLoading={pageDetailQuery.isFetching}
                            onNavigate={handleNavigate}
                            onSelectPage={handleSelectPage}
                            page={pageDetailQuery.data ?? null}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}
