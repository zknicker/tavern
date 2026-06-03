'use strict';

const { app, BrowserWindow, ipcMain, Menu, nativeTheme } = require('electron');
const path = require('node:path');
const { spawn, execFile, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const electronUpdater = require('electron-updater');
const { registerEditContextMenuHandlers } = require('./edit-context-menu.cjs');

const desktopServerOrigin = 'http://127.0.0.1:3180';
const sidecarStartupDeadlineMs = 10_000;
const sidecarStartupPollMs = 200;
const updateCheckIntervalMs = 10 * 60 * 1000;
const openDevtoolsMenuId = 'open-devtools';
const topbarHeightPx = 38;
const macosTrafficLightDiameterPx = 12;
const macosTrafficLightPosition = {
    x: 13,
    y: (topbarHeightPx - macosTrafficLightDiameterPx) / 2 - 1,
};
const { autoUpdater } = electronUpdater;
const useMockUpdater = !app.isPackaged && process.env.TAVERN_ELECTRON_UPDATER_MOCK === '1';

let mainWindow = null;
let serverProcess = null;
let serverReadyPromise = null;
let updateCheckInterval = null;

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

function createMainWindow() {
    mainWindow = new BrowserWindow({
        title: 'Tavern',
        width: 1440,
        height: 960,
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

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    void loadMainWindow(mainWindow);
}

async function loadMainWindow(window) {
    const devUrl = process.env.TAVERN_ELECTRON_DEV_URL;

    if (devUrl) {
        await window.loadURL(devUrl);
        return;
    }

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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
                    click: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }),
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
    mainWindow?.webContents.send('desktop:update:status', status);
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

    for (const key of ['TAVERN_RUNTIME_PORT', 'TAVERN_OPENCLAW_GATEWAY_PORT']) {
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
    createMainWindow();
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
