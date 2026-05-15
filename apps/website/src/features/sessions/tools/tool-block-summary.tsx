import { Badge } from '../../../components/ui/badge.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import type { SessionHistoryToolCallOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import {
    formatToolDuration,
    formatToolStatusLabel,
    hasErrorStatus,
    isActiveToolStatus,
    shouldShowToolStatusBadge,
    toolStatusBadgeVariant,
} from './tool-ui.ts';

interface ToolBlockSummaryProps {
    completedAt: string | null;
    startedAt: string | null;
    toolCall: SessionHistoryToolCallOutput;
}

export function ToolBlockSummary({ completedAt, startedAt, toolCall }: ToolBlockSummaryProps) {
    const hasError = hasErrorStatus(toolCall.status);
    const duration = formatToolDuration(startedAt, completedAt);
    const isRunning =
        !completedAt &&
        (isActiveToolStatus(toolCall.status) || Boolean(startedAt && !toolCall.status));
    const showStatusBadge = shouldShowToolStatusBadge({
        completedAt,
        status: toolCall.status,
    });
    const seenSummaryParts = new Map<string, number>();
    const keyedSummaryParts = toolCall.summaryParts.map((part) => {
        const count = (seenSummaryParts.get(part) ?? 0) + 1;
        seenSummaryParts.set(part, count);
        return { key: `${part}-${count}`, part };
    });

    return (
        <>
            {isRunning ? (
                <Spinner className="size-3.5 shrink-0 text-success" />
            ) : (
                <span
                    className={cn(
                        'size-2 shrink-0 rounded-full',
                        hasError ? 'bg-destructive' : 'bg-success'
                    )}
                />
            )}
            <span
                className={cn(
                    'min-w-0 max-w-48 shrink-0 truncate font-medium text-sm',
                    hasError ? 'text-red-400' : 'text-foreground/90'
                )}
            >
                {toolCall.name}
            </span>
            {toolCall.summaryParts.length > 0 ? (
                <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {keyedSummaryParts.map(({ key, part }) => (
                        <span
                            className="min-w-0 max-w-[10rem] truncate rounded-md border border-border/50 bg-muted/25 px-1.5 py-0.5 text-muted-foreground text-xs"
                            key={key}
                        >
                            {part}
                        </span>
                    ))}
                </span>
            ) : toolCall.label ? (
                <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                    {toolCall.label}
                </span>
            ) : (
                <span className="min-w-0 flex-1" />
            )}
            {showStatusBadge && toolCall.status ? (
                <Badge variant={toolStatusBadgeVariant(toolCall.status)}>
                    {formatToolStatusLabel(toolCall.status)}
                </Badge>
            ) : isRunning ? (
                <Badge variant="secondary">Running</Badge>
            ) : null}
            {duration ? (
                <span className="shrink-0 font-mono text-muted-foreground/70 text-xs tabular-nums">
                    {duration}
                </span>
            ) : null}
        </>
    );
}
