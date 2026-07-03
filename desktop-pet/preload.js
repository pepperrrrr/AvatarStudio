const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pet', {
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, v) => cb(v)),
  quit: () => ipcRenderer.send('quit'),
})
