import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { springs } from '../../lib/springs.ts';

interface ToolRowHoverContextValue {
    activateItem: (index: number) => void;
    registerItem: (index: number, element: HTMLElement | null) => void;
}

const ToolRowHoverContext = React.createContext<ToolRowHoverContextValue | null>(null);
const toolRowHoverIndexAttribute = 'data-tool-row-hover-index';

export function ToolRowHoverRoot({
    children,
    value,
}: {
    children: React.ReactNode;
    value: ToolRowHoverContextValue | null;
}) {
    return React.createElement(ToolRowHoverContext.Provider, { value }, children);
}

export function useToolRowHoverGroup({
    enabled,
    headerRef,
    measureKey,
}: {
    enabled: boolean;
    headerRef: React.RefObject<HTMLButtonElement | null>;
    measureKey: string;
}) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const itemsRef = React.useRef(new Map<number, HTMLElement>());
    const activeIndexRef = React.useRef<number | null>(null);
    const sessionRef = React.useRef(0);
    const [activeRect, setActiveRect] = React.useState<ToolRowRect | null>(null);
    const measureItem = React.useCallback((index: number) => {
        const container = containerRef.current;
        const item = itemsRef.current.get(index);

        if (!(container && item)) {
            return null;
        }

        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        return {
            height: itemRect.height,
            left: itemRect.left - containerRect.left + container.scrollLeft,
            top: itemRect.top - containerRect.top + container.scrollTop,
            width: itemRect.width,
        };
    }, []);

    const activateItem = React.useCallback(
        (index: number) => {
            const nextRect = measureItem(index);

            if (!nextRect) {
                return;
            }

            if (activeIndexRef.current === null) {
                sessionRef.current += 1;
            }

            activeIndexRef.current = index;
            setActiveRect(nextRect);
        },
        [measureItem]
    );

    const clearActiveItem = React.useCallback(() => {
        activeIndexRef.current = null;
        setActiveRect(null);
    }, []);

    const registerItem = React.useCallback(
        (index: number, element: HTMLElement | null) => {
            if (element) {
                itemsRef.current.set(index, element);
            } else {
                itemsRef.current.delete(index);
            }

            if (activeIndexRef.current === index) {
                setActiveRect(element ? measureItem(index) : null);
            }
        },
        [measureItem]
    );

    const contextValue = React.useMemo(
        () => ({ activateItem, registerItem }),
        [activateItem, registerItem]
    );

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const container = containerRef.current;

        if (!container) {
            return;
        }

        const activateFromTarget = (target: EventTarget | null) => {
            const element =
                target instanceof Element
                    ? target.closest(`[${toolRowHoverIndexAttribute}]`)
                    : null;
            const value = element?.getAttribute(toolRowHoverIndexAttribute);
            const index = value ? Number.parseInt(value, 10) : Number.NaN;

            if (Number.isFinite(index)) {
                activateItem(index);
            }
        };

        const handleMouseOver = (event: MouseEvent) => activateFromTarget(event.target);
        const handleFocusIn = (event: FocusEvent) => activateFromTarget(event.target);

        container.addEventListener('mouseover', handleMouseOver);
        container.addEventListener('focusin', handleFocusIn);
        container.addEventListener('mouseleave', clearActiveItem);

        return () => {
            container.removeEventListener('mouseover', handleMouseOver);
            container.removeEventListener('focusin', handleFocusIn);
            container.removeEventListener('mouseleave', clearActiveItem);
        };
    }, [activateItem, clearActiveItem, enabled]);

    const registerHeader = React.useCallback(
        (element: HTMLButtonElement | null) => {
            headerRef.current = element;
        },
        [headerRef]
    );

    React.useEffect(() => {
        if (enabled && measureKey.length > 0 && activeIndexRef.current !== null) {
            setActiveRect(measureItem(activeIndexRef.current));
        }
    }, [enabled, measureItem, measureKey]);

    return {
        clearActiveItem,
        containerRef,
        contextValue: enabled ? contextValue : null,
        hoverLayer: enabled
            ? React.createElement(ToolRowHoverHighlight, {
                  activeRect,
                  sessionKey: sessionRef.current,
              })
            : null,
        registerHeader,
    };
}

export function useToolRowHoverItem(index: number) {
    const context = React.useContext(ToolRowHoverContext);

    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            context?.registerItem(index, element);
        },
        [context, index]
    );

    return {
        dataIndex: context ? index : undefined,
        hasSharedHover: Boolean(context),
        ref,
    };
}

interface ToolRowRect {
    height: number;
    left: number;
    top: number;
    width: number;
}

function ToolRowHoverHighlight({
    activeRect,
    sessionKey,
}: {
    activeRect: ToolRowRect | null;
    sessionKey: number;
}) {
    if (!activeRect) {
        return null;
    }

    return React.createElement(
        AnimatePresence,
        null,
        React.createElement(
            motion.div,
            {
                'aria-hidden': 'true',
                className: 'pointer-events-none absolute inset-0 z-0 overflow-hidden',
                exit: { opacity: 0, transition: { duration: 0.06 } },
                key: sessionKey,
            },
            React.createElement(motion.div, {
                animate: {
                    opacity: 1,
                    top: activeRect.top,
                    left: activeRect.left,
                    width: activeRect.width,
                    height: activeRect.height,
                },
                className: 'absolute rounded-md bg-surface-1',
                initial: {
                    opacity: 0,
                    top: activeRect.top,
                    left: activeRect.left,
                    width: activeRect.width,
                    height: activeRect.height,
                },
                transition: {
                    ...springs.fast,
                    opacity: { duration: 0.08 },
                },
            })
        )
    );
}
