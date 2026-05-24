import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Cancel01Icon, ZoomInAreaIcon, ZoomOutAreaIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Dialog, DialogPortal, DialogTitle } from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { readMentionsFromMetadata } from '../mentions/mention-metadata.ts';
import { renderMentionText } from '../mentions/render-mention-text.tsx';
import { CollapsibleText } from '../rows/collapsible-text.tsx';
import { getMessageDisplay } from '../rows/message-display.ts';

type TranscriptMessage =
    | Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['message']
    | Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['message'];

type MessageAttachment = NonNullable<TranscriptMessage['attachments']>[number];

export function ChatTranscriptMessageContent({ message }: { message: TranscriptMessage }) {
    const messageDisplay = getMessageDisplay(message);
    const attachments = message.attachments ?? [];
    const hasAttachments = attachments.length > 0;
    const hasImageAttachments = attachments.some(
        (attachment) => attachment.type === 'inline' && isImageAttachment(attachment)
    );
    const isErrorEvent =
        message.senderType === 'agent' &&
        messageDisplay.content.length === 0 &&
        message.metadata?.stopReason === 'error';
    const mentions = readMentionsFromMetadata(
        messageDisplay.content,
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

    if (!(messageDisplay.showBodyContent || hasAttachments)) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            {messageDisplay.showBodyContent ? (
                <div
                    className={cn(
                        hasImageAttachments &&
                            'w-fit max-w-full rounded-md border border-border/40 bg-muted/45 px-3 py-2'
                    )}
                >
                    <CollapsibleText className="text-foreground text-sm leading-[1.72]">
                        {mentions.length > 0
                            ? renderMentionText({
                                  content: messageDisplay.content,
                                  mentions,
                              })
                            : messageDisplay.content}
                    </CollapsibleText>
                </div>
            ) : null}
            <MessageAttachments attachments={attachments} />
        </div>
    );
}

function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            {attachments.map((attachment) => {
                if (attachment.type === 'file') {
                    return <MessageFileReference attachment={attachment} key={attachment.path} />;
                }

                if (isImageAttachment(attachment)) {
                    return <MessageImage attachment={attachment} key={attachment.filename} />;
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
        </div>
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

function MessageImage({
    attachment,
}: {
    attachment: Extract<MessageAttachment, { type: 'inline' }>;
}) {
    const [open, setOpen] = React.useState(false);
    const [zoom, setZoom] = React.useState(1);
    const dataUrl = `data:${attachment.mediaType};base64,${attachment.dataBase64}`;
    const width = attachment.width ?? 960;
    const height = attachment.height ?? 540;
    const isFitZoom = zoom === 1;

    React.useEffect(() => {
        if (open) {
            setZoom(1);
        }
    }, [open]);

    return (
        <>
            <button
                aria-label={`Open ${attachment.filename}`}
                className="w-fit max-w-full cursor-zoom-in overflow-hidden rounded-md bg-muted/35 p-0 text-left outline-1 outline-black/10 -outline-offset-1 dark:outline-white/10"
                onClick={() => setOpen(true)}
                type="button"
            >
                <img
                    alt=""
                    className="max-h-[28rem] max-w-full object-contain"
                    height={height}
                    src={dataUrl}
                    width={width}
                />
            </button>
            <Dialog onOpenChange={setOpen} open={open}>
                <DialogPortal>
                    <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/72 backdrop-blur-md transition-[opacity,backdrop-filter] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:backdrop-blur-none data-starting-style:backdrop-blur-none" />
                    <DialogPrimitive.Popup className="fixed inset-0 z-50 flex min-h-dvh flex-col text-white outline-none transition-[opacity,scale] duration-200 ease-out will-change-transform data-ending-style:scale-96 data-starting-style:scale-96 data-ending-style:opacity-0 data-starting-style:opacity-0">
                        <DialogTitle className="sr-only">{attachment.filename}</DialogTitle>
                        <div className="flex h-14 shrink-0 items-center gap-3 pr-3 pl-24">
                            <p className="min-w-0 flex-1 truncate text-sm text-white/75">
                                {attachment.filename}
                            </p>
                            <ImageZoomControls
                                isFitZoom={isFitZoom}
                                onReset={() => setZoom(1)}
                                onZoomIn={() => setZoom((value) => Math.min(4, value + 0.25))}
                                onZoomOut={() => setZoom((value) => Math.max(1, value - 0.25))}
                                zoom={zoom}
                            />
                            <DialogPrimitive.Close
                                aria-label="Close"
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white"
                            >
                                <Icon icon={Cancel01Icon} size={20} />
                            </DialogPrimitive.Close>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto px-6 pt-2 pb-8 md:px-12 md:pb-12">
                            <div className="flex min-h-full min-w-full items-center justify-center">
                                <img
                                    alt=""
                                    className={cn(
                                        'rounded-md object-contain shadow-2xl shadow-black/50',
                                        isFitZoom ? 'max-h-full max-w-full' : 'max-w-none'
                                    )}
                                    height={isFitZoom ? height : Math.round(height * zoom)}
                                    src={dataUrl}
                                    width={isFitZoom ? width : Math.round(width * zoom)}
                                />
                            </div>
                        </div>
                    </DialogPrimitive.Popup>
                </DialogPortal>
            </Dialog>
        </>
    );
}

function ImageZoomControls({
    isFitZoom,
    onReset,
    onZoomIn,
    onZoomOut,
    zoom,
}: {
    isFitZoom: boolean;
    onReset: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    zoom: number;
}) {
    return (
        <div className="inset-ring-1 inset-ring-white/10 flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 p-1 text-white/85 backdrop-blur-md">
            <button
                aria-label="Zoom out"
                className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white/15 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                disabled={zoom <= 1}
                onClick={onZoomOut}
                type="button"
            >
                <Icon icon={ZoomOutAreaIcon} size={14} />
            </button>
            <button
                aria-label={isFitZoom ? 'Fit to screen' : 'Reset zoom'}
                className="inline-flex h-7 min-w-14 items-center justify-center rounded-full px-2 font-medium text-xs tabular-nums hover:bg-white/15 hover:text-white disabled:cursor-default disabled:hover:bg-transparent"
                disabled={isFitZoom}
                onClick={onReset}
                type="button"
            >
                {isFitZoom ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </button>
            <button
                aria-label="Zoom in"
                className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white/15 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                disabled={zoom >= 4}
                onClick={onZoomIn}
                type="button"
            >
                <Icon icon={ZoomInAreaIcon} size={14} />
            </button>
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
