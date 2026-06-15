import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Cancel01Icon, ZoomInAreaIcon, ZoomOutAreaIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Dialog, DialogPortal, DialogTitle } from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
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
