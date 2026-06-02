'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tavernDesktop', {
    checkForUpdate: () => ipcRenderer.invoke('desktop:update:check'),
    downloadUpdate: () => ipcRenderer.invoke('desktop:update:download'),
    ensureServerOrigin: () => ipcRenderer.invoke('desktop:server:ensure'),
    getInfo: () => ipcRenderer.invoke('desktop:get-info'),
    onUpdateStatus: (listener) => {
        const handler = (_event, status) => listener(status);
        ipcRenderer.on('desktop:update:status', handler);
        return () => ipcRenderer.off('desktop:update:status', handler);
    },
    restartForUpdate: () => ipcRenderer.invoke('desktop:update:restart'),
    setTheme: (theme) => ipcRenderer.invoke('desktop:window:set-theme', theme),
    startWindowDrag: () => ipcRenderer.invoke('desktop:window:start-drag'),
});
