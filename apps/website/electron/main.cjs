'use strict';

const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    nativeTheme,
    screen,
    shell,
    WebContentsView,
} = require('electron');
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
    y: (topbarHeightPx - macosTrafficLightDiameterPx) / 2 - 1,
};
const { autoUpdater } = electronUpdater;
const useMockUpdater = !app.isPackaged && process.env.TAVERN_ELECTRON_UPDATER_MOCK === '1';
// Feature flag for the Chrome-style per-tab WebContentsView shell (chrome window + content
// views). Off → the legacy single-renderer path (full app per window). Built incrementally.
const useContentViews = process.env.TAVERN_VIEWS === '1';

const windows = new Set();
// Hidden, already-booted, tab-less chrome windows kept ready so a torn-off tab gets an
// instant window (no SPA boot on the hot path). Promoted into `windows` when taken.
const warmWindows = [];
let mainWindow = null;
let serverProcess = null;
let serverReadyPromise = null;
let updateCheckInterval = null;
const newWindowOffsetPx = 36;
// While tearing a tab out, the spawned window follows the cursor, offset so the cursor
// sits over the center of the torn tab (the first/only tab): traffic-light inset (94px) plus
// half a tab width (100px), so grabbing a tab near its middle keeps the cursor there.
const tearOffFollowMs = 16;
const tearOffCursorOffset = { x: 194, y: 18 };
// tearOff = { window, route, sourceId, targetId } while a tab is being torn out.
let tearOff = null;
let tearOffTimer = null;

const defaultRoute = '/dashboard/overview';
// Each chrome window owns a content WebContentsView showing the active tab's page (a separate
// renderer, so live page state survives tab switches and window moves). Phase 0 keeps one view
// per window; later phases hold a tab list and toggle which view is attached.
// BrowserWindow.id -> { view, route, bounds }
const windowContent = new Map();

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

function createWindow({ route, openerBounds, withInitialTab = true, warm = false } = {}) {
    const initialRoute = isSafeWindowRoute(route) ? route : defaultRoute;
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
            additionalArguments: useContentViews ? ['--tavern-surface=chrome'] : [],
        },
    });

    // A warm spare stays out of the live registry (not a dock target / not shown) until taken.
    if (!warm) {
        windows.add(window);
        mainWindow ??= window;
    }

    window.once('ready-to-show', () => {
        if (!warm) {
            window.show();
        }
    });

    window.on('resize', () => positionActiveView(window));

    window.on('closed', () => {
        destroyWindowContent(window);
        windows.delete(window);

        const warmIndex = warmWindows.indexOf(window);
        if (warmIndex !== -1) {
            warmWindows.splice(warmIndex, 1);
        }

        if (mainWindow === window) {
            mainWindow = windows.values().next().value ?? null;
        }

        // Once no real windows remain, drop warm spares so window-all-closed can fire.
        if (windows.size === 0) {
            for (const spare of warmWindows.splice(0)) {
                if (!spare.isDestroyed()) {
                    spare.destroy();
                }
            }
        }
    });

    registerExternalLinkHandlers(window, {
        appUrl: process.env.TAVERN_ELECTRON_DEV_URL ?? 'file://',
        openExternal: (url) => shell.openExternal(url),
    });

    void loadWindow(window, useContentViews ? initialRoute : route);

    if (useContentViews) {
        ensureWindowContent(window);

        if (withInitialTab) {
            createTab(window, initialRoute);
        }
    }

    return window;
}

// Boot a hidden, tab-less chrome window in the background and keep it ready for the next
// tear-off. did-finish-load means the chrome SPA has loaded and painted its (empty) strip.
function createWarmWindow() {
    if (!useContentViews) {
        return;
    }

    const window = createWindow({ withInitialTab: false, warm: true });
    window.warmReady = false;
    window.webContents.once('did-finish-load', () => {
        window.warmReady = true;
    });
    warmWindows.push(window);
}

// Take a booted warm window (promoting it into the live registry) and replenish the pool.
function takeWarmWindow() {
    const index = warmWindows.findIndex(
        (window) => window && !window.isDestroyed() && window.warmReady
    );

    if (index === -1) {
        return null;
    }

    const [window] = warmWindows.splice(index, 1);
    windows.add(window);
    mainWindow ??= window;
    createWarmWindow();
    return window;
}

// --- Per-tab content views (each page lives in its own renderer, kept alive across tab
// switches and window moves, so live state survives) ---

let nextTabId = 1;

function buildContentView() {
    return new WebContentsView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.cjs'),
            sandbox: false,
            additionalArguments: ['--tavern-surface=content'],
        },
    });
}

function ensureWindowContent(window) {
    if (!windowContent.has(window.id)) {
        windowContent.set(window.id, {
            tabs: [],
            activeId: null,
            bounds: defaultContentBounds(window),
        });
    }

    return windowContent.get(window.id);
}

