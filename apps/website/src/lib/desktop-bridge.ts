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
    downloadUpdate: () => Promise<void>;
    ensureServerOrigin: () => Promise<string>;
    getInfo: () => Promise<{ isPackaged: boolean; platform: NodeJS.Platform; version: string }>;
    onUpdateStatus: (listener: (status: DesktopUpdateBridgeStatus) => void) => () => void;
    restartForUpdate: () => Promise<void>;
    runEditCommand: (command: DesktopEditCommand) => Promise<void>;
    setTheme: (theme: 'dark' | 'light' | null) => Promise<void>;
    startWindowDrag: () => Promise<void>;
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
