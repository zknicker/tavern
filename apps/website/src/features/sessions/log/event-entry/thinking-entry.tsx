import * as React from 'react';
import { formatShortTime } from '../../../../lib/format.ts';
import type { SessionHistoryThinkingRowOutput } from '../../../../lib/trpc.tsx';

export function ThinkingLogEntry({ entry }: { entry: SessionHistoryThinkingRowOutput }) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <div className="max-w-xl">
            <button
                aria-expanded={isExpanded}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-500/14 bg-indigo-500/5 px-2.5 py-1 text-left transition-colors hover:bg-indigo-500/10"
                onClick={() => setIsExpanded((value) => !value)}
                type="button"
            >
                <span className="size-1.5 shrink-0 rounded-full bg-indigo-400" />
                <span className="font-medium text-caption text-indigo-400 uppercase tracking-[0.16em]">
                    Thinking
                </span>
                <span className="font-mono text-caption text-muted-foreground/60 tabular-nums">
                    {formatShortTime(entry.timestamp)}
                </span>
                <span className="text-caption text-indigo-400/70">
                    {isExpanded ? 'Hide' : 'Inspect'}
                </span>
            </button>
            {isExpanded ? (
                <div className="mt-2 rounded-md border border-indigo-500/12 bg-indigo-500/4 px-3 py-2">
                    <p className="whitespace-pre-wrap text-foreground/85 text-sm leading-relaxed">
                        {entry.thinking.text}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
