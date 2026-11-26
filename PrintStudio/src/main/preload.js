'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ps', {
  call: (name, ...args) => ipcRenderer.invoke('ps:call', name, ...args).then((r) => r, (e) => { throw new Error(String(e && e.message || e).replace(/^Error invoking remote method 'ps:call': (Error: )?/, '')); }),
  on: (ch, cb) => { const f = (_e, d) => cb(d); ipcRenderer.on('ps:' + ch, f); return () => ipcRenderer.removeListener('ps:' + ch, f); },
});
