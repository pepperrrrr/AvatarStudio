<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { mulberry32 } from '../lib/noise'
import { downloadBlob } from '../lib/download'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const styleId = ref('gradient')
const colorA = ref('#2f57d0')
const colorB = ref('#8a3ffc')
const seed = ref(20260703)

const STYLES = [
  { id: 'gradient', label: '柔光渐变' },
  { id: 'bokeh', label: '光斑虚化' },
  { id: 'waves', label: '流动波浪' },
  { id: 'stars', label: '星空夜幕' },
  { id: 'grid', label: '科技网格' },
  { id: 'lowpoly', label: '低多边形' },
]

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lerp3(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
function css(c: RGB, alpha = 1) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = mulberry32(seed.value)
  const A = hexToRgb(colorA.value)
  const B = hexToRgb(colorB.value)
  const dark = (c: RGB, t: number) => lerp3(c, [8, 10, 18], t)

  if (styleId.value === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, css(A))
    g.addColorStop(1, css(B))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 5; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = (0.15 + rand() * 0.3) * w
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, css(lerp3(B, [255, 255, 255], 0.5), 0.16))
      rg.addColorStop(1, css(B, 0))
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, w, h)
    }
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, w * 0.75)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, w, h)
  } else if (styleId.value === 'bokeh') {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, css(dark(A, 0.55)))
    g.addColorStop(1, css(dark(B, 0.6)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 42; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = 15 + Math.pow(rand(), 2) * 170
      const base = lerp3(A, B, rand())
      const c = lerp3(base, [255, 255, 255], rand() * 0.5)
      ctx.filter = rand() < 0.5 ? `blur(${8 + rand() * 22}px)` : 'none'
      ctx.fillStyle = css(c, 0.05 + rand() * 0.2)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.filter = 'none'
  } else if (styleId.value === 'waves') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, css(lerp3(A, [255, 255, 255], 0.12)))
    g.addColorStop(1, css(dark(A, 0.35)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let k = 0; k < 6; k++) {
      const base = h * (0.3 + k * 0.11)
      const amp = 30 + rand() * 70
      const f = 1.5 + rand() * 2.5
      const phase = rand() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, base + Math.sin((x / w) * Math.PI * f + phase) * amp)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fillStyle = css(lerp3(A, B, k / 5), 0.1 + k * 0.05)
      ctx.fill()
    }
  } else if (styleId.value === 'stars') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, css(dark(A, 0.85)))
    g.addColorStop(1, css(dark(B, 0.7)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 3; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = w * (0.15 + rand() * 0.2)
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, css(i % 2 ? A : B, 0.14))
      rg.addColorStop(1, css(i % 2 ? A : B, 0))
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, w, h)
    }
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.8})`
      ctx.beginPath()
      ctx.arc(rand() * w, rand() * h, 0.4 + rand() * 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowColor = css(lerp3(B, [255, 255, 255], 0.6))
    ctx.shadowBlur = 12
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(rand() * w, rand() * h, 1.5 + rand() * 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  } else if (styleId.value === 'grid') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, css(dark(A, 0.8)))
    g.addColorStop(1, css(dark(B, 0.75)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.5)
    glow.addColorStop(0, css(A, 0.3))
    glow.addColorStop(1, css(A, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    const step = 64
    for (let x = 0, i = 0; x <= w; x += step, i++) {
      ctx.strokeStyle = i % 4 === 0 ? css(B, 0.18) : 'rgba(255,255,255,0.05)'
      ctx.lineWidth = i % 4 === 0 ? 1.5 : 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0, i = 0; y <= h; y += step, i++) {
      ctx.strokeStyle = i % 4 === 0 ? css(B, 0.18) : 'rgba(255,255,255,0.05)'
      ctx.lineWidth = i % 4 === 0 ? 1.5 : 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.shadowColor = css(B)
    ctx.shadowBlur = 8
    for (let i = 0; i < 30; i++) {
      const x = Math.round((rand() * w) / step) * step
      const y = Math.round((rand() * h) / step) * step
      ctx.fillStyle = css(B, 0.6)
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  } else if (styleId.value === 'lowpoly') {
    const cols = 12
    const rows = 7
    const cw = w / cols
    const ch = h / rows
    const pts: { x: number; y: number }[][] = []
    for (let r = 0; r <= rows; r++) {
      pts[r] = []
      for (let c = 0; c <= cols; c++) {
        const edge = r === 0 || r === rows || c === 0 || c === cols
        pts[r][c] = {
          x: c * cw + (edge ? 0 : (rand() - 0.5) * cw * 0.7),
          y: r * ch + (edge ? 0 : (rand() - 0.5) * ch * 0.7),
        }
      }
    }
    const tri = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
      const t = Math.min(1, Math.max(0, (p1.x + p2.x + p3.x) / 3 / w + (rand() - 0.5) * 0.25))
      const shade = 1 - rand() * 0.3
      const c = lerp3(A, B, t).map((v) => v * shade) as RGB
      ctx.fillStyle = css(c)
      ctx.strokeStyle = css(c)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.lineTo(p3.x, p3.y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tri(pts[r][c], pts[r][c + 1], pts[r + 1][c])
        tri(pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c])
      }
    }
  }
}

function render() {
  const c = canvasRef.value
  if (!c) return
  draw(c.getContext('2d')!, c.width, c.height)
}

function exportPNG(scale = 1) {
  const c = document.createElement('canvas')
  c.width = 1920 * scale
  c.height = 1080 * scale
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)
  draw(ctx, 1920, 1080)
  c.toBlob(
    (b) => b && downloadBlob(b, `omnistudio-bg-${styleId.value}-${c.width}x${c.height}.png`),
    'image/png',
  )
}

function randomize() {
  seed.value = Math.floor(Math.random() * 1e9)
}

watch([styleId, colorA, colorB, seed], render)
onMounted(render)
</script>

<template>
  <div class="module">
    <div class="viewport preview-wrap">
      <canvas ref="canvasRef" width="1920" height="1080" class="preview" />
      <div class="hud">1920 × 1080 实时预览 · 可导出 1080p / 4K PNG</div>
    </div>
    <div class="side-panel">
      <div class="group">
        <h3>背景风格</h3>
        <div class="row">
          <button
            v-for="s in STYLES"
            :key="s.id"
            class="btn"
            :class="{ active: styleId === s.id }"
            @click="styleId = s.id"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <div class="group">
        <h3>配色</h3>
        <label class="field">主色 <input v-model="colorA" type="color" /></label>
        <label class="field">辅色 <input v-model="colorB" type="color" /></label>
        <button class="btn" @click="randomize">🎲 随机换一批（种子 {{ seed }}）</button>
      </div>
      <div class="group">
        <h3>导出</h3>
        <div class="row">
          <button class="btn primary" @click="exportPNG(1)">导出 1080p</button>
          <button class="btn" @click="exportPNG(2)">导出 4K</button>
        </div>
        <p class="hint">适合做视频会议虚拟背景、直播间背景、桌面壁纸或电商海报底图。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-wrap {
  display: grid;
  place-items: center;
  background: #0a0c11;
  padding: 24px;
}
.preview {
  max-width: 100%;
  max-height: 100%;
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.55);
}
</style>
