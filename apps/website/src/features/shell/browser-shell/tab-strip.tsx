import {
    closestCenter,
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import type { ReactNode, RefObject } from 'react';
import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { computeDockInsertIndex } from './dock-preview.ts';
import { TAB_W } from './geometry.ts';
import { useShell } from './shell-context.tsx';
import { SortableTab, TabButton } from './tab.tsx';
import { TabDragContext } from './tab-drag-context.ts';
import { shouldTearOff, TEAR_OFF_THRESHOLD_PX } from './tear-off.ts';
import type { DockPreview, TabItem } from './types.ts';

// Slides the lifted tab from the release point to its slot (a portal overlay, so the list
// reordering underneath doesn't collapse the animation distance into an instant snap).
const tabDropAnimation = { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

/**
 * The tab strip row. Owns the drag-and-drop context: tabs reorder, snap to the x-axis,
 * and focus on pick-up — like Chrome. A 5px activation distance keeps plain clicks (and
 * the close button) working. Dragging a tab out of the strip lifts it into its own window
 * that follows the cursor live (desktop only); dragging back cancels. Compose the strip
 * contents as children.
 */
export function TabStrip({ children, className }: { children: ReactNode; className?: string }) {
    const { actions, state } = useShell();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const stripRef = React.useRef<HTMLDivElement>(null);
    const activeDragId = React.useRef<string | null>(null);
    // The lifted tab, rendered in the drag overlay so the drop animates as a glide.
    const [activeDragTab, setActiveDragTab] = React.useState<TabItem | null>(null);
    // The lifted tab's id, held through the drop animation so its placeholder stays hidden.
    const [draggingId, setDraggingId] = React.useState<string | null>(null);
    const dropTimer = React.useRef<number | undefined>(undefined);
    // Tearing removes the dragged tab (ending the dnd drag), so the release is detected by
    // our own pointer listeners — the OS keeps delivering them to this window via its drag
    // grab even once the cursor (and the following window) leave the strip.
    const tearing = React.useRef(false);
    const moveRef = React.useRef<(event: PointerEvent) => void>(() => undefined);
    const upRef = React.useRef<(event: PointerEvent) => void>(() => undefined);

    const stopTracking = React.useCallback(() => {
        window.removeEventListener('pointermove', moveRef.current, true);
        window.removeEventListener('pointerup', upRef.current, true);
    }, []);

    React.useEffect(() => () => window.clearTimeout(dropTimer.current), []);

    return (
        <TabDragContext.Provider value={draggingId}>
            <div className={cn('relative flex items-end gap-1', className)} ref={stripRef}>
                <DndContext
                    collisionDetection={closestCenter}
                    modifiers={[restrictToHorizontalAxis]}
                    onDragCancel={() => {
                        actions.setDragging(false);
                        setActiveDragTab(null);

                        // A cancel fired by our own tab removal is part of a tear — leave the
                        // pointer listeners running until release. A real cancel cleans up.
                        if (tearing.current) {
                            setDraggingId(null);
                        } else {
                            stopTracking();
                            endDrop();
                        }
                    }}
                    onDragEnd={({ active, over }) => {
                        actions.setDragging(false);
                        setActiveDragTab(null);

                        // When tearing, the drag was already cancelled by the removal, so this
                        // only runs for in-strip releases → reorder.
                        if (tearing.current) {
                            setDraggingId(null);
                            return;
                        }

                        stopTracking();

                        if (over && active.id !== over.id) {
                            actions.reorder(String(active.id), String(over.id));
                        }

                        endDrop();
                    }}
                    onDragStart={({ active }) => {
                        window.clearTimeout(dropTimer.current);
                        actions.setDragging(true);
                        actions.setActive(String(active.id)); // focus, like Chrome
                        activeDragId.current = String(active.id);
                        setActiveDragTab(
                            state.tabs.find((tab) => tab.id === String(active.id)) ?? null
                        );
                        setDraggingId(String(active.id));
                        tearing.current = false;

                        // Capture phase so dnd-kit can't swallow the events.
                        moveRef.current = (event) => evaluateTearOff(event);
                        upRef.current = () => finishGesture();
                        window.addEventListener('pointermove', moveRef.current, true);
                        window.addEventListener('pointerup', upRef.current, true);
                    }}
                    sensors={sensors}
                >
                    {children}
                    <DragOverlay
                        dropAnimation={tabDropAnimation}
                        modifiers={[restrictToHorizontalAxis]}
                    >
                        {activeDragTab ? (
                            <div data-tab-overlay="">
                                <TabButton active tab={activeDragTab} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
                {state.dockPreview ? <DockPreviewTab preview={state.dockPreview} /> : null}
            </div>
        </TabDragContext.Provider>
    );

    function endDrop() {
        // Hold the lifted id through the drop glide so the placeholder reveals only once the
        // overlay has settled into its slot (matching the drop-animation duration).
        window.clearTimeout(dropTimer.current);
        dropTimer.current = window.setTimeout(() => setDraggingId(null), tabDropAnimation.duration);
    }

    function evaluateTearOff(event: PointerEvent) {
        if (!actions.startTearOff) {
            return; // not the desktop app
        }

        const strip = stripRef.current?.getBoundingClientRect();
        const id = activeDragId.current;

        if (!(strip && id)) {
            return;
        }

        const point = { x: event.clientX, y: event.clientY };

        // Once torn out, the main process owns the gesture (follow / dock / re-attach), so
        // there's nothing more to do here until release.
        if (!tearing.current && shouldTearOff(point, strip, TEAR_OFF_THRESHOLD_PX)) {
            tearing.current = true;
            // Measure the grab point from the live overlay (still mounted) before clearing it.
            const cursorOffset = tearCursorOffset(event, strip);
            actions.startTearOff(id, cursorOffset); // removes the tab here → dnd drag cancels
            // The OS-level torn window now owns the visual — drop our in-strip overlay so it
            // doesn't linger as a ghost copy in the source window.
            window.clearTimeout(dropTimer.current);
            setActiveDragTab(null);
            setDraggingId(null);
        }
    }

    // The cursor's px offset from the torn window's top-left, so the tab stays exactly where
    // it was grabbed: the strip's left inset (= the new window's first/only tab) plus how far
    // into the lifted tab the cursor sits, and the tab's vertical middle.
    function tearCursorOffset(event: PointerEvent, strip: DOMRect) {
        const node = stripRef.current;
        const overlay = node?.querySelector('[data-tab-overlay]')?.getBoundingClientRect();
        const inset = node ? Number.parseFloat(getComputedStyle(node).paddingLeft) || 0 : 0;
        const grabX = overlay ? event.clientX - overlay.left : TAB_W / 2;
        const top = overlay ? overlay.top : strip.top;

        return { x: strip.left + inset + grabX, y: top + 17 };
    }

    function finishGesture() {
        if (tearing.current) {
            tearing.current = false;
            actions.finishTearOff?.();
            setActiveDragTab(null);
            setDraggingId(null);
        }

        stopTracking();
    }
}

/**
 * The sortable list of tabs. The 3px gap above the active tab lives on this container
 * (not the strip padding) so every self-centered slot lines up with the tab labels.
 * While a tab is dragged in from another window, it anchors into the strip as a real
 * active tab at the insertion point (Chrome): the existing tabs deactivate and part to
 * make room, and the shell hairline traces the incoming tab.
 */
export function TabList() {
    const { state, meta } = useShell();
    const { tabs, activeId, dockPreview } = state;
    const dockIndex = useDockGapIndex(meta.frameRef, dockPreview?.x ?? null);

    return (
        <div className="mt-[3px] flex min-w-0 items-end">
            <SortableContext
                items={tabs.map((tab) => tab.id)}
                strategy={horizontalListSortingStrategy}
            >
                {tabs.map((tab, index) => {
                    const prev = tabs[index - 1];
                    // The raised (active) tab is the docked preview while merging, else the
                    // active tab. Hide the separator wherever it touches that raised tab.
                    const showSep =
                        index > 0 &&
                        (dockPreview
                            ? index !== dockIndex
                            : tab.id !== activeId && prev?.id !== activeId);

                    // While docking, tabs at/after the insertion point slide right to open the
                    // gap; the incoming tab follows the cursor as an overlay.
                    let dockShift: number | undefined;
                    if (dockPreview && dockIndex !== null) {
                        dockShift = index >= dockIndex ? TAB_W : 0;
                    }

                    return (
                        <SortableTab
                            active={dockPreview === null && tab.id === activeId}
                            dockShift={dockShift}
                            key={tab.id}
                            showSep={showSep}
                            tab={tab}
                        />
                    );
                })}
            </SortableContext>
        </div>
    );
}

/**
 * The tab being merged in from another window, rendered as a real active tab that follows
 * the cursor (an overlay, like dnd-kit's dragged item). The existing tabs slide apart
 * around it via `dockShift`, and the shell hairline traces it (it carries the active class).
 * It carries no `data-shell-tab` so the dock insertion math ignores it.
 */
function DockPreviewTab({ preview }: { preview: DockPreview }) {
    return (
        <div
            className="pointer-events-none absolute bottom-0 z-50 -translate-x-1/2"
            style={{ left: preview.x }}
        >
            <TabButton
                active
                tab={{
                    id: '__dock-preview__',
                    route: preview.route,
                    title: preview.title,
                    closeable: false,
                    sortable: false,
                }}
            />
        </div>
    );
}

/** The visual insertion index for the current dock-drag x, or null when not docking. */
function useDockGapIndex(frameRef: RefObject<HTMLDivElement | null>, x: number | null) {
    const [index, setIndex] = React.useState<number | null>(null);

    React.useLayoutEffect(() => {
        setIndex(x === null ? null : computeDockInsertIndex(frameRef.current, x));
    }, [frameRef, x]);

    return index;
}

/** Pushes following strip slots to the right edge. */
export function Spacer() {
    return <div className="flex-1" />;
}
