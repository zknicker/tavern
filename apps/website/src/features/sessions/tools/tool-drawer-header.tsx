import { Badge } from '../../../components/ui/badge.tsx';
import { DrawerHeader, DrawerTitle } from '../../../components/ui/drawer.tsx';
import { formatTimestamp } from '../../../lib/format.ts';
import type { SessionHistoryToolCallOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolCallMetaRow } from './tool-call-detail-section.tsx';
import {
    formatToolDuration,
    formatToolStatusLabel,
    hasErrorStatus,
    shouldShowToolStatusBadge,
    toolStatusBadgeVariant,
} from './tool-ui.ts';

interface ToolDrawerHeaderProps {
    completedAt: string | null;
    startedAt: string | null;
    toolCall: SessionHistoryToolCallOutput;
}

export function ToolDrawerHeader({ completedAt, startedAt, toolCall }: ToolDrawerHeaderProps) {
    const duration = formatToolDuration(startedAt, completedAt);
    const hasError = hasErrorStatus(toolCall.status);
    const showStatusBadge = shouldShowToolStatusBadge({
        completedAt,
        status: toolCall.status,
    });

    return (
        <DrawerHeader className="gap-4">
            <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/40">
                    <span className="font-mono font-semibold text-muted-foreground text-xs">
                        fn
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <DrawerTitle className="truncate">{toolCall.name}</DrawerTitle>
                        {showStatusBadge && toolCall.status ? (
                            <Badge variant={toolStatusBadgeVariant(toolCall.status)}>
                                {formatToolStatusLabel(toolCall.status)}
                            </Badge>
                        ) : null}
                    </div>
                    {duration ? (
                        <p className="mt-0.5 font-mono text-muted-foreground text-sm tabular-nums">
                            {duration}
                        </p>
                    ) : null}
                </div>
            </div>

            {toolCall.label ? (
                <div
                    className={cn(
                        'rounded-md border px-3 py-2',
                        hasError ? 'border-red-500/15 bg-red-500/5' : 'border-border/30 bg-muted/15'
                    )}
                >
                    <code
                        className={cn(
                            'break-all font-mono text-sm leading-relaxed',
                            hasError ? 'text-red-300' : 'text-foreground/90'
                        )}
                    >
                        {toolCall.label}
                    </code>
                </div>
            ) : null}

            {startedAt || completedAt ? (
                <div className="flex flex-col gap-1 rounded-md border border-border/30 bg-muted/10 px-3 py-2.5">
                    {startedAt ? (
                        <ToolCallMetaRow label="Started" value={formatTimestamp(startedAt)} />
                    ) : null}
                    {completedAt ? (
                        <ToolCallMetaRow label="Completed" value={formatTimestamp(completedAt)} />
                    ) : null}
                </div>
            ) : null}
        </DrawerHeader>
    );
}
