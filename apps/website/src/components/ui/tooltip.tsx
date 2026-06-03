'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export const TooltipCreateHandle: typeof TooltipPrimitive.createHandle =
    TooltipPrimitive.createHandle;

export function TooltipProvider({
    delay = 0,
    closeDelay = 0,
    ...props
}: TooltipPrimitive.Provider.Props): React.ReactElement {
    return <TooltipPrimitive.Provider closeDelay={closeDelay} delay={delay} {...props} />;
}

export type TooltipSide = TooltipPrimitive.Positioner.Props['side'];

type TooltipRootProps = TooltipPrimitive.Root.Props & {
    children: React.ReactNode;
};

export type TooltipProps =
    | TooltipRootProps
    | (Omit<TooltipPrimitive.Root.Props, 'children'> & {
          children: React.ReactElement;
          className?: string;
          content: React.ReactNode;
          delayDuration?: number;
          side?: TooltipSide;
          sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset'];
      });

export function Tooltip(props: TooltipProps): React.ReactElement {
    if (!('content' in props)) {
        return <TooltipPrimitive.Root {...props} />;
    }

    const {
        children,
        className,
        content,
        delayDuration = 0,
        side = 'top',
        sideOffset = 8,
        ...rootProps
    } = props;

    return (
        <TooltipPrimitive.Root {...rootProps}>
            <TooltipTrigger delay={delayDuration} render={children} />
            <TooltipContent className={className} side={side} sideOffset={sideOffset}>
                {content}
            </TooltipContent>
        </TooltipPrimitive.Root>
    );
}

export function TooltipTrigger({
    delay = 0,
    closeDelay = 0,
    ...props
}: TooltipPrimitive.Trigger.Props): React.ReactElement {
    return (
        <TooltipPrimitive.Trigger
            closeDelay={closeDelay}
            data-slot="tooltip-trigger"
            delay={delay}
            {...props}
        />
    );
}

export function TooltipContent({
    className,
    align = 'center',
    alignOffset,
    sideOffset = 8,
    side = 'top',
    anchor,
    collisionAvoidance,
    collisionPadding,
    children,
    ...props
}: TooltipPrimitive.Popup.Props & {
    align?: TooltipPrimitive.Positioner.Props['align'];
    alignOffset?: TooltipPrimitive.Positioner.Props['alignOffset'];
    anchor?: TooltipPrimitive.Positioner.Props['anchor'];
    collisionAvoidance?: TooltipPrimitive.Positioner.Props['collisionAvoidance'];
    collisionPadding?: TooltipPrimitive.Positioner.Props['collisionPadding'];
    side?: TooltipPrimitive.Positioner.Props['side'];
    sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset'];
}): React.ReactElement {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                className="z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)"
                collisionAvoidance={collisionAvoidance}
                collisionPadding={collisionPadding}
                data-slot="tooltip-positioner"
                side={side}
                sideOffset={sideOffset}
            >
                <TooltipPrimitive.Popup
                    className={cn(
                        'relative flex h-(--popup-height,auto) w-(--popup-width,auto) origin-(--transform-origin) rounded-[var(--main-radius)] border border-white/8 bg-neutral-950 text-neutral-50 text-xs leading-4 shadow-black/30 shadow-lg outline-none transition-[opacity,transform,scale] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--main-radius)-1px)] before:shadow-[0_-1px_--theme(--color-white/6%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:duration-0',
                        className
                    )}
                    data-slot="tooltip-popup"
                    {...props}
                >
                    <TooltipPrimitive.Viewport
                        className="relative size-full overflow-clip px-2.5 py-1.5"
                        data-slot="tooltip-viewport"
                    >
                        {children}
                    </TooltipPrimitive.Viewport>
                </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
    );
}

export function MouseTooltip({
    children,
    content,
    delay = 0,
    side = 'bottom',
    sideOffset = 10,
    contentClassName,
    ...props
}: Omit<TooltipPrimitive.Root.Props, 'children' | 'trackCursorAxis'> & {
    children: React.ReactElement;
    content: React.ReactNode;
    contentClassName?: string;
    delay?: TooltipPrimitive.Trigger.Props['delay'];
    side?: TooltipPrimitive.Positioner.Props['side'];
    sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset'];
}): React.ReactElement {
    return (
        <TooltipPrimitive.Root trackCursorAxis="both" {...props}>
            <TooltipTrigger delay={delay} render={children} />
            <TooltipContent className={contentClassName} side={side} sideOffset={sideOffset}>
                {content}
            </TooltipContent>
        </TooltipPrimitive.Root>
    );
}

export { TooltipPrimitive };
