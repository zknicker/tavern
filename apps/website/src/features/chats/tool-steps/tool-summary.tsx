import type { HugeiconsIconProps } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ReactNode } from 'react';
import * as React from 'react';
import { Drawer, DrawerTrigger } from '../../../components/ui/drawer.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolDrawer } from '../../sessions/tools/tool-drawer.tsx';
import { formatToolDuration, hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import type { ToolStepRow } from './types.ts';

type ToolIcon = HugeiconsIconProps['icon'];

export function ToolTimelineStep({
    animateEnter = false,
    chatId,
    children,
    icon,
    isLast,
    label,
    row,
}: {
    animateEnter?: boolean;
    chatId?: string;
    children?: ReactNode;
    icon: ToolIcon;
    isLast: boolean;
    label: ReactNode;
    row: ToolStepRow;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const sessionKey = row.sessionKey;
    const inspectLabel = `Inspect ${row.toolCall.label || row.toolCall.name || 'tool call'}`;

    return (
        <div
            className={cn(
                'group/tool-step relative z-10 overflow-hidden',
                animateEnter && 'chat-step-enter'
            )}
        >
            {isLast ? null : <div className="absolute top-7 bottom-0 left-4 w-px bg-border/60" />}
            <Drawer onOpenChange={setIsOpen} open={isOpen} position="right">
                <DrawerTrigger
                    render={
                        <button
                            aria-label={inspectLabel}
                            className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            title={inspectLabel}
                            type="button"
                        />
                    }
                >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                        <Icon
                            className="size-4 text-muted-foreground"
                            icon={icon}
                            strokeWidth={1.5}
                        />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center text-[13px] text-foreground leading-4">
                        {label}
                    </span>
                    <span
                        aria-hidden
                        className={cn(
                            // Reveal on hover, on keyboard focus (focus-visible,
                            // not focus-within — the latter sticks after the
                            // drawer returns focus to the trigger on close), and
                            // while the drawer is open.
                            'ml-0.5 flex shrink-0 items-center text-muted-foreground opacity-0 transition-opacity group-hover/tool-step:opacity-100 group-has-focus-visible/tool-step:opacity-100',
                            isOpen && 'opacity-100'
                        )}
                    >
                        <Icon className="size-3.5" icon={Search01Icon} />
                    </span>
                </DrawerTrigger>
                {chatId ? (
                    <ToolDrawer activityId={row.id} chatId={chatId} isOpen={isOpen} source="chat" />
                ) : sessionKey && row.toolCall.callId ? (
                    <ToolDrawer
                        isOpen={isOpen}
                        sessionKey={sessionKey}
                        source="session"
                        toolCallId={row.toolCall.callId}
                    />
                ) : null}
            </Drawer>
            {children ? <div className="ml-7">{children}</div> : null}
        </div>
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
    const isRunning = isRunningToolRow(row);

    return (
        <span
            className={cn(
                'inline-flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 leading-4',
                isRunning && 'thinking-indicator-text'
            )}
        >
            <span
                className={cn(
                    'shrink-0 font-medium',
                    isRunning ? null : getInlineToolVerbClassName(row)
                )}
            >
                {verb}
            </span>
            <span className={cn('truncate', isRunning ? null : 'text-muted-foreground')}>
                {target}
            </span>
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

    return 'text-muted-foreground';
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

function isRunningToolRow(row: ToolStepRow) {
    return !(row.completedAt || hasErrorStatus(row.toolCall.status));
}
