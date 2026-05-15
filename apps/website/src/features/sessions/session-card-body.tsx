import type React from 'react';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import type { SessionHistoryOutput } from '../../lib/trpc.tsx';
import { SessionLog } from './session-log.tsx';

interface SessionCardBodyProps {
    currentSessionKey: string;
    error: boolean;
    isPending: boolean;
    rows: SessionHistoryOutput['rows'];
    totalRows: number;
}

export function SessionCardBody({
    currentSessionKey,
    rows,
    error,
    isPending,
    totalRows,
}: SessionCardBodyProps) {
    let bodyContent: React.ReactNode;

    if (isPending) {
        bodyContent = (
            <div className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[84%]" />
            </div>
        );
    } else if (error) {
        bodyContent = (
            <div className="px-4 py-3">
                <p className="text-muted-foreground text-sm">Unable to load session transcript.</p>
            </div>
        );
    } else if (rows.length === 0) {
        bodyContent = (
            <div className="px-4 py-3">
                <p className="text-muted-foreground/60 text-sm">No synced messages yet.</p>
            </div>
        );
    } else {
        bodyContent = (
            <SessionLog currentSessionKey={currentSessionKey} rows={rows} totalRows={totalRows} />
        );
    }

    return <ScrollArea className="min-h-0 flex-1 touch-auto">{bodyContent}</ScrollArea>;
}
