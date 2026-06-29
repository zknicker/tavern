import type { ReactNode, RefObject } from 'react';
import type { OutlineGeometry } from './geometry.ts';

/* ------------------------------------------------------------------ models */

export type TabId = string;

/**
 * One Chrome-style tab. The shell renders the silhouette, hover pill, separators,
 * and drag behavior; the host fills the favicon/title/close/context-menu slots via
 * these fields plus the render hooks in {@link TabsMeta}.
 */
export interface TabItem {
    /** true while this tab has a running turn (shows a spinner favicon) */
    busy?: boolean;
    /** false → no close affordance and the tab is not drag-reorderable */
    closeable?: boolean;
    id: TabId;
    /** the route this tab currently shows (a browser-style page container) */
    route?: string;
    /** false → fixed position (pinned/transient tabs do not reorder) */
    sortable?: boolean;
    title: string;
    /** error tone (e.g. a failed draft) */
    tone?: 'default' | 'error';
    /** rendered tab body width (px); falls back to the shell default when omitted */
    width?: number;
}

/* -------------------------------------------------- context contract (DI) */

/** A tab being dragged in from another window, hovering this window's strip. */
export interface DockPreview {
    /** the incoming tab's route */
    route: string;
    /** the incoming tab's resolved title (host-supplied) */
    title: string;
    /** cursor x within this window (CSS px from the window's left edge) */
    x: number;
}

export interface TabsState {
    activeId: TabId | null;
    /** an incoming tab from another window hovering this strip (Chrome-style merge drag) */
    dockPreview: DockPreview | null;
    /** true while a tab is being dragged */
    dragging: boolean;
    tabs: TabItem[];
}

export interface TabsActions {
    add: () => void;
    close: (id: TabId) => void;
    /** Commit a tear-off on release (the tab already left; main keeps/re-attaches it). */
    finishTearOff?: () => void;
    /** Release a lone-tab window move: merge into a strip under the cursor, else stay put. */
    finishWindowMove?: () => void;
    /** Detach a tab into its own window. Absent outside the desktop app. */
    openInNewWindow?: (id: TabId) => void;
    reorder: (activeId: TabId, overId: TabId) => void;
    setActive: (id: TabId) => void;
    setDragging: (dragging: boolean) => void;
    /** Begin tearing a tab out: remove it here and spawn a window that follows the cursor. */
    startTearOff?: (id: TabId) => void;
    /** Begin moving this window by its only tab (and merge it onto another window's strip). */
    startWindowMove?: (id: TabId) => void;
}

export interface TabsMeta {
    /** attached to the shell frame; geometry is measured against it */
    frameRef: RefObject<HTMLDivElement | null>;
    /** re-measure the active-tab/shell geometry (called on layout + drag) */
    measure: () => void;
    outline: OutlineGeometry | null;
    /** host-supplied favicon for a tab (spinner, pinned, temporary, …) */
    renderFavicon?: (tab: TabItem) => ReactNode;
    /** host-supplied wrapper (e.g. a context menu) around a rendered tab */
    renderTabWrapper?: (tab: TabItem, node: ReactNode) => ReactNode;
    /** inline style applied to a tab (e.g. pinned color tokens) */
    tabStyle?: (tab: TabItem) => React.CSSProperties | undefined;
}

export interface TabsContextValue {
    actions: TabsActions;
    meta: TabsMeta;
    state: TabsState;
}