// The route-reporting listeners are rebound when a view moves windows, so a torn-off page
// reports to its new chrome.
function attachViewReporting(window, tab) {
    tab.report = () => reportTabRoute(window, tab);
    tab.view.webContents.on('did-navigate', tab.report);
    tab.view.webContents.on('did-navigate-in-page', tab.report);
}

function detachViewReporting(tab) {
    if (tab.report) {
        tab.view.webContents.removeListener('did-navigate', tab.report);
        tab.view.webContents.removeListener('did-navigate-in-page', tab.report);
        tab.report = null;
    }
}

function createTab(window, route, { activate = true } = {}) {
    const entry = ensureWindowContent(window);
    const safeRoute = isSafeWindowRoute(route) ? route : defaultRoute;
    const tab = { id: `tab-${nextTabId++}`, view: buildContentView(), route: safeRoute };
    entry.tabs.push(tab);
    attachViewReporting(window, tab);
    void loadView(tab.view, safeRoute);

    if (activate) {
        activateTab(window, tab.id);
    } else {
        broadcastTabs(window);
    }

    return tab;
}

// Move an already-loaded view into this window as a new tab — tear-off and dock use this so
// the page keeps its live state (no reload). `index` lands a docked tab where it was dropped.
function adoptTabView(window, view, route, { activate = true, index } = {}) {
    const entry = ensureWindowContent(window);
    const tab = { id: `tab-${nextTabId++}`, view, route };
    const at = Number.isInteger(index)
        ? Math.max(0, Math.min(index, entry.tabs.length))
        : entry.tabs.length;
    entry.tabs.splice(at, 0, tab);
    attachViewReporting(window, tab);

    if (activate) {
        activateTab(window, tab.id);
    } else {
        broadcastTabs(window);
    }

    return tab;
}

// Remove a view from this window without destroying it (it will be re-parented elsewhere).
function detachTabView(window, view) {
    const entry = windowContent.get(window.id);

    if (!(entry && view)) {
        return null;
    }

    const index = entry.tabs.findIndex((tab) => tab.view === view);

    if (index === -1) {
        return null;
    }

    const [tab] = entry.tabs.splice(index, 1);
    detachViewReporting(tab);

    if (window.contentView.children.includes(view)) {
        window.contentView.removeChildView(view);
    }

    return { view, route: tab.route, index };
}

// Tear a tab out of a window that keeps running: detach its view and re-activate a neighbor.
function tearTabOut(window, tabId) {
    const entry = windowContent.get(window.id);
    const tab = entry?.tabs.find((entryTab) => entryTab.id === tabId);

    if (!tab) {
        return null;
    }

    const wasActive = entry.activeId === tabId;
    const detached = detachTabView(window, tab.view);

    if (!detached) {
        return null;
    }

    if (wasActive && entry.tabs.length > 0) {
        const neighbor = entry.tabs[Math.min(detached.index, entry.tabs.length - 1)];
        entry.activeId = null;
        activateTab(window, neighbor.id);
    } else {
        broadcastTabs(window);
    }

    return detached;
}

// The view a tear/move gesture is carrying (a torn-off window's tab, or a self-moved
// window's single tab).
function tearOffView(current) {
    if (current.mode !== 'self') {
        return current.view;
    }

    const entry = windowContent.get(current.window.id);
    const tab = entry?.tabs.find((entryTab) => entryTab.id === current.tabId) ?? entry?.tabs[0];

    return tab?.view ?? null;
}

function activateTab(window, tabId) {
    const entry = windowContent.get(window.id);

    if (!entry) {
        return;
    }

    const tab = entry.tabs.find((entryTab) => entryTab.id === tabId);

    if (!tab || entry.activeId === tabId) {
        return;
    }

    const previous = entry.tabs.find((entryTab) => entryTab.id === entry.activeId);

    if (previous && !previous.view.webContents.isDestroyed()) {
        window.contentView.removeChildView(previous.view);
    }

    entry.activeId = tabId;

    if (!window.contentView.children.includes(tab.view)) {
        window.contentView.addChildView(tab.view);
    }

    positionActiveView(window);
    broadcastTabs(window);
}

function closeTab(window, tabId) {
    const entry = windowContent.get(window.id);

    if (!entry) {
        return;
    }

    const index = entry.tabs.findIndex((entryTab) => entryTab.id === tabId);

    if (index === -1) {
        return;
    }

    const [removed] = entry.tabs.splice(index, 1);
    const wasActive = entry.activeId === tabId;

    if (window.contentView.children.includes(removed.view)) {
        window.contentView.removeChildView(removed.view);
    }

    if (!removed.view.webContents.isDestroyed()) {
        removed.view.webContents.close();
    }

    if (entry.tabs.length === 0) {
        window.close();
        return;
    }

    if (wasActive) {
        const neighbor = entry.tabs[Math.min(index, entry.tabs.length - 1)];
        entry.activeId = null;
        activateTab(window, neighbor.id);
    } else {
        broadcastTabs(window);
    }
}

