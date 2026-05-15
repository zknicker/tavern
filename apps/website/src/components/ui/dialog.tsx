'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Button } from './primitives/button.tsx';
import { ScrollArea } from './scroll-area.tsx';

export const DialogCreateHandle: typeof DialogPrimitive.createHandle = DialogPrimitive.createHandle;

export const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;

export const DialogPortal: typeof DialogPrimitive.Portal = DialogPrimitive.Portal;

export function DialogTrigger(props: DialogPrimitive.Trigger.Props): React.ReactElement {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogClose(props: DialogPrimitive.Close.Props): React.ReactElement {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export function DialogBackdrop({
    className,
    ...props
}: DialogPrimitive.Backdrop.Props): React.ReactElement {
    return (
        <DialogPrimitive.Backdrop
            className={cn(
                'fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0',
                className
            )}
            data-slot="dialog-backdrop"
            {...props}
        />
    );
}

export function DialogViewport({
    className,
    ...props
}: DialogPrimitive.Viewport.Props): React.ReactElement {
    return (
        <DialogPrimitive.Viewport
            className={cn(
                'fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4',
                className
            )}
            data-slot="dialog-viewport"
            {...props}
        />
    );
}

export function DialogContent({
    className,
    children,
    showCloseButton = true,
    closeProps,
    ...props
}: DialogPrimitive.Popup.Props & {
    showCloseButton?: boolean;
    closeProps?: DialogPrimitive.Close.Props;
}): React.ReactElement {
    return (
        <DialogPortal>
            <DialogBackdrop />
            <DialogViewport>
                <DialogPrimitive.Popup
                    className={cn(
                        'relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl,1rem)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]',
                        className
                    )}
                    data-slot="dialog-popup"
                    {...props}
                >
                    {children}
                    {showCloseButton && (
                        <DialogPrimitive.Close
                            aria-label="Close"
                            className="absolute end-3 top-3"
                            render={<Button size="sm" variant="secondary" />}
                            {...closeProps}
                        >
                            <Icon className="size-5" icon={Cancel01Icon} />
                            Close
                        </DialogPrimitive.Close>
                    )}
                </DialogPrimitive.Popup>
            </DialogViewport>
        </DialogPortal>
    );
}

export function DialogHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'flex flex-col gap-1 px-6 py-5 pe-28 in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-3 max-sm:pb-4',
            className
        ),
        'data-slot': 'dialog-header',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function DialogFooter({
    className,
    variant = 'default',
    render,
    ...props
}: useRender.ComponentProps<'div'> & {
    variant?: 'default' | 'bare';
}): React.ReactElement {
    const defaultProps = {
        className: cn(
            'flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl,1rem)-1px)]',
            variant === 'default' && 'border-t bg-muted/72 py-3.5',
            variant === 'bare' &&
                'in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pt-3 pt-3 pb-5',
            className
        ),
        'data-slot': 'dialog-footer',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function DialogTitle({
    className,
    ...props
}: DialogPrimitive.Title.Props): React.ReactElement {
    return (
        <DialogPrimitive.Title
            className={cn(
                'font-heading font-semibold text-xl leading-none tracking-tight',
                className
            )}
            data-slot="dialog-title"
            {...props}
        />
    );
}

export function DialogDescription({
    className,
    ...props
}: DialogPrimitive.Description.Props): React.ReactElement {
    return (
        <DialogPrimitive.Description
            className={cn('text-muted-foreground text-sm leading-snug', className)}
            data-slot="dialog-description"
            {...props}
        />
    );
}

export function DialogPanel({
    className,
    scrollFade = true,
    render,
    ...props
}: useRender.ComponentProps<'div'> & {
    scrollFade?: boolean;
}): React.ReactElement {
    const defaultProps = {
        className: cn(
            'px-6 py-4 in-[[data-slot=dialog-popup]:has([data-slot=dialog-header])]:pt-0 in-[[data-slot=dialog-popup]:has([data-slot=dialog-footer]:not(.border-t))]:pb-1',
            className
        ),
        'data-slot': 'dialog-panel',
    };

    return (
        <ScrollArea scrollFade={scrollFade}>
            {useRender({
                defaultTagName: 'div',
                props: mergeProps<'div'>(defaultProps, props),
                render,
            })}
        </ScrollArea>
    );
}

export { DialogPrimitive, DialogBackdrop as DialogOverlay };
