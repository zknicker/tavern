import type { HugeiconsIconProps } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ReactNode } from 'react';
import { Drawer, DrawerTrigger } from '../../../components/ui/drawer.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolDrawer } from '../../sessions/tools/tool-drawer.tsx';
import { formatToolDuration, hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import type { ToolStepRow } from './types.ts';

type ToolIcon = HugeiconsIconProps['icon'];

export function ToolTimelineStep({
    active = false,
    children,
    icon,
    isLast,
    label,
}: {
    active?: boolean;
    children?: ReactNode;
    icon: ToolIcon;
    isLast: boolean;
    label: ReactNode;
}) {
    return (
        <div
            className={cn(
                'group/tool-step relative z-10 overflow-hidden',
                active &&
                    'motion-safe:animate-[chat-loading-indicator-in_260ms_cubic-bezier(0.23,1,0.32,1)_both]'
            )}
        >
            {isLast ? null : <div className="absolute top-7 bottom-0 left-4 w-px bg-border/60" />}
            <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
                <span className="flex size-4 shrink-0 items-center justify-center">
                    <Icon className="size-4 text-muted-foreground" icon={icon} strokeWidth={1.5} />
                </span>
                <span className="flex min-w-0 flex-1 items-center text-[13px] text-foreground leading-4">
                    {label}
                </span>
            </div>
            {children ? <div className="ml-7">{children}</div> : null}
        </div>
    );
}

export function ToolDrawerTrigger({
    chatId,
    isOpen,
    onOpenChange,
    row,
}: {
    chatId?: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    row: ToolStepRow;
}) {
    const sessionKey = row.sessionKey;
    const label = `Inspect ${row.toolCall.label || row.toolCall.name || 'tool call'}`;

    return (
        <Drawer onOpenChange={onOpenChange} open={isOpen} position="right">
            <DrawerTrigger
                render={
                    <Button
                        aria-label={label}
                        className={cn(
                            'ml-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-focus-within/tool-step:opacity-100 group-hover/tool-step:opacity-100',
                            isOpen && 'opacity-100'
                        )}
                        size="icon-xs"
                        title={label}
                        type="button"
                        variant="ghost"
                    />
                }
            >
                <Icon className="size-3.5" icon={Search01Icon} />
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
        <span className="inline-flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 leading-4">
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
