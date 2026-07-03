<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { downloadBlob } from '../lib/download'

type Tool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'text'

const wrap = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const tool = ref<Tool>('brush')
const color = ref('#4f8cff')
const size = ref(6)
const filled = ref(false)

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'brush', label: '画笔' },
  { id: 'eraser', label: '橡皮' },
  { id: 'line', label: '直线' },
  { id: 'rect', label: '矩形' },
  { id: 'ellipse', label: '椭圆' },
  { id: 'text', label: '文字' },
]
const SWATCHES = ['#4f8cff', '#ff6b6b', '#ffd166', '#63d471', '#b197fc', '#ff9f43', '#222831', '#ffffff']

let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let sx = 0
let sy = 0
let snapshot: ImageData | null = null
let ro: ResizeObserver | null = null
const undoStack: ImageData[] = []

function resizeCanvas() {
  const c = canvasRef.value
  const el = wrap.value
  if (!c || !el || el.clientWidth < 50 || el.clientHeight < 50) return
  const w = el.clientWidth - 32
  const h = el.clientHeight - 32
  if (c.width === w && c.height === h) return
  // 改尺寸会清空画布，先暂存旧内容再画回来
  const tmp = document.createElement('canvas')
  tmp.width = c.width
  tmp.height = c.height
  tmp.getContext('2d')!.drawImage(c, 0, 0)
  c.width = w
  c.height = h
  ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(tmp, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function pos(e: PointerEvent) {
  const r = canvasRef.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function pushUndo() {
  if (!ctx) return
  undoStack.push(ctx.getImageData(0, 0, canvasRef.value!.width, canvasRef.value!.height))
  if (undoStack.length > 30) undoStack.shift()
}

function down(e: PointerEvent) {
  if (!ctx) return
  const { x, y } = pos(e)
  pushUndo()
  if (tool.value === 'text') {
    const text = window.prompt('输入文字内容：')
    if (!text) {
      undoStack.pop()
      return
    }
    ctx.fillStyle = color.value
    ctx.font = `${10 + size.value * 5}px "PingFang SC", sans-serif`
    ctx.fillText(text, x, y)
    return
  }
  drawing = true
  sx = x
  sy = y
  snapshot = ctx.getImageData(0, 0, canvasRef.value!.width, canvasRef.value!.height)
  canvasRef.value!.setPointerCapture(e.pointerId)
  if (tool.value === 'brush' || tool.value === 'eraser') strokeSeg(x, y, x, y)
}

function move(e: PointerEvent) {
  if (!drawing || !ctx) return
  const { x, y } = pos(e)
  if (tool.value === 'brush' || tool.value === 'eraser') {
    strokeSeg(sx, sy, x, y)
    sx = x
    sy = y
    return
  }
  ctx.putImageData(snapshot!, 0, 0)
  drawShape(sx, sy, x, y)
}

function up() {
  drawing = false
  snapshot = null
}

function strokeSeg(x0: number, y0: number, x1: number, y1: number) {
  if (!ctx) return
  ctx.strokeStyle = tool.value === 'eraser' ? '#ffffff' : color.value
  ctx.lineWidth = tool.value === 'eraser' ? size.value * 3 : size.value
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}

function drawShape(x0: number, y0: number, x1: number, y1: number) {
  if (!ctx) return
  ctx.strokeStyle = color.value
  ctx.fillStyle = color.value
  ctx.lineWidth = size.value
  ctx.beginPath()
  if (tool.value === 'line') {
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    return
  }
  if (tool.value === 'rect') {
    ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
  } else {
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2)
  }
  filled.value ? ctx.fill() : ctx.stroke()
}

function undo() {
  if (!ctx) return
  const img = undoStack.pop()
  if (img) ctx.putImageData(img, 0, 0)
}

function clearAll() {
  if (!ctx) return
  pushUndo()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasRef.value!.width, canvasRef.value!.height)
}

function exportPNG() {
  canvasRef.value!.toBlob((b) => b && downloadBlob(b, 'omnistudio-design.png'), 'image/png')
}

onMounted(() => {
  ro = new ResizeObserver(resizeCanvas)
  ro.observe(wrap.value!)
  resizeCanvas()
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div class="module">
    <div ref="wrap" class="viewport paper-wrap">
      <canvas
        ref="canvasRef"
        class="paper"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
      />
    </div>
    <div class="side-panel">
      <div class="group">
        <h3>工具</h3>
        <div class="row">
          <button
            v-for="t in TOOLS"
            :key="t.id"
            class="btn"
            :class="{ active: tool === t.id }"
            @click="tool = t.id"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
      <div class="group">
        <h3>颜色</h3>
        <label class="field"><input v-model="color" type="color" /></label>
        <div class="row">
          <button
            v-for="s in SWATCHES"
            :key="s"
            class="swatch"
            :style="{ background: s }"
            :class="{ picked: color === s }"
            @click="color = s"
          />
        </div>
      </div>
      <div class="group">
        <h3>笔触</h3>
        <label class="field">
          粗细 {{ size }}px
          <input v-model.number="size" type="range" min="1" max="40" step="1" />
        </label>
        <label class="check"><input v-model="filled" type="checkbox" /> 填充图形（矩形 / 椭圆）</label>
      </div>
      <div class="group">
        <h3>操作</h3>
        <div class="row">
          <button class="btn" @click="undo">撤销</button>
          <button class="btn" @click="clearAll">清空画布</button>
          <button class="btn primary" @click="exportPNG">导出 PNG</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paper-wrap {
  display: grid;
  place-items: center;
  background: #0a0c11;
}
.paper {
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.55);
  cursor: crosshair;
  touch-action: none;
}
.swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border);
}
.swatch.picked {
  border-color: var(--accent);
  transform: scale(1.12);
}
</style>
