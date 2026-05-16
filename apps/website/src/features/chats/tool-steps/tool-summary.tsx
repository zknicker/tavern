import type { ReactNode } from 'react';
import { Drawer, DrawerTrigger } from '../../../components/ui/drawer.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolDrawer } from '../../sessions/tools/tool-drawer.tsx';
import { formatToolDuration, hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import type { ToolStepRow } from './types.ts';

export function ToolDrawerLabel({
    children,
    isOpen,
    onOpenChange,
    row,
}: {
    children: ReactNode;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    row: ToolStepRow;
}) {
    const toolCallId = row.toolCall.callId;
    const sessionKey = row.sessionKey;

    if (!(toolCallId && sessionKey)) {
        return children;
    }

    return (
        <Drawer onOpenChange={onOpenChange} open={isOpen} position="right">
            <DrawerTrigger
                render={
                    <button
                        className="inline-flex min-w-0 max-w-full items-baseline gap-1.5 text-left hover:text-foreground"
                        type="button"
                    />
                }
            >
                {children}
            </DrawerTrigger>
            <ToolDrawer
                completedAt={row.completedAt}
                isOpen={isOpen}
                sessionKey={sessionKey}
                startedAt={row.startedAt}
                toolCall={row.toolCall}
                toolCallId={toolCallId}
            />
        </Drawer>
    );
}

export function InlineToolLabel({
    target,
    verb,
    row,
}: {
    row: ToolStepRow;
    target: string;
    verb: string;
}) {
    const duration = formatToolDuration(row.startedAt, row.completedAt);

    return (
        <span className="inline-flex min-w-0 max-w-full flex-nowrap items-baseline gap-1.5">
            <span className={cn('shrink-0 font-medium', getInlineToolVerbClassName(row))}>
                {verb}
            </span>
            <span className="truncate text-muted-foreground">{target}</span>
            {duration ? (
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                    {duration}
                </span>
            ) : null}
        </span>
    );
}

export function getInlineToolVerbClassName(row: ToolStepRow) {
    if (hasErrorStatus(row.toolCall.status)) {
        return 'text-destructive';
    }

    if (!row.completedAt) {
        return 'text-muted-foreground/70';
    }

    return 'text-success';
}

export function getToolTarget(row: ToolStepRow) {
    return row.toolCall.summaryParts.join(' ') || row.toolCall.label || row.toolCall.name || 'tool';
}

export function getToolFact(row: ToolStepRow, label: string) {
    return (
        row.toolCall.facts.find((fact) => fact.label.toLowerCase() === label.toLowerCase())
            ?.value ?? null
    );
}
