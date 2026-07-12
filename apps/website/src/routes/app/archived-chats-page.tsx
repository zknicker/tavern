import * as React from 'react';
import { ArchivedChats } from '../../features/chats/archived-chats.tsx';
import { ListPageSkeleton } from '../../features/shell/page-skeletons.tsx';

export function ArchivedChatsPage() {
    return (
        <React.Suspense fallback={<ListPageSkeleton />}>
            <ArchivedChats />
        </React.Suspense>
    );
}
