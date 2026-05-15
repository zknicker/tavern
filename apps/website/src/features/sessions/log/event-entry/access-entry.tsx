import { formatShortTime } from '../../../../lib/format.ts';
import type { SessionHistoryAccessEventRowOutput } from '../../../../lib/trpc.tsx';

export function AccessEventLogEntry({ entry }: { entry: SessionHistoryAccessEventRowOutput }) {
    return (
        <div className="rounded-md border border-amber-500/12 bg-amber-500/4 px-3 py-1.5">
            <div className="flex items-center gap-2">
                <span className="size-1 shrink-0 rounded-full bg-amber-400" />
                <span className="font-medium text-amber-400 text-xs uppercase tracking-[0.16em]">
                    Access {entry.accessEvent.status}
                </span>
                <span className="font-mono text-muted-foreground/60 text-xs tabular-nums">
                    {formatShortTime(entry.timestamp)}
                </span>
            </div>
            <p className="mt-1 text-foreground/90 text-sm">
                {entry.accessEvent.toolName ?? 'session access'}
                {entry.accessEvent.targetSessionKey
                    ? ` \u2192 ${entry.accessEvent.targetSessionKey}`
                    : null}
            </p>
            {entry.accessEvent.errorMessage ? (
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-amber-300 text-xs">
                    {entry.accessEvent.errorMessage}
                </p>
            ) : null}
        </div>
    );
}
