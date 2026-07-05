const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pet', {
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, v) => cb(v)),
  generateSkin: (prompt) => ipcRenderer.invoke('generate-skin', prompt),
  dragMove: (d) => ipcRenderer.send('drag-move', d),
  setPassthrough: (on) => ipcRenderer.send('set-passthrough', on),
  quit: () => ipcRenderer.send('quit'),
})
