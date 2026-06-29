'use strict';

const { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen, shell } = require('electron');
const path = require('node:path');
const { spawn, execFile, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const electronUpdater = require('electron-updater');
const { registerEditContextMenuHandlers } = require('./edit-context-menu.cjs');
const { registerExternalLinkHandlers } = require('./external-link-handlers.cjs');
const {
    buildDevWindowUrl,
    findReattachTarget,
    isSafeWindowRoute,
    nextWindowBounds,
} = require('./window-routing.cjs');

// A broken stdout/stderr pipe (e.g. the dev launcher's reader went away, or a logging
// library writes after the pipe closed) must never crash the app with an uncaught EPIPE.
for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (error) => {
        if (error.code !== 'EPIPE') {
            throw error;
        }
    });
}

const desktopServerOrigin = 'http://127.0.0.1:3180';
const sidecarStartupDeadlineMs = 10_000;
const sidecarStartupPollMs = 200;
const updateCheckIntervalMs = 10 * 60 * 1000;
const openDevtoolsMenuId = 'open-devtools';
const topbarHeightPx = 38;
const macosTrafficLightDiameterPx = 12;
const macosTrafficLightPosition = {
    x: 17,
    y: (topbarHeightPx - macosTrafficLightDiameterPx) / 2 + 3,
};
const { autoUpdater } = electronUpdater;
const useMockUpdater = !app.isPackaged && process.env.TAVERN_ELECTRON_UPDATER_MOCK === '1';

const windows = new Set();
let mainWindow = null;
let serverProcess = null;
let serverReadyPromise = null;
let updateCheckInterval = null;
const newWindowOffsetPx = 36;
// While tearing a tab out, the spawned window follows the cursor, offset so the cursor
// sits over its tab strip (like grabbing the new window by the torn tab).
const tearOffFollowMs = 16;
const tearOffCursorOffset = { x: 120, y: 16 };
// tearOff = { window, route, sourceId, targetId } while a tab is being torn out.
let tearOff = null;
let tearOffTimer = null;

app.setName('Tavern');
app.setAppUserModelId('build.tavern.desktop');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

if (process.env.TAVERN_ELECTRON_UPDATE_FEED_URL) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: process.env.TAVERN_ELECTRON_UPDATE_FEED_URL,
    });
}

if (useMockUpdater) {
    autoUpdater.forceDevUpdateConfig = true;
}

function createWindow({ route, openerBounds } = {}) {
    const bounds = nextWindowBounds(openerBounds, { offset: newWindowOffsetPx });
    const window = new BrowserWindow({
        title: 'Tavern',
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        minWidth: 1100,
        minHeight: 760,
        resizable: true,
        show: false,
        backgroundColor: '#00000000',
        transparent: process.platform === 'darwin',
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
        trafficLightPosition: process.platform === 'darwin' ? macosTrafficLightPosition : undefined,
        vibrancy: process.platform === 'darwin' ? 'menu' : undefined,
        visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.cjs'),
            sandbox: false,
        },
    });

    windows.add(window);
    mainWindow ??= window;

    window.once('ready-to-show', () => {
        window.show();
    });

    window.on('closed', () => {
        windows.delete(window);

        if (mainWindow === window) {
            mainWindow = windows.values().next().value ?? null;
        }
    });

    registerExternalLinkHandlers(window, {
        appUrl: process.env.TAVERN_ELECTRON_DEV_URL ?? 'file://',
        openExternal: (url) => shell.openExternal(url),
    });

    void loadWindow(window, route);

    return window;
}

