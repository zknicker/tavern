const desktopServerOrigin = 'http://127.0.0.1:3180';
const sidecarStartupDeadlineMs = 10_000;
const sidecarStartupPollMs = 200;

let desktopAgentRuntimePromise: Promise<string> | null = null;

export function isPackagedTauriApp() {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.location.protocol === 'tauri:' || window.location.host === 'tauri.localhost';
}

export function getConfiguredServerOrigin() {
    return import.meta.env.VITE_SERVER_ORIGIN || null;
}

export function getTavernRuntimeOrigin() {
    if (isPackagedTauriApp()) {
        return desktopServerOrigin;
    }

    return getConfiguredServerOrigin() ?? window.location.origin;
}

export async function ensureDesktopServerOrigin(): Promise<string> {
    if (!isPackagedTauriApp()) {
        return getConfiguredServerOrigin() ?? '';
    }

    desktopAgentRuntimePromise ??= startDesktopSidecar();

    return desktopAgentRuntimePromise;
}

async function startDesktopSidecar() {
    const [{ homeDir, join }, { Command }] = await Promise.all([
        import('@tauri-apps/api/path'),
        import('@tauri-apps/plugin-shell'),
    ]);
    const databasePath = await join(await homeDir(), '.tavern', 'tavern.sqlite');
    const command = Command.sidecar('binaries/tavern-server', [
        '--app-origin',
        window.location.origin,
        '--database-path',
        databasePath,
        '--server-port',
        '3180',
    ]);

    await command.spawn();
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

    throw new Error('Tavern desktop backend did not become healthy in time.');
}
