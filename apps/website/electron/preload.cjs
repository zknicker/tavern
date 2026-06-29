'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tavernDesktop', {
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
    tearOffStart: (route) => ipcRenderer.invoke('desktop:window:tear-off-start', route),
    startWindowDrag: () => ipcRenderer.invoke('desktop:window:start-drag'),
});
