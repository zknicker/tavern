import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CancelCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { DockEntryContext, dockGlideMs } from './dock-entry-context.ts';
import { buildTabOutlinePath, FOOT, TAB_H, TAB_W } from './geometry.ts';
import { useShell } from './shell-context.tsx';
import { TabDragContext } from './tab-drag-context.ts';
import type { TabItem } from './types.ts';
import { useWindowMoveHandle } from './use-window-move-handle.ts';

/** The active tab's white body + feet — just the fill (the hairline is the Outline). */
function TabShape({ width }: { width: number }) {
    const svgW = width + FOOT * 2;

    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-0 overflow-visible"
            height={TAB_H}
            style={{ left: -FOOT }}
            viewBox={`0 0 ${svgW} ${TAB_H}`}
            width={svgW}
        >
            <path d={`${buildTabOutlinePath(width)} L0 ${TAB_H} Z`} fill="var(--browser-card)" />
        </svg>
    );
}

/* --------------------------------------------------------------- tab body */

export function TabButton({ tab, active }: { tab: TabItem; active: boolean }) {
    const { actions, meta, state } = useShell();
    const width = tab.width ?? TAB_W;
    const closeable = tab.closeable ?? true;
    const favicon = meta.renderFavicon?.(tab) ?? null;
    // A window's only tab is a window-drag handle (Chrome): there is nothing to reorder or
    // tear off, so the JS handle (see SortableTab) drags the window itself — default
    // cursor, not the pointer hand of a clickable tab.
    const isOnlyTab = state.tabs.length === 1;

    return (
        <div
            className={cn(
                'no-drag group relative flex h-[34px] shrink-0 select-none',
                isOnlyTab ? 'cursor-default [&_button]:cursor-default' : null,
                active ? 'chrome-tab--active z-10 text-foreground' : 'text-muted-foreground',
                tab.tone === 'error' ? 'text-error' : null
            )}
            style={{ width, ...meta.tabStyle?.(tab) }}
        >
            {active ? (
                <TabShape width={width} />
            ) : (
                // Inset hover pill — vertically centered in the strip (top inset 3px
                // smaller than bottom to cancel the strip gap above the active tab).
                <span className="pointer-events-none absolute inset-x-[6px] top-[2px] bottom-[5px] rounded-[8px] bg-transparent transition-colors duration-150 group-hover:bg-[var(--browser-tab-hover)]" />
            )}
            {/* Full-tab click target: clicking anywhere on the tab body focuses it (not
                just the label band). Middle-click closes (Chrome); the mousedown
                preventDefault suppresses the OS autoscroll affordance. */}
            <button
                className="absolute inset-0 z-[1]"
                onAuxClick={(event) => {
                    if (event.button === 1 && closeable) {
                        event.preventDefault();
                        actions.close(tab.id);
                    }
                }}
                onClick={() => actions.setActive(tab.id)}
                onMouseDown={(event) => {
                    if (event.button === 1) {
                        event.preventDefault();
                    }
                }}
                title={tab.title}
                type="button"
            />
            {/* Visible content sits above the click target but passes clicks through to it;
                the close button re-enables pointer events. pb cancels the strip's 3px top
                gap so the favicon/label center in the whole strip (matching the hover pill). */}
            <div className="pointer-events-none relative z-[2] flex min-w-0 flex-1 items-center gap-2 pr-2 pb-[3px] pl-3">
                {favicon}
                <span className="min-w-0 flex-1 truncate text-[13px] leading-normal">
                    {tab.title}
                </span>
                {closeable ? (
                    <button
                        aria-label={`Close ${tab.title}`}
                        className="no-drag pointer-events-auto grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            actions.close(tab.id);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        type="button"
                    >
                        <Icon aria-hidden="true" className="size-3.5" icon={CancelCircleIcon} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

/* ----------------------------------------------------------- sortable item */

/**
 * dnd-kit translates this node while dragging/reordering. The dragged tab lifts above
 * its neighbours (z-30); the active tab sits above inactive ones so its feet overlap
 * them. Separators fade out during a drag to keep the motion clean. Pinned/transient
 * tabs pass `sortable: false` and stay put.
 *
 * `dockShift` (px) is set only while a tab from another window is docking: the tab slides
 * by that amount (with a transition) to open the gap, instead of dnd-kit driving it.
 */
export function SortableTab({
    tab,
    active,
    showSep,
    dockShift,
}: {
    tab: TabItem;
    active: boolean;
    showSep: boolean;
    dockShift?: number;
}) {
    const { state, actions, meta } = useShell();
    const isOnlyTab = state.tabs.length === 1;
    // A lone tab moves the window (not reorder/tear); pinned/transient tabs stay put.
    const dndDisabled = tab.sortable === false || isOnlyTab;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: tab.id,
        disabled: dndDisabled,
        // A pronounced, strong ease-out so the drop settles with a visible glide (not a snap).
        transition: { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    });
    // Skip the drag-handle props when dnd is off — otherwise dnd-kit marks the node
    // aria-disabled, which would disable the tab's buttons (e.g. close).
    const dragHandleProps = dndDisabled ? {} : { ...attributes, ...listeners };
    // A lone tab is a window-drag handle: dragging it moves (and can merge) the window.
    const onWindowMovePointerDown = useWindowMoveHandle(
        isOnlyTab && Boolean(actions.startWindowMove),
        React.useCallback(() => actions.startWindowMove?.(tab.id), [actions, tab.id]),
        React.useCallback(() => actions.finishWindowMove?.(), [actions])
    );
    // Lifted = being dragged, or settling through the drop animation. The overlay clone owns
    // the visible tab + the active styling (the shell-hairline anchor) for that whole window,
    // so this placeholder stays hidden and inactive and the hairline tracks the overlay.
    const draggingId = React.useContext(TabDragContext);
    const isLifted = isDragging || draggingId === tab.id;

    // A tab merged in from another window glides in from the release cursor (FLIP) rather
    // than popping — measure its settled slot, then animate from the cursor offset to zero.
    const dockEntry = React.useContext(DockEntryContext);
    const isDockEntering = dockEntry?.id === tab.id;
    const nodeRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
        (node: HTMLDivElement | null) => {
            setNodeRef(node);
            nodeRef.current = node;
        },
        [setNodeRef]
    );

    React.useLayoutEffect(() => {
        if (!(isDockEntering && dockEntry && nodeRef.current)) {
            return;
        }

        const rect = nodeRef.current.getBoundingClientRect();
        const offset = dockEntry.fromX - (rect.left + rect.right) / 2;

        if (Math.abs(offset) < 1) {
            return;
        }

        nodeRef.current.animate(
            [{ transform: `translateX(${offset}px)` }, { transform: 'translateX(0px)' }],
            { duration: dockGlideMs, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
        );
    }, [isDockEntering, dockEntry]);

    const tabNode = <TabButton active={active && !isLifted} tab={tab} />;
    // While docking, slide to open the gap (transitioned); otherwise dnd-kit owns the transform.
    const style =
        dockShift === undefined
            ? { transform: CSS.Translate.toString(transform), transition }
            : {
                  transform: `translate3d(${dockShift}px, 0, 0)`,
                  transition: 'transform 180ms ease',
              };

    return (
        <div
            className={cn(
                'flex touch-none items-end',
                // While lifted, the clone lives in the DragOverlay; the original stays as an
                // invisible placeholder so neighbours shift and the drop glides.
                isLifted ? 'opacity-0' : active ? 'z-10' : 'z-0'
            )}
            data-shell-tab=""
            onPointerDown={isOnlyTab ? onWindowMovePointerDown : undefined}
            ref={setRefs}
            style={style}
            {...dragHandleProps}
        >
            <span
                className={cn(
                    'h-[18px] w-px self-center bg-foreground/10 transition-opacity',
                    showSep && !state.dragging ? 'opacity-100' : 'opacity-0'
                )}
            />
            <div className={cn('flex items-end', isDockEntering ? null : 'chrome-tab-enter')}>
                {meta.renderTabWrapper ? meta.renderTabWrapper(tab, tabNode) : tabNode}
            </div>
        </div>
    );
}