function tickTearOff() {
    if (!tearOff || tearOff.window.isDestroyed()) {
        return;
    }

    const point = screen.getCursorScreenPoint();

    const otherBounds = [];
    for (const window of windows) {
        if (window !== tearOff.window && !window.isDestroyed()) {
            otherBounds.push({ id: window.id, bounds: window.getBounds() });
        }
    }

    const targetId = findReattachTarget(otherBounds, point, tearOff.window.id);

    // Dock state machine: while the cursor is over another window's strip the moving
    // window goes transparent and that window renders a "ghost" tab that follows the cursor
    // (the controller forwards the cursor; release commits, leaving pops it back out).
    // It's hidden via opacity, not by moving offscreen — macOS clamps windows back on
    // screen, which would leave it poking out from an edge.
    if (targetId !== tearOff.dockedTarget) {
        if (tearOff.dockedTarget !== null) {
            BrowserWindow.fromId(tearOff.dockedTarget)?.webContents.send(
                'desktop:dock:leave',
                tearOff.route
            );
        }

        if (targetId === null) {
            tearOff.window.setOpacity(1);
        } else if (tearOff.dockedTarget === null) {
            tearOff.window.setOpacity(0);
        }

        tearOff.dockedTarget = targetId;
    }

    if (tearOff.dockedTarget !== null) {
        const target = BrowserWindow.fromId(tearOff.dockedTarget);

        if (target && !target.isDestroyed()) {
            target.webContents.send('desktop:dock:update', {
                route: tearOff.route,
                x: point.x - target.getBounds().x,
            });
        }
    }

    // Keep the controller under the cursor (invisible while docked) so it reappears in
    // place the moment it floats free.
    if (tearOff.mode === 'self') {
        // Move the window itself by the cursor delta from grab (preserves grab point).
        tearOff.window.setPosition(
            Math.round(tearOff.anchorWin.x + (point.x - tearOff.anchorCursor.x)),
            Math.round(tearOff.anchorWin.y + (point.y - tearOff.anchorCursor.y))
        );
    } else {
        // A torn-off window snaps under the cursor (grabbed by the torn tab).
        tearOff.window.setPosition(
            Math.round(point.x - tearOffCursorOffset.x),
            Math.round(point.y - tearOffCursorOffset.y)
        );
    }
}

/**
 * Settle a tear/move on release. If the cursor is over a window's strip (docked), the tab
 * commits there and the controller window closes. Otherwise a still-floating window stays:
 * a torn-off window becomes a new window, a self-moved window stays where dropped. An abort
 * closes a torn window but leaves a self-move in place.
 */
function endTearOff(keepWindow) {
    if (tearOffTimer) {
        clearInterval(tearOffTimer);
        tearOffTimer = null;
    }

    const current = tearOff;
    tearOff = null;

    if (!current || current.window.isDestroyed()) {
        return;
    }

    if (current.dockedTarget !== null) {
        BrowserWindow.fromId(current.dockedTarget)?.webContents.send(
            'desktop:dock:commit',
            current.route
        );
        current.window.close();
        return;
    }

    if (!keepWindow && current.mode !== 'self') {
        current.window.close();
    }
}

async function loadWindow(window, route) {
    const devUrl = process.env.TAVERN_ELECTRON_DEV_URL;

    if (devUrl) {
        await window.loadURL(buildDevWindowUrl(devUrl, route));
        return;
    }

    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    await window.loadFile(indexPath, route ? { hash: route } : undefined);
}

