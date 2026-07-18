'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Each web contents is launched as either the window "chrome" (tab strip + toolbar) or a
// per-tab "content" view. Main passes the surface via additionalArguments so the renderer
// can branch before first paint. Absent (the legacy single-renderer path) → null.
const surfaceArg = process.argv.find((arg) => arg.startsWith('--tavern-surface='));
const surface = surfaceArg ? surfaceArg.slice('--tavern-surface='.length) : null;

contextBridge.exposeInMainWorld('tavernDesktop', {
    surface,
    authTokenGet: () => ipcRenderer.invoke('desktop:auth:token-get'),
    authTokenSet: (token) => ipcRenderer.invoke('desktop:auth:token-set', token),
    onSsoCallback: (listener) => {
        const handler = (_event, url) => listener(url);
        ipcRenderer.on('desktop:auth:sso-callback', handler);
        return () => ipcRenderer.off('desktop:auth:sso-callback', handler);
    },
    openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
    // Chrome → main: the live bounds (CSS px, relative to the window) of the content card
    // where the active tab's WebContentsView should be positioned.
    setContentBounds: (bounds) => ipcRenderer.invoke('desktop:view:set-content-bounds', bounds),
    // Chrome → main: navigate the active tab's content view to a route (client-side).
    navigateActiveView: (route) => ipcRenderer.invoke('desktop:view:navigate', route),
    // Chrome → main: tab management.
    getTabs: () => ipcRenderer.invoke('desktop:tabs:get'),
    createTab: (route) => ipcRenderer.invoke('desktop:tab:create', route),
    closeTab: (tabId) => ipcRenderer.invoke('desktop:tab:close', tabId),
    activateTab: (tabId) => ipcRenderer.invoke('desktop:tab:activate', tabId),
    reorderTabs: (orderedIds) => ipcRenderer.invoke('desktop:tab:reorder', orderedIds),
    // Chrome → main: where a docking tab should land in this strip.
    dockSetIndex: (index) => ipcRenderer.invoke('desktop:dock:set-index', index),
    // Main → chrome: the tab list / active tab changed (id, route per tab).
    onTabsChanged: (listener) => {
        const handler = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:tabs:changed', handler);
        return () => ipcRenderer.off('desktop:tabs:changed', handler);
    },
    // Main → content: the chrome asked this view to navigate (client-side, no reload).
    onNavigateTo: (listener) => {
        const handler = (_event, route) => listener(route);
        ipcRenderer.on('desktop:view:navigate-to', handler);
        return () => ipcRenderer.off('desktop:view:navigate-to', handler);
    },
    // Main → content: this WebContentsView became the visible active tab.
    onViewActivated: (listener) => {
        const handler = () => listener();
        ipcRenderer.on('desktop:view:activated', handler);
        return () => ipcRenderer.off('desktop:view:activated', handler);
    },
    onDevModeToggle: (listener) => {
        const handler = () => listener();
        ipcRenderer.on('desktop:dev-mode:toggle', handler);
        return () => ipcRenderer.off('desktop:dev-mode:toggle', handler);
    },
    checkForUpdate: () => ipcRenderer.invoke('desktop:update:check'),
    downloadUpdate: () => ipcRenderer.invoke('desktop:update:download'),
    ensureServerOrigin: () => ipcRenderer.invoke('desktop:server:ensure'),
    closeWindow: () => ipcRenderer.invoke('desktop:window:close'),
    getInfo: () => ipcRenderer.invoke('desktop:get-info'),
    openWindow: (route) => ipcRenderer.invoke('desktop:window:open', route),
    onDockCommit: (listener) => {
        const handler = (_event, route) => listener(route);
        ipcRenderer.on('desktop:dock:commit', handler);
        return () => ipcRenderer.off('desktop:dock:commit', handler);
    },
    onDockLeave: (listener) => {
        const handler = (_event, route) => listener(route);
        ipcRenderer.on('desktop:dock:leave', handler);
        return () => ipcRenderer.off('desktop:dock:leave', handler);
    },
    onDockUpdate: (listener) => {
        const handler = (_event, payload) => listener(payload);
        ipcRenderer.on('desktop:dock:update', handler);
        return () => ipcRenderer.off('desktop:dock:update', handler);
    },
    onOpenTab: (listener) => {
        const handler = (_event, route) => listener(route);
        ipcRenderer.on('desktop:tab:open', handler);
        return () => ipcRenderer.off('desktop:tab:open', handler);
    },
    onUpdateStatus: (listener) => {
        const handler = (_event, status) => listener(status);
        ipcRenderer.on('desktop:update:status', handler);
        return () => ipcRenderer.off('desktop:update:status', handler);
    },
    restartForUpdate: () => ipcRenderer.invoke('desktop:update:restart'),
    runEditCommand: (command) => ipcRenderer.invoke('desktop:edit:run', command),
    selfMoveCancel: () => ipcRenderer.invoke('desktop:window:self-move-cancel'),
    selfMoveFinish: () => ipcRenderer.invoke('desktop:window:self-move-finish'),
    selfMoveStart: (route) => ipcRenderer.invoke('desktop:window:self-move-start', route),
    setTheme: (theme) => ipcRenderer.invoke('desktop:window:set-theme', theme),
    tearOffCancel: () => ipcRenderer.invoke('desktop:window:tear-off-cancel'),
    tearOffFinish: () => ipcRenderer.invoke('desktop:window:tear-off-finish'),
    tearOffStart: (payload, cursorOffset) =>
        ipcRenderer.invoke('desktop:window:tear-off-start', payload, cursorOffset),
    startWindowDrag: () => ipcRenderer.invoke('desktop:window:start-drag'),
});
