import type { TavernDesktopBridge } from './lib/desktop-bridge.ts';

declare global {
    interface Window {
        tavernDesktop?: TavernDesktopBridge;
    }
}
