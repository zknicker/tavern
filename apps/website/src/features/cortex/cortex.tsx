import * as React from 'react';
import { useCortexListSuspense } from '../../hooks/cortex/use-cortex-list.ts';
import { useCortexPage } from '../../hooks/cortex/use-cortex-page.ts';
import { CortexDocumentPane } from './cortex-document-pane.tsx';
import { CortexPageSidebar } from './cortex-page-sidebar.tsx';
import type { CortexPageNode } from './types.ts';
import { pageKey, resolveSelectedPage } from './utils.ts';

export function Cortex() {
    const [selectedPage, setSelectedPage] = React.useState<{ path: string; topic: string } | null>(
        null
    );
    const [list] = useCortexListSuspense();
    const pageNode = resolveSelectedPage(list, selectedPage);
    const pageDetailQuery = useCortexPage(
        pageNode ? { path: pageNode.path, topic: pageNode.topic } : null
    );

    React.useEffect(() => {
        if (
            pageNode &&
            (!selectedPage ||
                pageNode.path !== selectedPage.path ||
                pageNode.topic !== selectedPage.topic)
        ) {
            setSelectedPage({ path: pageNode.path, topic: pageNode.topic });
        }
        if (!pageNode && selectedPage) {
            setSelectedPage(null);
        }
    }, [pageNode, selectedPage]);

    function handleSelect(page: CortexPageNode) {
        setSelectedPage({ path: page.path, topic: page.topic });
    }

    return (
        <div className="grid min-h-0 flex-1 bg-background">
            <div className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)] overflow-hidden">
                <CortexPageSidebar
                    onSelect={handleSelect}
                    pages={list.pages}
                    selectedPageKey={pageNode ? pageKey(pageNode) : null}
                />
                <main className="min-h-0 overflow-hidden">
                    <div className="h-full min-h-0">
                        <CortexDocumentPane
                            isLoading={pageDetailQuery.isFetching}
                            page={pageDetailQuery.data ?? null}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}
