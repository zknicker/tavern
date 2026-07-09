import { Cancel01Icon, Download01Icon, File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { ImageLightbox } from '../../components/ui/image-lightbox.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import {
    useTaskAttachmentContent,
    useTaskAttachmentDelete,
} from '../../hooks/tasks/use-task-attachments.ts';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';

type TaskAttachment = TaskRecord['attachments'][number];

export function TaskAttachments({
    attachments,
    taskId,
}: {
    attachments: TaskAttachment[];
    taskId: string;
}) {
    if (attachments.length === 0) {
        return null;
    }

    const images = attachments.filter((attachment) => isImage(attachment.mediaType));
    const files = attachments.filter((attachment) => !isImage(attachment.mediaType));

    return (
        <section className="shrink-0 space-y-2">
            <h2 className="font-medium text-muted-foreground text-sm">Attachments</h2>
            {images.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
                    {images.map((attachment) => (
                        <TaskImageAttachment
                            attachment={attachment}
                            key={attachment.id}
                            taskId={taskId}
                        />
                    ))}
                </div>
            ) : null}
            {files.length > 0 ? (
                <div className="space-y-2">
                    {files.map((attachment) => (
                        <TaskFileAttachment
                            attachment={attachment}
                            key={attachment.id}
                            taskId={taskId}
                        />
                    ))}
                </div>
            ) : null}
        </section>
    );
}

function TaskImageAttachment({
    attachment,
    taskId,
}: {
    attachment: TaskAttachment;
    taskId: string;
}) {
    const [open, setOpen] = React.useState(false);
    const content = useTaskAttachmentContent(taskId, attachment, true);
    const dataUrl = content.data
        ? `data:${content.data.mediaType ?? attachment.mediaType ?? 'image/png'};base64,${content.data.contentBase64}`
        : null;

    return (
        <div className="group/attachment relative">
            {dataUrl ? (
                <button
                    aria-label={`Open ${attachment.filename}`}
                    className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg border border-border/60 bg-muted/35 p-0 outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setOpen(true)}
                    title={attachment.filename}
                    type="button"
                >
                    <img
                        alt={attachment.filename}
                        className="size-full object-cover"
                        height={288}
                        src={dataUrl}
                        width={288}
                    />
                </button>
            ) : content.error ? (
                <div className="grid aspect-square w-full place-items-center rounded-lg border border-border/60 bg-muted/35 px-2 text-center text-muted-foreground text-xs">
                    Preview unavailable
                </div>
            ) : (
                <Skeleton className="aspect-square w-full rounded-lg" />
            )}
            <AttachmentRemoveButton
                attachment={attachment}
                className="absolute top-1.5 right-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/attachment:opacity-100"
                taskId={taskId}
            />
            {dataUrl ? (
                <ImageLightbox
                    dataUrl={dataUrl}
                    filename={attachment.filename}
                    onOpenChange={setOpen}
                    open={open}
                />
            ) : null}
        </div>
    );
}

function TaskFileAttachment({
    attachment,
    taskId,
}: {
    attachment: TaskAttachment;
    taskId: string;
}) {
    const [requested, setRequested] = React.useState(false);
    const content = useTaskAttachmentContent(taskId, attachment, requested);
    const triggered = React.useRef(false);

    React.useEffect(() => {
        if (!(requested && content.data) || triggered.current) {
            return;
        }

        triggered.current = true;
        const anchor = document.createElement('a');
        anchor.href = `data:${content.data.mediaType ?? attachment.mediaType ?? 'application/octet-stream'};base64,${content.data.contentBase64}`;
        anchor.download = attachment.filename;
        anchor.click();
    }, [attachment, content.data, requested]);

    return (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground">
                <Icon className="size-4" icon={File01Icon} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground text-sm">
                    {attachment.filename}
                </div>
                <div className="truncate text-muted-foreground text-xs">
                    {formatBytes(attachment.byteSize)}
                    {attachment.mediaType ? ` · ${attachment.mediaType}` : ''}
                </div>
            </div>
            <button
                aria-label={`Download ${attachment.filename}`}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                disabled={requested && content.isPending}
                onClick={() => {
                    triggered.current = false;
                    setRequested(true);
                }}
                title="Download"
                type="button"
            >
                <Icon className="size-4" icon={Download01Icon} />
            </button>
            <AttachmentRemoveButton attachment={attachment} taskId={taskId} />
        </div>
    );
}

function AttachmentRemoveButton({
    attachment,
    className,
    taskId,
}: {
    attachment: TaskAttachment;
    className?: string;
    taskId: string;
}) {
    const deleteMutation = useTaskAttachmentDelete();

    const remove = () => {
        // biome-ignore lint/suspicious/noAlert: Browser confirm is the current delete safeguard.
        if (!window.confirm(`Remove ${attachment.filename}?`)) {
            return;
        }

        deleteMutation
            .mutateAsync({ attachmentId: attachment.id, taskId })
            .catch((error: unknown) => {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    title: 'Remove failed',
                    type: 'error',
                });
            });
    };

    return (
        <button
            aria-label={`Remove ${attachment.filename}`}
            className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md bg-background/80 text-muted-foreground outline-none backdrop-blur transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                className
            )}
            disabled={deleteMutation.isPending}
            onClick={remove}
            title="Remove"
            type="button"
        >
            <Icon className="size-4" icon={Cancel01Icon} />
        </button>
    );
}

function isImage(mediaType: string | null): boolean {
    return mediaType?.startsWith('image/') ?? false;
}

function formatBytes(value: number): string {
    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
