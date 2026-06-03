'use strict';

const { ipcMain } = require('electron');

const editCommands = new Set(['copy', 'cut', 'paste', 'redo', 'selectAll', 'undo']);

function registerEditContextMenuHandlers() {
    ipcMain.handle('desktop:edit:run', (event, command) => {
        if (!editCommands.has(command)) {
            return;
        }

        event.sender[command]();
    });
}

module.exports = {
    registerEditContextMenuHandlers,
};
