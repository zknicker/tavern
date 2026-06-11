import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCortexListSuspense } from '../../hooks/cortex/use-cortex-list.ts';
import { useCortexPage } from '../../hooks/cortex/use-cortex-page.ts';
import { CortexDocumentPane } from './cortex-document-pane.tsx';
import { CortexPageSidebar } from './cortex-page-sidebar.tsx';
import type { CortexPageNode } from './types.ts';
import { pageKey, resolveCortexLinkTarget, resolveSelectedPage } from './utils.ts';

export function Cortex() {
    const [searchParams] = useSearchParams();
    const [selectedPage, setSelectedPage] = React.useState<{ path: string; topic: string } | null>(
        () => {
            const topic = searchParams.get('topic');
            const path = searchParams.get('path');
            return topic && path ? { path, topic } : null;
        }
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

    function handleSelectPage(page: { path: string; topic: string }) {
        setSelectedPage(page);
    }

    function handleNavigate(target: string) {
        if (!pageNode) {
            return;
        }
        const resolved = resolveCortexLinkTarget(list.pages, pageNode, target);
        if (resolved) {
            setSelectedPage({ path: resolved.path, topic: resolved.topic });
        }
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