function reorderTabs(window, orderedIds) {
    const entry = windowContent.get(window.id);

    if (!(entry && Array.isArray(orderedIds))) {
        return;
    }

    const byId = new Map(entry.tabs.map((tab) => [tab.id, tab]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);

    if (reordered.length === entry.tabs.length) {
        entry.tabs = reordered;
        broadcastTabs(window);
    }
}

// Navigate the active view client-side (no reload) so its providers and cache stay warm.
function navigateActiveTab(window, route) {
    const entry = windowContent.get(window.id);

    if (!(entry && isSafeWindowRoute(route))) {
        return;
    }

    const tab = entry.tabs.find((entryTab) => entryTab.id === entry.activeId);

    if (tab && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send('desktop:view:navigate-to', route);
    }
}

function reportTabRoute(window, tab) {
    if (window.isDestroyed() || tab.view.webContents.isDestroyed()) {
        return;
    }

    tab.route = routeFromViewUrl(tab.view.webContents.getURL());
    broadcastTabs(window);
}

function positionActiveView(window) {
    const entry = windowContent.get(window.id);

    if (!(entry?.bounds && entry.activeId)) {
        return;
    }

    const tab = entry.tabs.find((entryTab) => entryTab.id === entry.activeId);

    if (!tab || tab.view.webContents.isDestroyed()) {
        return;
    }

    tab.view.setBounds({
        x: Math.round(entry.bounds.x),
        y: Math.round(entry.bounds.y),
        width: Math.round(entry.bounds.width),
        height: Math.round(entry.bounds.height),
    });
}

function destroyWindowContent(window) {
    const entry = windowContent.get(window.id);
    windowContent.delete(window.id);

    if (!entry) {
        return;
    }

    for (const tab of entry.tabs) {
        if (!tab.view.webContents.isDestroyed()) {
            tab.view.webContents.close();
        }
    }
}

function broadcastTabs(window) {
    const entry = windowContent.get(window.id);

    if (!entry || window.isDestroyed()) {
        return;
    }

    window.webContents.send('desktop:tabs:changed', {
        activeId: entry.activeId,
        tabs: entry.tabs.map((tab) => ({ id: tab.id, route: tab.route })),
    });
}

function currentTabs(window) {
    const entry = windowContent.get(window.id);

    return entry
        ? {
              activeId: entry.activeId,
              tabs: entry.tabs.map((tab) => ({ id: tab.id, route: tab.route })),
          }
        : { activeId: null, tabs: [] };
}

// Validate a renderer-supplied cursor offset (px from the new window's top-left).
function safeCursorOffset(offset) {
    if (offset && Number.isFinite(offset.x) && Number.isFinite(offset.y)) {
        return { x: offset.x, y: offset.y };
    }

    return null;
}

// Approximate the content-card region until the chrome reports its exact bounds.
function defaultContentBounds(window) {
    const [width, height] = window.getContentSize();
    const top = topbarHeightPx + 40;
    return { x: 0, y: top, width, height: Math.max(0, height - top) };
}

function routeFromViewUrl(url) {
    try {
        const parsed = new URL(url);

        if (parsed.hash) {
            return parsed.hash.slice(1);
        }

        return `${parsed.pathname}${parsed.search}` || defaultRoute;
    } catch {
        return defaultRoute;
    }
}

async function loadView(view, route) {
    const devUrl = process.env.TAVERN_ELECTRON_DEV_URL;

    if (devUrl) {
        await view.webContents.loadURL(buildDevWindowUrl(devUrl, route));
        return;
    }

    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    await view.webContents.loadFile(indexPath, route ? { hash: route } : undefined);
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
        // A fresh target reports its own insertion index via desktop:dock:set-index.
        tearOff.dockIndex = undefined;
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
        // A torn-off window snaps under the cursor, keeping the tab where it was grabbed.
        const offset = tearOff.cursorOffset ?? tearOffCursorOffset;
        tearOff.window.setPosition(Math.round(point.x - offset.x), Math.round(point.y - offset.y));
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
        const target = BrowserWindow.fromId(current.dockedTarget);

        if (useContentViews) {
            const moved =
                target && !target.isDestroyed()
                    ? detachTabView(current.window, tearOffView(current))
                    : null;

            if (moved) {
                target.webContents.send('desktop:dock:commit', moved.route);
                adoptTabView(target, moved.view, moved.route, {
                    activate: true,
                    index: current.dockIndex,
                });
            }

            current.window.close();
        } else {
            target?.webContents.send('desktop:dock:commit', current.route);
            current.window.close();
        }

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

    ipcMain.handle('desktop:view:set-content-bounds', (event, bounds) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (!(window && bounds) || typeof bounds.width !== 'number') {
            return;
        }

        const entry = windowContent.get(window.id);

        if (entry) {
            entry.bounds = bounds;
            positionActiveView(window);
        }
    });

    ipcMain.handle('desktop:view:navigate', (event, route) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (window) {
            navigateActiveTab(window, route);
        }
    });

    ipcMain.handle('desktop:tabs:get', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        return window ? currentTabs(window) : { activeId: null, tabs: [] };
    });

    ipcMain.handle('desktop:tab:create', (event, route) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (window) {
            createTab(window, route ?? defaultRoute);
        }
    });

    ipcMain.handle('desktop:tab:close', (event, tabId) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (window) {
            closeTab(window, tabId);
        }
    });

    ipcMain.handle('desktop:tab:activate', (event, tabId) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (window) {
            activateTab(window, tabId);
        }
    });

    ipcMain.handle('desktop:tab:reorder', (event, orderedIds) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (window) {
            reorderTabs(window, orderedIds);
        }
    });

    // The target window's chrome reports where in its strip the docking tab should land.
    ipcMain.handle('desktop:dock:set-index', (_event, index) => {
        if (tearOff && Number.isInteger(index)) {
            tearOff.dockIndex = index;
        }
    });

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

    // Tear-off carries a tabId in the WebContentsView model (the live view re-parents into a
    // new window) and a route in the legacy single-renderer model (a new window loads it).
    ipcMain.handle('desktop:window:tear-off-start', (event, payload, cursorOffset) => {
        const sourceWindow = BrowserWindow.fromWebContents(event.sender);

        if (!sourceWindow) {
            return;
        }

        endTearOff(false);
        const offset = safeCursorOffset(cursorOffset);

        if (useContentViews) {
            const detached = tearTabOut(sourceWindow, payload);

            if (!detached) {
                return;
            }

            const window =
                takeWarmWindow() ??
                createWindow({
                    openerBounds: sourceWindow.getBounds(),
                    withInitialTab: false,
                });
            adoptTabView(window, detached.view, detached.route, { activate: true });
            tearOff = {
                window,
                view: detached.view,
                route: detached.route,
                sourceId: sourceWindow.id,
                dockedTarget: null,
                mode: 'spawn',
                cursorOffset: offset,
            };
        } else {
            if (!isSafeWindowRoute(payload)) {
                return;
            }

            const window = createWindow({ route: payload, openerBounds: sourceWindow.getBounds() });
            tearOff = {
                window,
                route: payload,
                sourceId: sourceWindow.id,
                dockedTarget: null,
                mode: 'spawn',
                cursorOffset: offset,
            };
        }

        tickTearOff();

        // Show the torn window now (positioned under the cursor) instead of waiting for its
        // chrome to finish booting — the re-parented content view is already live, so the
        // page appears immediately and the tab strip fills in a beat later.
        if (useContentViews && tearOff && !tearOff.window.isDestroyed()) {
            tearOff.window.show();
        }

        tearOffTimer = setInterval(tickTearOff, tearOffFollowMs);
    });

    ipcMain.handle('desktop:window:tear-off-finish', () => endTearOff(true));
    ipcMain.handle('desktop:window:tear-off-cancel', () => endTearOff(false));

    // Dragging a window's only tab moves the window itself; dropping it on another
    // window's strip merges (the tab's view re-parents into that window).
    ipcMain.handle('desktop:window:self-move-start', (event, payload) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (!window) {
            return;
        }

        const entry = windowContent.get(window.id);
        const tab = useContentViews
            ? (entry?.tabs.find((entryTab) => entryTab.id === payload) ?? entry?.tabs[0])
            : null;

        if (useContentViews && !tab) {
            return;
        }

        if (!(useContentViews || isSafeWindowRoute(payload))) {
            return;
        }

        endTearOff(false);
        tearOff = {
            window,
            view: tab?.view ?? null,
            route: useContentViews ? tab.route : payload,
            tabId: tab?.id ?? null,
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

    // Pre-warm a spare chrome window once the first window has settled, so the first
    // tear-off gets an instant window.
    if (useContentViews) {
        setTimeout(createWarmWindow, 2000);
    }
});

app.on('window-all-closed', () => {
    cleanupDevPortsOnce();
    app.quit();
});

app.on('before-quit', () => {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }

    for (const spare of warmWindows.splice(0)) {
        if (!spare.isDestroyed()) {
            spare.destroy();
        }
    }

    cleanupDevPortsOnce();
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
    }
});
