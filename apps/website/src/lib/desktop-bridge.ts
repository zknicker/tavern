export type DesktopUpdateBridgeStatus =
    | { phase: 'unsupported' }
    | { phase: 'checking' }
    | { phase: 'current' }
    | { phase: 'available'; version: string }
    | { phase: 'downloading'; progress: number; version: string }
    | { phase: 'ready'; version: string }
    | { phase: 'error'; message: string };

export type DesktopEditCommand = 'copy' | 'cut' | 'paste' | 'redo' | 'selectAll' | 'undo';

export interface TavernDesktopBridge {
    checkForUpdate: () => Promise<void>;
    closeWindow: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    ensureServerOrigin: () => Promise<string>;
    getInfo: () => Promise<{ isPackaged: boolean; platform: NodeJS.Platform; version: string }>;
    /** Release happened over this window's strip: commit the docked ghost tab as real. */
    onDockCommit: (listener: (route: string) => void) => () => void;
    /** The dragged tab left this window's strip: drop the ghost preview. */
    onDockLeave: (listener: (route: string) => void) => () => void;
    /** The dragged tab is hovering this window's strip: show/move a ghost tab at `x`. */
    onDockUpdate: (listener: (payload: { route: string; x: number }) => void) => () => void;
    /** A tab was re-attached to this window (dropped on its strip): open the route here. */
    onOpenTab: (listener: (route: string) => void) => () => void;
    onUpdateStatus: (listener: (status: DesktopUpdateBridgeStatus) => void) => () => void;
    openWindow: (route: string) => Promise<void>;
    restartForUpdate: () => Promise<void>;
    runEditCommand: (command: DesktopEditCommand) => Promise<void>;
    /** Abort the self-move (window stays put). */
    selfMoveCancel: () => Promise<void>;
    /** Released: merge into a strip under the cursor, else leave the window where dropped. */
    selfMoveFinish: () => Promise<void>;
    /** Move this window itself (its only tab) following the cursor; merge on a strip drop. */
    selfMoveStart: (route: string) => Promise<void>;
    setTheme: (theme: 'dark' | 'light' | null) => Promise<void>;
    startWindowDrag: () => Promise<void>;
    /** Abort the tear-off, closing the spawned window (the tab was dragged back). */
    tearOffCancel: () => Promise<void>;
    /** Drop the torn-off window where it is (the drag was released). */
    tearOffFinish: () => Promise<void>;
    /** Spawn a window seeded at `route` that follows the cursor while a tab is torn off. */
    tearOffStart: (route: string) => Promise<void>;
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
