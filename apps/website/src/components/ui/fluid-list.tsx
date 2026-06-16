import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useProximityHover } from '../../hooks/use-proximity-hover.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';

interface FluidListContextValue {
    registerItem: (index: number, element: HTMLElement | null) => void;
}

const FluidListContext = React.createContext<FluidListContextValue | null>(null);

/**
 * A vertical list with the proximity hover highlight: one shared background
 * that springs between rows as the pointer moves, matching the table
 * component's hover behavior.
 */
export function FluidList({
    children,
    className,
    ...props
}: React.ComponentPropsWithoutRef<'div'>) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const { activeIndex, handlers, itemRects, registerItem, sessionRef } =
        useProximityHover(containerRef);
    const activeRect = activeIndex === null ? null : (itemRects[activeIndex] ?? null);
    const contextValue = React.useMemo(() => ({ registerItem }), [registerItem]);

    return (
        <FluidListContext.Provider value={contextValue}>
            <div className={cn('relative', className)} ref={containerRef} {...handlers} {...props}>
                <AnimatePresence>
                    {activeRect ? (
                        <motion.div
                            className="pointer-events-none absolute inset-0"
                            exit={{ opacity: 0, transition: { duration: 0.06 } }}
                            key={sessionRef.current}
                        >
                            <motion.div
                                animate={{
                                    opacity: 1,
                                    top: activeRect.top,
                                    left: activeRect.left,
                                    width: activeRect.width,
                                    height: activeRect.height,
                                }}
                                className="absolute rounded-xl bg-hover"
                                initial={{
                                    opacity: 0,
                                    top: activeRect.top,
                                    left: activeRect.left,
                                    width: activeRect.width,
                                    height: activeRect.height,
                                }}
                                transition={{
                                    ...springs.fast,
                                    opacity: { duration: 0.08 },
                                }}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
                {children}
            </div>
        </FluidListContext.Provider>
    );
}

export function FluidListItem({
    children,
    className,
    index,
    ...props
}: React.ComponentPropsWithoutRef<'div'> & {
    index: number;
}) {
    const context = React.useContext(FluidListContext);

    return (
        <div
            className={cn('relative', className)}
            ref={(element) => context?.registerItem(index, element)}
            {...props}
        >
            {children}
        </div>
    );
}
