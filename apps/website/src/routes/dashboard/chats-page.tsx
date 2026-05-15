import * as React from 'react';
import { NewChat } from '../../features/chats/new-chat.tsx';
import { OverviewPageSkeleton } from '../../features/overview/overview-page-skeleton.tsx';

export function ChatsPage() {
    return (
        <React.Suspense fallback={<OverviewPageSkeleton />}>
            <NewChat />
        </React.Suspense>
    );
}
