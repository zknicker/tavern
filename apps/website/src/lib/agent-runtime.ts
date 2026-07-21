import { getDesktopBridge, isElectronDesktopApp } from './desktop-bridge.ts';

const desktopServerOrigin = 'http://127.0.0.1:3180';
const sidecarStartupDeadlineMs = 10_000;
const sidecarStartupPollMs = 200;

let desktopAgentRuntimePromise: Promise<string> | null = null;

export function isPackagedDesktopApp() {
    if (!(isElectronDesktopApp() && typeof window !== 'undefined')) {
        return false;
    }

    return window.location.protocol === 'file:';
}

export function getConfiguredServerOrigin() {
    return import.meta.env.VITE_SERVER_ORIGIN || null;
}

export function getTavernRuntimeOrigin() {
    if (isPackagedDesktopApp()) {
        return desktopServerOrigin;
    }

    return getConfiguredServerOrigin() ?? window.location.origin;
}

export async function ensureDesktopServerOrigin(): Promise<string> {
    if (!isPackagedDesktopApp()) {
        return getConfiguredServerOrigin() ?? '';
    }

    desktopAgentRuntimePromise ??= startDesktopSidecar();

    return desktopAgentRuntimePromise;
}

async function startDesktopSidecar() {
    const bridge = getDesktopBridge();

    if (bridge) {
        const info = await bridge.getInfo();

        if (!info.isPackaged) {
            return getConfiguredServerOrigin() ?? '';
        }

        const origin = await bridge.ensureServerOrigin();
        return origin || desktopServerOrigin;
    }

    await waitForSidecarHealth();
    return desktopServerOrigin;
}

async function waitForSidecarHealth() {
    const deadline = Date.now() + sidecarStartupDeadlineMs;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${desktopServerOrigin}/healthz`);

            if (response.ok) {
                return;
            }
        } catch {}

        await new Promise((resolve) => {
            window.setTimeout(resolve, sidecarStartupPollMs);
        });
    }

    throw new Error('Grotto desktop backend did not become healthy in time.');
}
