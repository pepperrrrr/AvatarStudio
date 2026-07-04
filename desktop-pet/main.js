const { app, BrowserWindow, screen, ipcMain } = require('electron')
const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

let win = null

// GUI 启动的 app 没有 shell PATH，需要自己找 claude CLI
const CLAUDE_CANDIDATES = [
  '/Users/pepper/.nvm/versions/node/v23.2.0/bin/claude',
  path.join(os.homedir(), '.local/bin/claude'),
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
]
function findClaude() {
  for (const p of CLAUDE_CANDIDATES) if (fs.existsSync(p)) return p
  return 'claude'
}

const CONTRACT = `你是桌宠皮肤生成器。根据最后一行的用户描述，生成一个可爱的卡通桌宠 SVG。硬性要求：
1. 只输出 SVG 代码：从 <svg 开始，到 </svg> 结束。不要 markdown 代码块，不要任何解释文字。
2. 根元素 <svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">，角色居中，宽高约 150~170。
3. 动画骨架（必须严格包含，外部脚本靠它驱动动画）：
   - 左眼：<g id="eyeL" transform="translate(X Y)"><g class="lid">…眼睛图形，以 0,0 为中心…</g></g>
   - 右眼：<g id="eyeR" transform="translate(X Y)"><g class="lid">…同上…</g></g>
   - 嘴巴：<g id="mouths"> 内含 4 个嘴型，id 分别为 m-normal、m-happy、m-wow、m-sleepy，后三个加 visibility="hidden"
4. 禁止：<script>、<foreignObject>、on* 事件属性、外部 url() 引用、位图。渐变可以用 <defs> 内的 linearGradient/radialGradient。
5. 扁平插画风、圆润可爱、2~5 个主色，带细节（腮红、高光、花纹、小配饰）。
用户描述：`

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  const W = 340
  const H = 300
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

  // 把全局鼠标位置喂给渲染进程，让桌宠视线跟着真实光标走
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

// prompt → claude CLI → 带动画骨架的 SVG 皮肤
ipcMain.handle('generate-skin', (_e, prompt) => {
  return new Promise((resolve) => {
    const bin = findClaude()
    const env = {
      ...process.env,
      PATH: [path.dirname(bin), '/usr/local/bin', '/opt/homebrew/bin', process.env.PATH || ''].join(':'),
    }
    execFile(bin, ['-p', CONTRACT + prompt], { timeout: 180000, maxBuffer: 8 * 1024 * 1024, env }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: '调用 Claude CLI 失败：' + String(err.message || err).slice(0, 160) })
      const m = String(stdout).match(/<svg[\s\S]*<\/svg>/)
      if (!m) return resolve({ ok: false, error: '没有得到有效 SVG，再试一次？' })
      const svg = m[0]
      if (/<script|<foreignObject|javascript:|\son\w+=/i.test(svg)) {
        return resolve({ ok: false, error: 'SVG 含不安全内容，已拦截' })
      }
      try {
        const dir = path.join(__dirname, 'skins')
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, `skin-${Date.now()}.svg`), svg)
      } catch {}
      resolve({ ok: true, svg })
    })
  })
})

app.whenReady().then(() => {
  if (app.dock) app.dock.hide()
  createWindow()
})

// 拖动桌宠移动窗口：渲染进程发来鼠标屏幕坐标增量，这里按增量挪窗口
ipcMain.on('drag-move', (_e, { dx, dy }) => {
  if (!win || win.isDestroyed()) return
  const [x, y] = win.getPosition()
  win.setPosition(Math.round(x + dx), Math.round(y + dy))
})

ipcMain.on('quit', () => app.quit())
app.on('window-all-closed', () => app.quit())
