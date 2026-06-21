import type { HugeiconsIconProps } from '@hugeicons/react';
import type { ReactNode } from 'react';
import * as React from 'react';
import { Drawer, DrawerTrigger } from '../../../components/ui/drawer.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolDrawer } from '../../sessions/tools/tool-drawer.tsx';
import { formatToolDuration, hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { useToolRowHoverItem } from '../tool-row-hover.ts';
import type { ToolStepRow } from './types.ts';

type ToolIcon = HugeiconsIconProps['icon'];
const inlineToolTargetMaxLength = 96;

export function ToolTimelineStep({
    animateEnter = false,
    chatId,
    children,
    icon,
    index,
    isLast,
    label,
    row,
}: {
    animateEnter?: boolean;
    chatId?: string;
    children?: ReactNode;
    icon: ToolIcon;
    index: number;
    isLast: boolean;
    label: ReactNode;
    row: ToolStepRow;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const sessionKey = row.sessionKey;
    const inspectLabel = `Inspect ${row.toolCall.label || row.toolCall.name || 'tool call'}`;
    const hoverItem = useToolRowHoverItem(index + 1);

    return (
        <div
            className={cn(
                'group/tool-step relative z-10 overflow-hidden',
                animateEnter && 'chat-step-enter'
            )}
            data-tool-row-hover-index={hoverItem.dataIndex}
        >
            {isLast ? null : <div className="absolute top-7 bottom-0 left-4 w-px bg-border/60" />}
            <Drawer onOpenChange={setIsOpen} open={isOpen} position="right">
                <DrawerTrigger
                    render={
                        <button
                            aria-label={inspectLabel}
                            className={cn(
                                'flex w-full min-w-0 cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-3 text-left text-muted-foreground outline-none transition-none focus-visible:bg-surface-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                !hoverItem.hasSharedHover && 'hover:bg-surface-1'
                            )}
                            ref={hoverItem.ref}
                            title={inspectLabel}
                            type="button"
                        />
                    }
                >
                    <span className="-ml-1 flex size-4 shrink-0 items-center justify-center">
                        <Icon
                            className="size-4 text-muted-foreground/75"
                            icon={icon}
                            strokeWidth={1.5}
                        />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center text-sm leading-5">
                        {label}
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
    const visibleTarget = formatInlineToolTarget(target);

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
                {visibleTarget}
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

function formatInlineToolTarget(target: string) {
    if (target.length <= inlineToolTargetMaxLength) {
        return target;
    }

    return `${target.slice(0, inlineToolTargetMaxLength - 3).trimEnd()}...`;
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
