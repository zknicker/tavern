import { ArrowUp02Icon, PencilEdit02Icon, Trash2 } from '@hugeicons/core-free-icons';
import type * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.tsx';
import { cn } from '../../lib/utils.ts';
import type { ChatComposerQueuedMessage } from './chat-composer-queue.ts';

export function ChatComposerQueuePanel({
    className,
    isBlocked,
    onEdit,
    onMove,
    onPromote,
    onRemove,
    queue,
}: {
    className?: string;
    isBlocked: boolean;
    onEdit: (id: string) => void;
    onMove: (id: string, direction: 'down' | 'up') => void;
    onPromote: (id: string) => void;
    onRemove: (id: string) => void;
    queue: readonly ChatComposerQueuedMessage[];
}) {
    if (queue.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'mb-1 space-y-1 rounded-2xl border border-border/70 bg-muted/40 px-2 py-1.5',
                className
            )}
        >
            <div className="px-1 font-medium text-muted-foreground text-xs">
                Queued {queue.length}
            </div>
            {queue.map((entry, index) => (
                <div
                    className="group flex min-h-8 items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-background/55"
                    key={entry.id}
                >
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-foreground/90 text-sm">
                            {entry.content || attachmentSummary(entry.attachments) || 'Attachment'}
                        </div>
                        {(entry.attachments?.length ?? 0) > 0 || entry.modelRef ? (
                            <div className="truncate text-muted-foreground text-xs">
                                {[attachmentSummary(entry.attachments), entry.modelRef]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </div>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <QueueIconButton
                            disabled={index === 0}
                            label="Move queued message up"
                            onClick={() => onMove(entry.id, 'up')}
                        >
                            <Icon className="size-4" icon={ArrowUp02Icon} />
                        </QueueIconButton>
                        <QueueIconButton
                            disabled={index === queue.length - 1}
                            label="Move queued message down"
                            onClick={() => onMove(entry.id, 'down')}
                        >
                            <Icon className="size-4 rotate-180" icon={ArrowUp02Icon} />
                        </QueueIconButton>
                        <QueueIconButton
                            label={isBlocked ? 'Send next' : 'Send now'}
                            onClick={() => onPromote(entry.id)}
                        >
                            <Icon className="size-4" icon={ArrowUp02Icon} />
                        </QueueIconButton>
                        <QueueIconButton
                            label="Edit queued message"
                            onClick={() => onEdit(entry.id)}
                        >
                            <Icon className="size-4" icon={PencilEdit02Icon} />
                        </QueueIconButton>
                        <QueueIconButton
                            label="Remove queued message"
                            onClick={() => onRemove(entry.id)}
                        >
                            <Icon className="size-4 text-destructive" icon={Trash2} />
                        </QueueIconButton>
                    </div>
                </div>
            ))}
        </div>
    );
}

function attachmentSummary(attachments: readonly Record<string, unknown>[] | undefined) {
    if (!attachments?.length) {
        return null;
    }

    const first = attachments[0];
    const firstLabel = typeof first?.filename === 'string' ? first.filename : 'Attachment';
    return attachments.length === 1 ? firstLabel : `${firstLabel} +${attachments.length - 1}`;
}

function QueueIconButton({
    children,
    disabled,
    label,
    onClick,
}: {
    children: React.ReactNode;
    disabled?: boolean;
    label: string;
    onClick?: () => void;
}) {
    const button = (
        <Button
            aria-label={label}
            className="size-6 rounded-md"
            disabled={disabled}
            onClick={onClick}
            size="icon-tight"
            type="button"
            variant="ghost"
        >
            {children}
        </Button>
    );

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
