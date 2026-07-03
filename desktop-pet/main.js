const { app, BrowserWindow, screen, ipcMain } = require('electron')
const path = require('path')

let win = null

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  const W = 230
  const H = 260
  win = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + workArea.width - W - 24,
    y: workArea.y + workArea.height - H - 24,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.loadFile('pet.html')

  // 把全局鼠标位置喂给渲染进程，让桌宠的视线跟着真实光标走（VTube Studio 式追踪）
  setInterval(() => {
    if (!win || win.isDestroyed()) return
    const c = screen.getCursorScreenPoint()
    const b = win.getBounds()
    win.webContents.send('cursor', {
      dx: c.x - (b.x + b.width / 2),
      dy: c.y - (b.y + b.height / 2),
    })
  }, 60)
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide()
  createWindow()
})

ipcMain.on('quit', () => app.quit())
app.on('window-all-closed', () => app.quit())
