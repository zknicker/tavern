'use client';

import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export const PreviewCardCreateHandle: typeof PreviewCardPrimitive.createHandle =
    PreviewCardPrimitive.createHandle;

export const PreviewCard: typeof PreviewCardPrimitive.Root = PreviewCardPrimitive.Root;

export function PreviewCardTrigger({
    closeDelay = 150,
    delay = 100,
    ...props
}: PreviewCardPrimitive.Trigger.Props): React.ReactElement {
    return (
        <PreviewCardPrimitive.Trigger
            closeDelay={closeDelay}
            data-slot="preview-card-trigger"
            delay={delay}
            {...props}
        />
    );
}

export function PreviewCardPopup({
    align = 'center',
    alignOffset = 0,
    anchor,
    children,
    className,
    collisionAvoidance,
    collisionPadding,
    instant = false,
    portalProps,
    side = 'right',
    sideOffset = 8,
    ...props
}: PreviewCardPrimitive.Popup.Props & {
    align?: PreviewCardPrimitive.Positioner.Props['align'];
    alignOffset?: PreviewCardPrimitive.Positioner.Props['alignOffset'];
    anchor?: PreviewCardPrimitive.Positioner.Props['anchor'];
    collisionAvoidance?: PreviewCardPrimitive.Positioner.Props['collisionAvoidance'];
    collisionPadding?: PreviewCardPrimitive.Positioner.Props['collisionPadding'];
    instant?: boolean;
    portalProps?: PreviewCardPrimitive.Portal.Props;
    side?: PreviewCardPrimitive.Positioner.Props['side'];
    sideOffset?: PreviewCardPrimitive.Positioner.Props['sideOffset'];
}): React.ReactElement {
    return (
        <PreviewCardPrimitive.Portal {...portalProps}>
            <PreviewCardPrimitive.Positioner
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                className={cn(
                    'z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform] data-instant:transition-none',
                    instant && 'transition-none'
                )}
                collisionAvoidance={collisionAvoidance}
                collisionPadding={collisionPadding}
                data-slot="preview-card-positioner"
                side={side}
                sideOffset={sideOffset}
            >
                <PreviewCardPrimitive.Popup
                    className={cn(
                        'relative flex h-(--popup-height,auto) w-(--popup-width,auto) origin-(--transform-origin) rounded-xl border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-black/8 shadow-lg outline-none transition-[opacity,transform,scale] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:duration-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]',
                        instant &&
                            'transition-none duration-0 data-ending-style:scale-100 data-starting-style:scale-100 data-ending-style:opacity-100 data-starting-style:opacity-100',
                        className
                    )}
                    data-slot="preview-card-popup"
                    {...props}
                >
                    <PreviewCardPrimitive.Viewport
                        className="relative size-full max-h-(--available-height) overflow-clip px-4 py-3"
                        data-slot="preview-card-viewport"
                    >
                        {children}
                    </PreviewCardPrimitive.Viewport>
                </PreviewCardPrimitive.Popup>
            </PreviewCardPrimitive.Positioner>
        </PreviewCardPrimitive.Portal>
    );
}

export { PreviewCardPopup as PreviewCardContent, PreviewCardPrimitive };
