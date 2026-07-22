import {
    Bookmark01Icon,
    BubbleChatIcon,
    Copy01Icon,
    SmileIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import {
    ContextMenu,
    ContextMenuItem,
    ContextMenuPopup,
    ContextMenuTrigger,
} from '../../../components/ui/context-menu.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';
import { isLocalTimelineMessageMetadata } from '../../../hooks/chats/chat-timeline-messages.ts';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { cn } from '../../../lib/utils.ts';
import { isActivityBackedMessageRow, isStreamingPostMessageRow } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { ThreadReplyPill } from './thread-reply-pill.tsx';

const actionButtonClassName =
    'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-50';

export function ThreadMessageSurface({
    children,
    row,
}: {
    children: React.ReactNode;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();

    if (!(context?.threadActionsEnabled && isThreadAnchorRow(row))) {
        return children;
    }

    const openThread = () => context.onOpenThread(row);
    const thread = getTranscriptMessageThread(row);
    const active = context.activeThreadAnchorId === row.message.id;
    const flashing = context.flashMessageId === row.message.id;

    return (
        <ContextMenu>
            <ContextMenuTrigger
                className={cn(
                    'group/message-row relative block min-w-0 rounded-lg',
                    active ? 'bg-active ring-1 ring-brand-ring' : null,
                    flashing ? 'chat-thread-flash' : null
                )}
            >
                <MessageHoverActions onOpenThread={openThread} />
                {children}
                {thread ? <ThreadReplyPill onClick={openThread} summary={thread} /> : null}
            </ContextMenuTrigger>
            <ContextMenuPopup>
                <ContextMenuItem onClick={openThread}>
                    <Icon className="size-4" icon={BubbleChatIcon} />
                    Open Thread
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() =>
                        void writeClipboardText(row.message.content).catch(() => undefined)
                    }
                >
                    <Icon className="size-4" icon={Copy01Icon} />
                    Copy Markdown
                </ContextMenuItem>
                {thread?.followed ? (
                    <ContextMenuItem onClick={() => context.onUnfollowThread(thread.threadChatId)}>
                        <Icon className="size-4" icon={Bookmark01Icon} />
                        Unfollow Thread
                    </ContextMenuItem>
                ) : null}
            </ContextMenuPopup>
        </ContextMenu>
    );
}

/** Only Runtime-persisted, settled chat messages can anchor child threads. */
export function isThreadAnchorRow(row: TranscriptMessageRow) {
    return (
        row.message.id.startsWith('msg_') &&
        !isActivityBackedMessageRow(row) &&
        !isLocalTimelineMessageMetadata(row.message.metadata) &&
        !isStreamingPostMessageRow(row)
    );
}

function MessageHoverActions({ onOpenThread }: { onOpenThread: () => void }) {
    return (
        <div className="absolute -top-3 right-1 z-10 flex items-center rounded-lg border border-border bg-popover p-0.5 opacity-0 shadow-sm focus-within:opacity-100 group-hover/message-row:opacity-100">
            <Tooltip content="Reply in thread">
                <button
                    aria-label="Reply in thread"
                    className={actionButtonClassName}
                    onClick={onOpenThread}
                    type="button"
                >
                    <Icon className="size-4" icon={BubbleChatIcon} />
                </button>
            </Tooltip>
            <DisabledMessageAction
                icon={SmileIcon}
                label="Add Reaction"
                tooltip="Reactions are coming soon"
            />
            <DisabledMessageAction
                icon={Bookmark01Icon}
                label="Save Message"
                tooltip="Saved messages are coming soon"
            />
        </div>
    );
}

function DisabledMessageAction({
    icon,
    label,
    tooltip,
}: {
    icon: React.ComponentProps<typeof Icon>['icon'];
    label: string;
    tooltip: string;
}) {
    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                <button aria-label={label} className={actionButtonClassName} disabled type="button">
                    <Icon className="size-4" icon={icon} />
                </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
