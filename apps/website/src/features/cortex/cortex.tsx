import * as React from 'react';
import { useCortexListSuspense } from '../../hooks/cortex/use-cortex-list.ts';
import { useCortexPage } from '../../hooks/cortex/use-cortex-page.ts';
import { CortexDocumentPane } from './cortex-document-pane.tsx';
import { CortexPageSidebar } from './cortex-page-sidebar.tsx';
import { resolveSelectedPage } from './utils.ts';

export function Cortex() {
    const [list] = useCortexListSuspense();
    const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
    const selectedPage = resolveSelectedPage(list, selectedSlug);
    const pageDetailQuery = useCortexPage(selectedPage?.slug ?? null);

    React.useEffect(() => {
        if (!(selectedPage && selectedSlug)) {
            setSelectedSlug(selectedPage?.slug ?? null);
        }
    }, [selectedPage, selectedSlug]);

    return (
        <div className="grid min-h-0 flex-1 bg-background">
            <div className="grid min-h-0 grid-cols-[260px_minmax(0,1fr)] overflow-hidden">
                <CortexPageSidebar
                    onSelect={setSelectedSlug}
                    pages={list.pages}
                    selectedSlug={selectedPage?.slug ?? null}
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
