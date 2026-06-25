'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { motion } from 'framer-motion';
import type React from 'react';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Button } from './primitives/button.tsx';
import { ScrollArea } from './scroll-area.tsx';
import { SurfaceProvider, surfaceClasses, useSurface } from './surface.tsx';

export const DialogCreateHandle: typeof DialogPrimitive.createHandle = DialogPrimitive.createHandle;

const dialogSurfaceOffset = 4;

export function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props): React.ReactElement {
    return (
        <DialogPrimitive.Root
            onOpenChange={(open, eventDetails) => {
                onOpenChange?.(open, eventDetails);
            }}
            {...props}
        />
    );
}

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
            data-slot="dialog-backdrop"
            render={(backdropProps, state) => {
                const restProps = stripDialogMotionEventProps(backdropProps);

                return (
                    <motion.div
                        {...restProps}
                        animate={{ opacity: state.transitionStatus === 'ending' ? 0 : 1 }}
                        className={cn('fixed inset-0 z-50 bg-black/40 dark:bg-black/80', className)}
                        initial={{ opacity: 0 }}
                        transition={
                            state.transitionStatus === 'ending'
                                ? dialogExitTransition
                                : springs.slow
                        }
                    />
                );
            }}
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
    size = 'sm',
    surfaceOffset = dialogSurfaceOffset,
    ...props
}: Omit<DialogPrimitive.Popup.Props, 'render'> & {
    showCloseButton?: boolean;
    closeProps?: DialogPrimitive.Close.Props;
    size?: 'sm' | 'lg';
    surfaceOffset?: number;
}): React.ReactElement {
    const substrate = useSurface();
    const dialogLevel = Math.min(substrate + surfaceOffset, 8);

    return (
        <DialogPortal>
            <DialogBackdrop />
            <DialogViewport>
                <DialogPrimitive.Popup
                    data-slot="dialog-popup"
                    render={(popupProps, state) => {
                        const restProps = stripDialogMotionEventProps(popupProps);

                        return (
                            <motion.div
                                {...restProps}
                                animate={{
                                    opacity: state.transitionStatus === 'ending' ? 0 : 1,
                                    scale: state.transitionStatus === 'ending' ? 0.97 : 1,
                                }}
                                className={cn(
                                    'relative row-start-2 flex max-h-full min-h-0 w-[calc(100%-2rem)] min-w-0 origin-center flex-col rounded-2xl text-popover-foreground outline-none',
                                    surfaceClasses(dialogLevel),
                                    'p-6',
                                    size === 'sm' && 'max-w-[400px]',
                                    size === 'lg' && 'max-w-[540px]',
                                    className
                                )}
                                initial={{ opacity: 0, scale: 0.97 }}
                                transition={
                                    state.transitionStatus === 'ending'
                                        ? dialogExitTransition
                                        : springs.slow
                                }
                            >
                                <SurfaceProvider value={dialogLevel}>
                                    {children}
                                    {showCloseButton && (
                                        <DialogPrimitive.Close
                                            aria-label="Close"
                                            className="absolute top-3 right-3"
                                            render={
                                                <Button size="icon-sm" variant="ghost">
                                                    <Icon className="size-4" icon={Cancel01Icon} />
                                                </Button>
                                            }
                                            {...closeProps}
                                        />
                                    )}
                                </SurfaceProvider>
                            </motion.div>
                        );
                    }}
                    {...props}
                />
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
        className: cn('mb-4 flex flex-col gap-1.5 pe-10', className),
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
            'mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
            variant === 'default' && 'border-border border-t pt-4',
            variant === 'bare' && 'mt-4',
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
            className={cn('text-foreground text-lg leading-tight', className)}
            data-slot="dialog-title"
            style={{ fontVariationSettings: "'wght' 700" }}
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
            className={cn('text-meta text-muted-foreground', className)}
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
        className: cn(className),
        'data-slot': 'dialog-panel',
    };

    return (
        <ScrollArea className="-m-1" scrollFade={scrollFade} viewportClassName="p-1">
            {useRender({
                defaultTagName: 'div',
                props: mergeProps<'div'>(defaultProps, props),
                render,
            })}
        </ScrollArea>
    );
}

export { DialogPrimitive, DialogBackdrop as DialogOverlay };

const dialogExitTransition = {
    ...springs.slow,
    duration: 0.18,
};

function stripDialogMotionEventProps(props: React.HTMLAttributes<HTMLDivElement>) {
    const {
        onAnimationEnd,
        onAnimationIteration,
        onAnimationStart,
        onDrag,
        onDragEnd,
        onDragStart,
        ...restProps
    } = props;

    void onAnimationEnd;
    void onAnimationIteration;
    void onAnimationStart;
    void onDrag;
    void onDragEnd;
    void onDragStart;

    return restProps;
}
