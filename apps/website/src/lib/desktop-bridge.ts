export type DesktopUpdateBridgeStatus =
    | { phase: 'unsupported' }
    | { phase: 'checking' }
    | { phase: 'current' }
    | { phase: 'available'; version: string }
    | { phase: 'downloading'; progress: number; version: string }
    | { phase: 'ready'; version: string }
    | { phase: 'error'; message: string };

export type DesktopEditCommand = 'copy' | 'cut' | 'paste' | 'redo' | 'selectAll' | 'undo';

/** A tab owned by the main process: a stable id and the route its content view shows. */
export interface DesktopTab {
    id: string;
    route: string;
}

export interface DesktopTabsState {
    activeId: string | null;
    tabs: DesktopTab[];
}

export interface TavernDesktopBridge {
    /** Chrome → main: make a tab the active (visible) one. */
    activateTab: (tabId: string) => Promise<void>;
    checkForUpdate: () => Promise<void>;
    /** Chrome → main: close a tab (closes the window if it was the last). */
    closeTab: (tabId: string) => Promise<void>;
    closeWindow: () => Promise<void>;
    /** Chrome → main: open a new tab at a route and activate it. */
    createTab: (route: string) => Promise<void>;
    /** Chrome → main: the insertion index where a docking tab should land in this strip. */
    dockSetIndex: (index: number) => Promise<void>;
    downloadUpdate: () => Promise<void>;
    ensureServerOrigin: () => Promise<string>;
    getInfo: () => Promise<{ isPackaged: boolean; platform: NodeJS.Platform; version: string }>;
    /** Chrome → main: the current tab list (for the chrome's initial render). */
    getTabs: () => Promise<DesktopTabsState>;
    /** Chrome → main: navigate the active tab's content view to a route (client-side, no reload). */
    navigateActiveView: (route: string) => Promise<void>;
    /** Release happened over this window's strip: commit the docked ghost tab as real. */
    onDockCommit: (listener: (route: string) => void) => () => void;
    /** The dragged tab left this window's strip: drop the ghost preview. */
    onDockLeave: (listener: (route: string) => void) => () => void;
    /** The dragged tab is hovering this window's strip: show/move a ghost tab at `x`. */
    onDockUpdate: (listener: (payload: { route: string; x: number }) => void) => () => void;
    /** Main → content: the chrome asked this view to navigate to a route. */
    onNavigateTo: (listener: (route: string) => void) => () => void;
    /** A tab was re-attached to this window (dropped on its strip): open the route here. */
    onOpenTab: (listener: (route: string) => void) => () => void;
    /** Main → chrome: the tab list or active tab changed. */
    onTabsChanged: (listener: (state: DesktopTabsState) => void) => () => void;
    onUpdateStatus: (listener: (status: DesktopUpdateBridgeStatus) => void) => () => void;
    openWindow: (route: string) => Promise<void>;
    /** Chrome → main: set the tab order. */
    reorderTabs: (orderedIds: string[]) => Promise<void>;
    restartForUpdate: () => Promise<void>;
    runEditCommand: (command: DesktopEditCommand) => Promise<void>;
    /** Abort the self-move (window stays put). */
    selfMoveCancel: () => Promise<void>;
    /** Released: merge into a strip under the cursor, else leave the window where dropped. */
    selfMoveFinish: () => Promise<void>;
    /** Move this window itself (its only tab) following the cursor; merge on a strip drop. */
    selfMoveStart: (route: string) => Promise<void>;
    /** Chrome → main: the live bounds of the content card where the active view sits. */
    setContentBounds: (bounds: {
        height: number;
        width: number;
        x: number;
        y: number;
    }) => Promise<void>;
    setTheme: (theme: 'dark' | 'light' | null) => Promise<void>;
    startWindowDrag: () => Promise<void>;
    /** 'chrome' = the tab-strip window; 'content' = a per-tab page view; null = legacy single renderer. */
    surface: 'chrome' | 'content' | null;
    /** Abort the tear-off, closing the spawned window (the tab was dragged back). */
    tearOffCancel: () => Promise<void>;
    /** Drop the torn-off window where it is (the drag was released). */
    tearOffFinish: () => Promise<void>;
    /**
     * Spawn a window for a torn-off tab that follows the cursor. `payload` is the tab id
     * (WebContentsView model) or route (legacy); `cursorOffset` keeps the tab under the
     * cursor exactly where it was grabbed.
     */
    tearOffStart: (payload: string, cursorOffset?: { x: number; y: number }) => Promise<void>;
}

export function getDesktopBridge() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.tavernDesktop ?? null;
}

export function isElectronDesktopApp() {
    return getDesktopBridge() !== null;
}

/**
 * Which surface this renderer is: the 'chrome' window (tab strip + toolbar), a 'content'
 * per-tab page view, or `null` in the browser (one renderer hosts everything, as before).
 */
export function getDesktopSurface(): 'chrome' | 'content' | null {
    return getDesktopBridge()?.surface ?? null;
}
