const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('memoClipboard', {
  write: (html, text) => ipcRenderer.invoke('memo:copy', { html, text }),
});