function installAppMenu() {
    const template = [
        ...(process.platform === 'darwin'
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { role: 'about' },
                          { type: 'separator' },
                          { role: 'services' },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          { role: 'quit' },
                      ],
                  },
              ]
            : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'Developer',
            submenu: [
                {
                    accelerator: 'CmdOrCtrl+Alt+I',
                    click: () =>
                        (BrowserWindow.getFocusedWindow() ?? mainWindow)?.webContents.openDevTools({
                            mode: 'detach',
                        }),
                    id: openDevtoolsMenuId,
                    label: 'Open Web Inspector',
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpcHandlers() {
    registerEditContextMenuHandlers();

    ipcMain.handle('desktop:get-info', () => ({
        isPackaged: app.isPackaged,
        platform: process.platform,
        version: app.getVersion(),
    }));

    ipcMain.handle('desktop:server:ensure', async () => {
        if (!app.isPackaged) {
            return '';
        }

        serverReadyPromise ??= startDesktopServer();
        await serverReadyPromise;
        return desktopServerOrigin;
    });

    ipcMain.handle('desktop:window:start-drag', () => undefined);

    ipcMain.handle('desktop:window:open', (event, route) => {
        if (!isSafeWindowRoute(route)) {
            return;
        }

        const opener = BrowserWindow.fromWebContents(event.sender);
        createWindow({ route, openerBounds: opener?.getBounds() });
    });

    ipcMain.handle('desktop:window:close', (event) => {
        BrowserWindow.fromWebContents(event.sender)?.close();
    });

    ipcMain.handle('desktop:window:tear-off-start', (event, route) => {
        if (!isSafeWindowRoute(route)) {
            return;
        }

        endTearOff(false);
        const opener = BrowserWindow.fromWebContents(event.sender);
        const window = createWindow({ route, openerBounds: opener?.getBounds() });
        tearOff = { window, route, sourceId: opener?.id ?? null, dockedTarget: null, mode: 'spawn' };
        tickTearOff();
        tearOffTimer = setInterval(tickTearOff, tearOffFollowMs);
    });

    ipcMain.handle('desktop:window:tear-off-finish', () => endTearOff(true));
    ipcMain.handle('desktop:window:tear-off-cancel', () => endTearOff(false));

    // Dragging a window's only tab moves the window itself; dropping it on another
    // window's strip merges the two.
    ipcMain.handle('desktop:window:self-move-start', (event, route) => {
        if (!isSafeWindowRoute(route)) {
            return;
        }

        const window = BrowserWindow.fromWebContents(event.sender);

        if (!window) {
            return;
        }

        endTearOff(false);
        tearOff = {
            window,
            route,
            sourceId: window.id,
            dockedTarget: null,
            mode: 'self',
            anchorCursor: screen.getCursorScreenPoint(),
            anchorWin: window.getBounds(),
        };
        tickTearOff();
        tearOffTimer = setInterval(tickTearOff, tearOffFollowMs);
    });

    ipcMain.handle('desktop:window:self-move-finish', () => endTearOff(true));
    ipcMain.handle('desktop:window:self-move-cancel', () => endTearOff(false));

    ipcMain.handle('desktop:window:set-theme', (_event, theme) => {
        nativeTheme.themeSource = theme === 'dark' || theme === 'light' ? theme : 'system';
    });

    ipcMain.handle('desktop:update:check', async () => {
        await checkForUpdates();
    });

    ipcMain.handle('desktop:update:download', async () => {
        if (useMockUpdater) {
            await runMockUpdateDownload();
            return;
        }

        await autoUpdater.downloadUpdate();
    });

    ipcMain.handle('desktop:update:restart', () => {
        if (useMockUpdater) {
            sendUpdateStatus({ phase: 'restarting', version: '999.0.0' });
            return;
        }

        autoUpdater.quitAndInstall(false, true);
    });
}

function startUpdateMonitor() {
    if (useMockUpdater) {
        sendUpdateStatus({ phase: 'available', version: '999.0.0' });
        return;
    }

    if (!app.isPackaged) {
        sendUpdateStatus({ phase: 'unsupported' });
        return;
    }

    void checkForUpdates();
    updateCheckInterval = setInterval(() => {
        void checkForUpdates();
    }, updateCheckIntervalMs);
}

async function checkForUpdates() {
    if (useMockUpdater) {
        sendUpdateStatus({ phase: 'available', version: '999.0.0' });
        return;
    }

    sendUpdateStatus({ phase: 'checking' });

    try {
        const result = await autoUpdater.checkForUpdates();
        if (!result?.updateInfo) {
            sendUpdateStatus({ phase: 'current' });
        }
    } catch (error) {
        sendUpdateStatus({ message: getErrorMessage(error), phase: 'error' });
    }
}

async function runMockUpdateDownload() {
    for (const progress of [0.2, 0.55, 0.85, 1]) {
        sendUpdateStatus({ phase: 'downloading', progress, version: '999.0.0' });
        await new Promise((resolve) => setTimeout(resolve, 120));
    }

    sendUpdateStatus({ phase: 'ready', version: '999.0.0' });
}

autoUpdater.on('update-available', (updateInfo) => {
    sendUpdateStatus({ phase: 'available', version: updateInfo.version });
});

autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ phase: 'current' });
});

autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
        phase: 'downloading',
        progress: Math.max(0, Math.min(progress.percent / 100, 1)),
        version: autoUpdater.currentVersion?.version ?? app.getVersion(),
    });
});

