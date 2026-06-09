import { AnimatePresence, motion } from 'framer-motion';
import {
    Children,
    type ComponentPropsWithoutRef,
    type CSSProperties,
    cloneElement,
    createContext,
    forwardRef,
    type HTMLAttributes,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type Ref,
    type TdHTMLAttributes,
    type ThHTMLAttributes,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import { useProximityHover } from '../../hooks/use-proximity-hover.ts';
import { fontWeights } from '../../lib/font-weight.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';

interface TableContextValue {
    activeIndex: number | null;
    registerItem: (index: number, element: HTMLElement | null) => void;
}

const TableContext = createContext<TableContextValue | null>(null);

type TableProps = ComponentPropsWithoutRef<'table'> & {
    variant?: 'default' | 'card';
};

const Table = forwardRef<HTMLTableElement, TableProps>(
    ({ children, className, variant = 'default', ...props }, ref): ReactElement => {
        const containerRef = useRef<HTMLDivElement>(null);
        const { activeIndex, itemRects, sessionRef, handlers, registerItem, measureItems } =
            useProximityHover(containerRef);

        useEffect(() => {
            measureItems();
        }, [measureItems]);

        useEffect(() => {
            const container = containerRef.current;

            if (!container) {
                return;
            }

            container.addEventListener('mouseenter', handlers.onMouseEnter);
            container.addEventListener('mousemove', handlers.onMouseMove);
            container.addEventListener('mouseleave', handlers.onMouseLeave);

            return () => {
                container.removeEventListener('mouseenter', handlers.onMouseEnter);
                container.removeEventListener('mousemove', handlers.onMouseMove);
                container.removeEventListener('mouseleave', handlers.onMouseLeave);
            };
        }, [handlers.onMouseEnter, handlers.onMouseLeave, handlers.onMouseMove]);

        const contextValue = useMemo(
            () => ({ activeIndex, registerItem }),
            [activeIndex, registerItem]
        );
        const activeRect = activeIndex === null ? null : itemRects[activeIndex];

        return (
            <TableContext.Provider value={contextValue}>
                <div
                    className="relative w-full overflow-x-auto"
                    data-slot="table-container"
                    data-variant={variant}
                    ref={containerRef}
                >
                    <AnimatePresence>
                        {activeRect ? (
                            <motion.div
                                className="pointer-events-none absolute inset-0 overflow-hidden"
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
                                    className="absolute bg-hover"
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
                    <table
                        className={cn('w-full caption-bottom border-collapse text-sm', className)}
                        data-slot="table"
                        ref={ref}
                        {...props}
                    >
                        {children}
                    </table>
                </div>
            </TableContext.Provider>
        );
    }
);
Table.displayName = 'Table';

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref): ReactElement => (
        <thead className={className} data-slot="table-header" ref={ref} {...props} />
    )
);
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
    ({ children, className, ...props }, ref): ReactElement => (
        <tbody className={className} data-slot="table-body" ref={ref} {...props}>
            {assignRowIndexes(children)}
        </tbody>
    )
);
TableBody.displayName = 'TableBody';

const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref): ReactElement => (
        <tfoot
            className={cn('border-border/60 border-t font-medium', className)}
            data-slot="table-footer"
            ref={ref}
            {...props}
        />
    )
);
TableFooter.displayName = 'TableFooter';

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
    index?: number;
}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
    ({ index, className, style, ...props }, ref): ReactElement => {
        const internalRef = useRef<HTMLTableRowElement>(null);
        const context = useContext(TableContext);

        useEffect(() => {
            if (index === undefined || !context) {
                return;
            }

            context.registerItem(index, internalRef.current);

            return () => {
                context.registerItem(index, null);
            };
        }, [context, index]);

        const isBodyRow = index !== undefined;
        const activeIndex = context?.activeIndex ?? null;
        const hideBorder =
            activeIndex !== null &&
            ((isBodyRow && (index === activeIndex || index === activeIndex - 1)) ||
                (!isBodyRow && activeIndex === 0));

        return (
            <tr
                className={cn(
                    'group/row relative z-10 border-b transition-[border-color] duration-100 data-[state=selected]:bg-active',
                    hideBorder ? 'border-transparent' : 'border-border/60',
                    isBodyRow && activeIndex === index && 'is-active',
                    className
                )}
                data-proximity-index={index}
                data-slot="table-row"
                ref={(node) => {
                    internalRef.current = node;
                    assignRef(ref, node);
                }}
                style={withFontVariation(
                    style,
                    isBodyRow ? fontWeights.normal : fontWeights.semibold
                )}
                {...props}
            />
        );
    }
);
TableRow.displayName = 'TableRow';

const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref): ReactElement => (
        <th
            className={cn(
                'h-10 whitespace-nowrap px-3 py-2 text-left align-middle font-medium text-foreground leading-none has-[[role=checkbox]]:w-px has-[[role=checkbox]]:pe-0',
                className
            )}
            data-slot="table-head"
            ref={ref}
            {...props}
        />
    )
);
TableHead.displayName = 'TableHead';

const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref): ReactElement => (
        <td
            className={cn(
                'whitespace-nowrap px-3 py-2 align-middle text-muted-foreground leading-none transition-colors duration-100 group-[.is-active]/row:text-foreground has-[[role=checkbox]]:pe-0',
                className
            )}
            data-slot="table-cell"
            ref={ref}
            {...props}
        />
    )
);
TableCell.displayName = 'TableCell';

const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
    ({ className, ...props }, ref): ReactElement => (
        <caption
            className={cn('mt-4 text-muted-foreground text-sm', className)}
            data-slot="table-caption"
            ref={ref}
            {...props}
        />
    )
);
TableCaption.displayName = 'TableCaption';

function assignRowIndexes(children: ReactNode): ReactNode {
    return Children.map(children, (child, index) => {
        if (!isValidElement<TableRowProps>(child) || child.type !== TableRow) {
            return child;
        }

        return cloneElement(child, {
            index: child.props.index ?? index,
        });
    });
}

function assignRef<T>(ref: Ref<T> | undefined, value: T): void {
    if (typeof ref === 'function') {
        ref(value);
        return;
    }

    if (ref) {
        ref.current = value;
    }
}

function withFontVariation(
    style: CSSProperties | undefined,
    fontVariationSettings: string
): CSSProperties {
    return {
        ...style,
        fontVariationSettings,
    };
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption };
