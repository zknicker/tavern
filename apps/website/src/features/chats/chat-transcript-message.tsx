import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { readMentionsFromMetadata } from '../mentions/mention-metadata.ts';
import { CollapsibleText } from '../rows/collapsible-text.tsx';
import { getMessageDisplay } from '../rows/message-display.ts';
import { ChatInlineMarkdownText } from './chat-inline-markdown-text.tsx';
import type { ChatTextAnimationRange } from './chat-inline-text-animation.tsx';
import { ChatMessageImage } from './chat-message-image.tsx';

export type TranscriptMessage =
    | Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['message']
    | Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['message'];

type MessageAttachment = NonNullable<TranscriptMessage['attachments']>[number];

export function ChatTranscriptMessageContent({
    animatedRanges,
    contentOverride,
    message,
    textClassName,
}: {
    animatedRanges?: readonly ChatTextAnimationRange[];
    contentOverride?: string;
    message: TranscriptMessage;
    textClassName?: string;
}) {
    const messageDisplay = getMessageDisplay(message);
    const isErrorEvent =
        message.senderType === 'agent' &&
        messageDisplay.content.length === 0 &&
        message.metadata?.stopReason === 'error';
    const content = contentOverride ?? messageDisplay.content;
    const mentions = readMentionsFromMetadata(
        content,
        message.metadata as Record<string, unknown> | null | undefined
    );

    if (isErrorEvent) {
        return (
            <div className="rounded-md border border-red-500/16 bg-red-500/6 px-2.5 py-1.5">
                <p className="font-medium text-red-400 text-sm">
                    Error - session ended unexpectedly
                </p>
            </div>
        );
    }

    if (!messageDisplay.showBodyContent) {
        return null;
    }

    return (
        <CollapsibleText className={cn('text-sm', textClassName ?? 'text-foreground')}>
            <ChatInlineMarkdownText
                animatedRanges={animatedRanges}
                content={content}
                mentions={mentions}
            />
        </CollapsibleText>
    );
}

export function getTranscriptMessageContent(message: TranscriptMessage) {
    const messageDisplay = getMessageDisplay(message);

    return messageDisplay.showBodyContent ? messageDisplay.content : '';
}

export function ChatTranscriptMessageAttachments({
    attachments,
}: {
    attachments: MessageAttachment[];
}) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <>
            {attachments.map((attachment) => {
                if (attachment.type === 'file') {
                    return <MessageFileReference attachment={attachment} key={attachment.path} />;
                }

                if (isImageAttachment(attachment)) {
                    return <ChatMessageImage attachment={attachment} key={attachment.filename} />;
                }

                const dataUrl = `data:${attachment.mediaType};base64,${attachment.dataBase64}`;

                return (
                    <a
                        className="w-fit max-w-full truncate rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-foreground text-sm transition-colors hover:bg-muted"
                        download={attachment.filename}
                        href={dataUrl}
                        key={attachment.filename}
                    >
                        {attachment.filename}
                    </a>
                );
            })}
        </>
    );
}

function MessageFileReference({
    attachment,
}: {
    attachment: Extract<MessageAttachment, { type: 'file' }>;
}) {
    return (
        <div className="w-fit max-w-full rounded-md border border-border/50 bg-muted/35 px-2.5 py-1.5 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 truncate font-medium text-foreground">
                    {attachment.filename}
                </span>
                <span className="rounded-sm bg-background px-1.5 py-0.5 text-muted-foreground text-xs">
                    File reference
                </span>
                {attachment.sizeBytes !== null && attachment.sizeBytes !== undefined ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                        {formatAttachmentBytes(attachment.sizeBytes)}
                    </span>
                ) : null}
                {attachment.mediaType ? (
                    <span className="text-muted-foreground text-xs">{attachment.mediaType}</span>
                ) : null}
            </div>
            <div className="mt-1 truncate font-mono text-muted-foreground text-xs">
                {attachment.path}
            </div>
        </div>
    );
}

function isImageAttachment(attachment: Extract<MessageAttachment, { type: 'inline' }>) {
    return (
        attachment.type === 'inline' &&
        ['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(attachment.mediaType)
    );
}

function formatAttachmentBytes(sizeBytes: number) {
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }

    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