autoUpdater.on('update-downloaded', (updateInfo) => {
    sendUpdateStatus({ phase: 'ready', version: updateInfo.version });
});

autoUpdater.on('error', (error) => {
    sendUpdateStatus({ message: getErrorMessage(error), phase: 'error' });
});

function sendUpdateStatus(status) {
    for (const window of windows) {
        window.webContents.send('desktop:update:status', status);
    }
}

async function startDesktopServer() {
    const serverPath = getServerPath();
    if (!existsSync(serverPath)) {
        throw new Error(`Tavern desktop backend is missing: ${serverPath}`);
    }

    cleanupDesktopServerPort();

    serverProcess = spawn(
        serverPath,
        [
            '--app-origin',
            'file://',
            '--database-path',
            path.join(app.getPath('home'), '.tavern', 'tavern.sqlite'),
            '--server-port',
            '3180',
        ],
        { stdio: 'ignore' }
    );

    serverProcess.once('exit', () => {
        serverProcess = null;
        serverReadyPromise = null;
    });

    await waitForSidecarHealth();
}

function cleanupDesktopServerPort() {
    const result = spawnSync('lsof', ['-nP', '-t', '-iTCP:3180', '-sTCP:LISTEN'], {
        encoding: 'utf8',
    });

    if (result.status !== 0 || !result.stdout.trim()) {
        return;
    }

    const stalePids = result.stdout.split(/\s+/u).filter(Boolean);

    for (const pid of stalePids) {
        if (pid === String(process.pid)) {
            continue;
        }

        const command = readProcessCommand(pid);
        if (command.includes('tavern-server')) {
            process.kill(Number(pid), 'SIGTERM');
        }
    }

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        const remaining = spawnSync('lsof', ['-nP', '-t', '-iTCP:3180', '-sTCP:LISTEN'], {
            encoding: 'utf8',
        });
        if (remaining.status !== 0 || !remaining.stdout.trim()) {
            return;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }

    for (const pid of stalePids) {
        if (pid !== String(process.pid)) {
            process.kill(Number(pid), 'SIGKILL');
        }
    }
}

function getServerPath() {
    const executableName = process.platform === 'win32' ? 'tavern-server.exe' : 'tavern-server';
    return path.join(process.resourcesPath, 'bin', executableName);
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

        await new Promise((resolve) => setTimeout(resolve, sidecarStartupPollMs));
    }

    throw new Error('Tavern desktop backend did not become healthy in time.');
}

function cleanupDevPortsOnce() {
    if (app.isPackaged) {
        return;
    }

    for (const key of ['TAVERN_WEBSITE_PORT', 'TAVERN_SERVER_PORT']) {
        const port = readPort(key);
        if (port) {
            killProcessesListeningOnPort(port);
        }
    }

    if (process.env.TAVERN_DEV_STACK_HAS_RUNTIME !== '1') {
        return;
    }

    for (const key of ['TAVERN_RUNTIME_PORT']) {
        const port = readPort(key);
        if (port) {
            killProcessesListeningOnPort(port);
        }
    }
}

function readPort(key) {
    const value = Number.parseInt(process.env[key] ?? '', 10);
    return Number.isInteger(value) && value > 0 ? value : null;
}

function killProcessesListeningOnPort(port) {
    execFile('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], (_error, stdout) => {
        for (const pid of stdout
            .toString()
            .split(/\s+/u)
            .map((value) => value.trim())
            .filter(Boolean)) {
            if (pid !== String(process.pid)) {
                process.kill(Number(pid), 'SIGTERM');
            }
        }
    });
}

function readProcessCommand(pid) {
    const result = spawnSync('ps', ['-p', pid, '-o', 'command='], {
        encoding: 'utf8',
    });

    return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function getErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error) {
        return error;
    }

    return 'Tavern could not check for updates.';
}

app.whenReady().then(() => {
    registerIpcHandlers();
    installAppMenu();
    createWindow();
    startUpdateMonitor();
});

app.on('window-all-closed', () => {
    cleanupDevPortsOnce();
    app.quit();
});

app.on('before-quit', () => {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }

    cleanupDevPortsOnce();
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
    }
});
