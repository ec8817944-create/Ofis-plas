'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sesliNota', {
  chooseDocument: () => ipcRenderer.invoke('document:choose'),
  saveDocument: (payload) => ipcRenderer.invoke('document:save', payload),
  onMenuCommand: (listener) => {
    const handler = (_event, command) => listener(command);
    ipcRenderer.on('menu-command', handler);
    return () => ipcRenderer.removeListener('menu-command', handler);
  }
});
