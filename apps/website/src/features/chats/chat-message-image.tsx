import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
    Cancel01Icon,
    Download01Icon,
    MinusSignIcon,
    PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Dialog, DialogPortal, DialogTitle } from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button, buttonVariants } from '../../components/ui/primitives/button.tsx';
import { cn } from '../../lib/utils.ts';

interface ChatMessageImageAttachment {
    dataBase64: string;
    filename: string;
    height?: number | null;
    mediaType: string;
    width?: number | null;
}

export function ChatMessageImage({ attachment }: { attachment: ChatMessageImageAttachment }) {
    const [open, setOpen] = React.useState(false);
    const [zoom, setZoom] = React.useState(1);
    const dataUrl = `data:${attachment.mediaType};base64,${attachment.dataBase64}`;
    const width = attachment.width ?? 960;
    const height = attachment.height ?? 540;
    const isFitZoom = zoom === 1;
    const zoomPercent = `${Math.round(zoom * 100)}%`;

    React.useEffect(() => {
        if (open) {
            setZoom(1);
        }
    }, [open]);

    return (
        <>
            <button
                aria-label={`Open ${attachment.filename}`}
                className="size-16 cursor-zoom-in overflow-hidden rounded-xl border border-border/60 bg-muted/35 p-0 text-left shadow-xs outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(true)}
                title={attachment.filename}
                type="button"
            >
                <img
                    alt=""
                    className="size-full object-cover"
                    height={64}
                    src={dataUrl}
                    width={64}
                />
            </button>
            <Dialog onOpenChange={setOpen} open={open}>
                <DialogPortal>
                    <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/76 backdrop-blur-md transition-[opacity,backdrop-filter] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:backdrop-blur-none data-starting-style:backdrop-blur-none" />
                    <DialogPrimitive.Popup className="fixed inset-0 z-50 flex min-h-dvh flex-col text-white outline-none transition-[opacity,scale] duration-200 ease-out will-change-transform data-ending-style:scale-96 data-starting-style:scale-96 data-ending-style:opacity-0 data-starting-style:opacity-0">
                        <DialogTitle className="sr-only">{attachment.filename}</DialogTitle>
                        <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-3">
                            <a
                                aria-label={`Download ${attachment.filename}`}
                                className={cn(
                                    buttonVariants({ size: 'icon-xl', variant: 'default' }),
                                    imageViewerActionButtonClassName
                                )}
                                download={attachment.filename}
                                href={dataUrl}
                            >
                                <Icon icon={Download01Icon} size={24} strokeWidth={2} />
                                <span className="sr-only">Download {attachment.filename}</span>
                            </a>
                            <DialogPrimitive.Close
                                aria-label="Close image viewer"
                                render={
                                    <Button
                                        className={imageViewerActionButtonClassName}
                                        size="icon-xl"
                                        variant="default"
                                    />
                                }
                            >
                                <Icon icon={Cancel01Icon} size={24} strokeWidth={2} />
                            </DialogPrimitive.Close>
                        </div>
                        <div className="flex h-14 shrink-0 items-center gap-3 pr-32 pl-24">
                            <p className="min-w-0 flex-1 truncate text-sm text-white/75">
                                {attachment.filename}
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto px-6 pt-2 pb-8 md:px-12 md:pb-12">
                            <div className="relative flex min-h-full min-w-full items-center justify-center">
                                <button
                                    aria-hidden="true"
                                    className="absolute inset-0 cursor-zoom-out"
                                    onClick={() => setOpen(false)}
                                    tabIndex={-1}
                                    type="button"
                                />
                                <img
                                    alt=""
                                    className={cn(
                                        'relative z-10 cursor-default rounded-md object-contain shadow-2xl shadow-black/55',
                                        isFitZoom ? 'max-h-full max-w-full' : 'max-w-none'
                                    )}
                                    height={isFitZoom ? height : Math.round(height * zoom)}
                                    src={dataUrl}
                                    width={isFitZoom ? width : Math.round(width * zoom)}
                                />
                            </div>
                        </div>
                        <ImageZoomControls
                            onZoomIn={() => setZoom((value) => Math.min(4, value + 0.25))}
                            onZoomOut={() => setZoom((value) => Math.max(1, value - 0.25))}
                            zoom={zoom}
                            zoomLabel={zoomPercent}
                        />
                    </DialogPrimitive.Popup>
                </DialogPortal>
            </Dialog>
        </>
    );
}

const imageViewerActionButtonClassName =
    'pointer-events-auto size-11 rounded-full border-white bg-white text-neutral-950 shadow-black/20 shadow-lg before:rounded-full hover:bg-white/90 focus-visible:ring-white/70 focus-visible:ring-offset-black/40 sm:size-11 dark:bg-white dark:text-neutral-950 dark:hover:bg-white/90 [&_svg]:opacity-100';

function ImageZoomControls({
    onZoomIn,
    onZoomOut,
    zoom,
    zoomLabel,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    zoom: number;
    zoomLabel: string;
}) {
    return (
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-full border border-white/15 bg-white text-neutral-950 shadow-black/20 shadow-lg">
            <button
                aria-label="Zoom out"
                className="inline-flex size-10 items-center justify-center rounded-l-full hover:bg-neutral-100 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
                disabled={zoom <= 1}
                onClick={onZoomOut}
                type="button"
            >
                <Icon icon={MinusSignIcon} size={18} strokeWidth={2} />
            </button>
            <div className="min-w-16 border-neutral-200 border-x px-3 text-center font-medium text-sm tabular-nums">
                {zoomLabel}
            </div>
            <button
                aria-label="Zoom in"
                className="inline-flex size-10 items-center justify-center rounded-r-full hover:bg-neutral-100 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
                disabled={zoom >= 4}
                onClick={onZoomIn}
                type="button"
            >
                <Icon icon={PlusSignIcon} size={18} strokeWidth={2} />
            </button>
        </div>
    );
}
