<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, nextTick } from 'vue'
import { downloadBlob } from '../lib/download'

// —— 外观（VRoid 式捏人）——
const hairstyle = ref<'twin' | 'long' | 'bob'>('twin')
const hairColor = ref('#7a5cff')
const eyeColor = ref('#4f8cff')
const skin = ref('#ffe3d0')
const outfit = ref('#3b4a8f')
const blush = ref(0.35)
const accCat = ref(true)
const accRibbon = ref(false)
const accGlasses = ref(false)
const bgOn = ref(false)
const bgColor = ref('#bfe3d8')

const HAIRSTYLES = [
  { id: 'twin', label: '双马尾' },
  { id: 'long', label: '长发' },
  { id: 'bob', label: '短发' },
] as const
const SKINS = ['#ffe3d0', '#ffd6bd', '#f3c39f', '#d9a077']

// —— 表情（Live2D 式参数预设）——
const EXPRS: Record<string, { label: string; eye: number; mouth: number; curve: number; browY: number; browAngle: number; blush: number }> = {
  neutral: { label: '默认', eye: 1, mouth: 0, curve: 5, browY: 0, browAngle: 0, blush: 0 },
  smile: { label: '微笑', eye: 0.3, mouth: 0.18, curve: 8, browY: -1.5, browAngle: 0, blush: 0.25 },
  surprise: { label: '惊讶', eye: 1, mouth: 0.8, curve: 0, browY: -6, browAngle: 0, blush: 0 },
  angry: { label: '生气', eye: 0.8, mouth: 0.3, curve: -5, browY: 2, browAngle: 16, blush: 0 },
  shy: { label: '害羞', eye: 0.55, mouth: 0.12, curve: 5, browY: 0, browAngle: -5, blush: 0.85 },
}
const exprId = ref('neutral')

// —— 动作 / 追踪（VTube Studio 式）——
const follow = ref(true)
const autoBlink = ref(true)
const breathe = ref(true)
const micOn = ref(false)
const headX = ref(0)
const headY = ref(0)
const mouthSlider = ref(0)

// 动画状态
const lx = ref(0)
const ly = ref(0)
const blinkV = ref(0)
const breathV = ref(0)
const micV = ref(0)
const exporting = ref(false)

const svgRef = ref<SVGSVGElement | null>(null)
const stage = ref<HTMLElement | null>(null)

let raf = 0
let tgtX = 0
let tgtY = 0
let blinkStart = -1e9
let nextBlink = 0
let stream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let audioBuf: Uint8Array | null = null

// —— 颜色工具 ——
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `rgb(${r},${g},${b})`
}
const hairDark = computed(() => shade(hairColor.value, -0.22))
const hairLight = computed(() => shade(hairColor.value, 0.35))
const eyeLight = computed(() => shade(eyeColor.value, 0.4))
const eyeDark = computed(() => shade(eyeColor.value, -0.55))
const skinLine = computed(() => shade(skin.value, -0.38))
const skinShadow = computed(() => shade(skin.value, -0.14))
const outfitDark = computed(() => shade(outfit.value, -0.3))

// —— 有效参数 ——
const expr = computed(() => EXPRS[exprId.value])
const eyeEff = computed(() => {
  if (exporting.value) return 1
  return Math.max(0, Math.min(1, expr.value.eye * (1 - blinkV.value)))
})
const mouthEff = computed(() => {
  if (exporting.value) return 0
  if (micOn.value) return micV.value
  return Math.max(expr.value.mouth, mouthSlider.value)
})
const blushEff = computed(() => Math.min(1, blush.value + expr.value.blush))

// —— 分层变换（视差营造 Live2D 的伪 3D 感）——
const fx = computed(() => (exporting.value ? 0 : lx.value))
const fy = computed(() => (exporting.value ? 0 : ly.value))
const bob = computed(() => (exporting.value ? 0 : breathV.value))
const headT = computed(
  () => `translate(${(fx.value * 10).toFixed(2)} ${(fy.value * 7 + bob.value * 2.2).toFixed(2)}) rotate(${(fx.value * 4).toFixed(2)} 200 300)`,
)
const backT = computed(
  () => `translate(${(fx.value * 5).toFixed(2)} ${(fy.value * 4 + bob.value * 1.7).toFixed(2)}) rotate(${(fx.value * 2.5).toFixed(2)} 200 300)`,
)
const bodyT = computed(() => `translate(${(fx.value * 3).toFixed(2)} ${(bob.value * 1.4).toFixed(2)})`)
const tailSway = computed(() => `rotate(${(bob.value * 2.5 + fx.value * 7).toFixed(2)})`)
const gazeX = computed(() => fx.value * 5)
const gazeY = computed(() => fy.value * 3)
const lidY = computed(() => -46 + 32 * (1 - eyeEff.value))
const lashDrop = computed(() => (1 - eyeEff.value) * 12)
const browT = computed(() => `translate(0 ${expr.value.browY})`)
const closedMouthD = computed(() => `M 188 253 Q 200 ${253 + expr.value.curve} 212 253`)
const closedMouthOp = computed(() => Math.max(0, 1 - mouthEff.value * 2.2))

const EYES = [166, 234]

// —— 动画主循环 ——
function tick(now: number) {
  raf = requestAnimationFrame(tick)
  breathV.value = breathe.value ? Math.sin(now / 1300) : 0
  const gx = follow.value ? tgtX : headX.value
  const gy = follow.value ? tgtY : headY.value
  lx.value += (gx - lx.value) * 0.09
  ly.value += (gy - ly.value) * 0.09
  if (autoBlink.value) {
    if (now >= nextBlink) {
      blinkStart = now
      nextBlink = now + 1900 + Math.random() * 3300
    }
    const ph = (now - blinkStart) / 150
    blinkV.value = ph >= 0 && ph <= 1 ? Math.sin(Math.PI * ph) : 0
  } else {
    blinkV.value = 0
  }
  if (analyser && audioBuf) {
    analyser.getByteTimeDomainData(audioBuf)
    let sum = 0
    for (let i = 0; i < audioBuf.length; i++) {
      const v = (audioBuf[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / audioBuf.length)
    micV.value += (Math.min(1, rms * 7) - micV.value) * 0.35
  }
}
function start() {
  if (!raf) raf = requestAnimationFrame(tick)
}
function stop() {
  cancelAnimationFrame(raf)
  raf = 0
}

function onPointerMove(e: PointerEvent) {
  if (!follow.value || !stage.value) return
  const r = stage.value.getBoundingClientRect()
  tgtX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
  tgtY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
}

// —— 麦克风口型同步 ——
async function toggleMic() {
  if (analyser) {
    stream?.getTracks().forEach((t) => t.stop())
    audioCtx?.close()
    stream = null
    audioCtx = null
    analyser = null
    micOn.value = false
    micV.value = 0
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext()
    const src = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    audioBuf = new Uint8Array(analyser.fftSize)
    src.connect(analyser)
    micOn.value = true
  } catch {
    alert('无法访问麦克风，请检查系统权限设置')
  }
}

// —— 导出 ——
async function rasterize(keep?: string[]): Promise<Blob> {
  exporting.value = true
  await nextTick()
  const clone = svgRef.value!.cloneNode(true) as SVGSVGElement
  exporting.value = false
  if (keep) {
    clone.querySelectorAll('[data-layer]').forEach((g) => {
      if (!keep.includes(g.getAttribute('data-layer')!)) g.remove()
    })
  }
  if (!bgOn.value || keep) clone.querySelector('#bg-rect')?.remove()
  clone.setAttribute('width', '800')
  clone.setAttribute('height', '1000')
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = 800
    c.height = 1000
    c.getContext('2d')!.drawImage(img, 0, 0, 800, 1000)
    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function exportPNG() {
  downloadBlob(await rasterize(), 'omnistudio-avatar.png')
}

async function exportLayers() {
  // Live2D Cubism 拆件常用的分层素材：后发 / 身体 / 头部（脸+五官+前发）
  const layers: [string, string][] = [
    ['back', '后发'],
    ['body', '身体'],
    ['head', '头部'],
  ]
  for (const [id, name] of layers) {
    downloadBlob(await rasterize([id]), `omnistudio-avatar-${name}.png`)
  }
}

function saveJSON() {
  const data = {
    hairstyle: hairstyle.value,
    hairColor: hairColor.value,
    eyeColor: eyeColor.value,
    skin: skin.value,
    outfit: outfit.value,
    blush: blush.value,
    accCat: accCat.value,
    accRibbon: accRibbon.value,
    accGlasses: accGlasses.value,
    bgOn: bgOn.value,
    bgColor: bgColor.value,
  }
  downloadBlob(JSON.stringify(data, null, 2), 'omnistudio-avatar.json', 'application/json')
}

const fileInput = ref<HTMLInputElement | null>(null)
function loadJSON(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  file.text().then((txt) => {
    try {
      const d = JSON.parse(txt)
      if (d.hairstyle) hairstyle.value = d.hairstyle
      if (d.hairColor) hairColor.value = d.hairColor
      if (d.eyeColor) eyeColor.value = d.eyeColor
      if (d.skin) skin.value = d.skin
      if (d.outfit) outfit.value = d.outfit
      if (typeof d.blush === 'number') blush.value = d.blush
      accCat.value = !!d.accCat
      accRibbon.value = !!d.accRibbon
      accGlasses.value = !!d.accGlasses
      bgOn.value = !!d.bgOn
      if (d.bgColor) bgColor.value = d.bgColor
    } catch {
      alert('这个文件不是有效的形象 JSON')
    }
  })
  ;(e.target as HTMLInputElement).value = ''
}

onMounted(start)
onActivated(start)
onDeactivated(stop)
onBeforeUnmount(() => {
  stop()
  stream?.getTracks().forEach((t) => t.stop())
  audioCtx?.close()
})
</script>

<template>
  <div class="module">
    <div ref="stage" class="viewport stage" :class="{ 'has-bg': bgOn }" @pointermove="onPointerMove">
      <svg ref="svgRef" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" class="avatar">
        <defs>
          <radialGradient id="irisGrad" cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" :stop-color="eyeLight" />
            <stop offset="100%" :stop-color="eyeColor" />
          </radialGradient>
          <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="hairLight" />
            <stop offset="55%" :stop-color="hairColor" />
          </linearGradient>
          <clipPath id="eyeClip">
            <ellipse cx="0" cy="0" rx="17" ry="14" />
          </clipPath>
        </defs>

        <rect v-if="bgOn" id="bg-rect" x="0" y="0" width="400" height="500" :fill="bgColor" />

        <!-- 后发层：视差幅度小于头部，营造纵深 -->
        <g data-layer="back" :transform="backT">
          <template v-if="hairstyle === 'twin'">
            <path
              d="M 200 100 C 135 100 112 150 116 210 C 118 240 125 260 132 270 C 140 230 138 190 142 170 C 180 150 220 150 258 170 C 262 190 260 230 268 270 C 275 260 282 240 284 210 C 288 150 265 100 200 100 Z"
              :fill="hairDark"
            />
            <g transform="translate(118 192)">
              <g :transform="tailSway">
                <path d="M 0 0 C -32 60 -26 145 -5 205 C 2 215 9 215 13 204 C 24 142 16 58 8 -2 Z" :fill="hairDark" />
                <path d="M 2 10 C -18 60 -15 130 -2 180" :stroke="hairLight" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round" />
              </g>
              <circle cx="4" cy="0" r="7" fill="#ff5f7e" :stroke="shade('#ff5f7e', -0.3)" stroke-width="1.5" />
            </g>
            <g transform="translate(282 192)">
              <g :transform="tailSway">
                <path d="M 0 0 C 32 60 26 145 5 205 C -2 215 -9 215 -13 204 C -24 142 -16 58 -8 -2 Z" :fill="hairDark" />
                <path d="M -2 10 C 18 60 15 130 2 180" :stroke="hairLight" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round" />
              </g>
              <circle cx="-4" cy="0" r="7" fill="#ff5f7e" :stroke="shade('#ff5f7e', -0.3)" stroke-width="1.5" />
            </g>
          </template>
          <path
            v-else-if="hairstyle === 'long'"
            d="M 200 98 C 128 98 104 160 108 240 C 110 330 96 420 90 462 L 120 440 L 140 468 L 165 442 L 185 470 L 205 444 L 228 470 L 250 442 L 272 466 L 292 440 L 310 462 C 304 420 290 330 292 240 C 296 160 272 98 200 98 Z"
            :fill="hairDark"
          />
          <path
            v-else
            d="M 200 100 C 132 100 110 150 114 215 C 116 262 130 296 155 308 C 148 282 146 250 149 220 C 184 200 216 200 251 220 C 254 250 252 282 245 308 C 270 296 284 262 286 215 C 290 150 268 100 200 100 Z"
            :fill="hairDark"
          />
        </g>

        <!-- 身体层 -->
        <g data-layer="body" :transform="bodyT">
          <path d="M 186 268 C 186 320 186 340 188 356 L 212 356 C 214 340 214 320 214 268 Z" :fill="skin" :stroke="skinLine" stroke-width="1.5" />
          <path d="M 187 280 Q 200 292 213 280 L 213 298 Q 200 306 187 298 Z" :fill="skinShadow" opacity="0.8" />
          <path
            d="M 118 500 C 118 420 140 368 178 350 C 186 346 194 344 200 344 C 206 344 214 346 222 350 C 260 368 282 420 282 500 Z"
            :fill="outfit"
          />
          <path d="M 160 348 L 200 366 L 240 348 L 234 398 L 200 374 L 166 398 Z" :fill="outfitDark" />
          <path d="M 200 366 L 240 348 L 234 398 L 200 374 Z" fill="rgba(255,255,255,0.12)" />
          <g transform="translate(200 378)">
            <path d="M 0 0 L -16 -8 L -14 10 Z" fill="#ff5f7e" />
            <path d="M 0 0 L 16 -8 L 14 10 Z" fill="#ff5f7e" />
            <circle cx="0" cy="0" r="4" :fill="shade('#ff5f7e', -0.25)" />
          </g>
        </g>

        <!-- 头部层：脸 + 五官 + 前发 + 配饰 -->
        <g data-layer="head" :transform="headT">
          <ellipse cx="124" cy="212" rx="9" ry="13" :fill="skin" :stroke="skinLine" stroke-width="1.5" />
          <ellipse cx="276" cy="212" rx="9" ry="13" :fill="skin" :stroke="skinLine" stroke-width="1.5" />
          <path
            d="M 200 118 C 155 118 125 150 125 200 C 125 235 150 268 176 284 C 187 291 197 294 200 294 C 203 294 213 291 224 284 C 250 268 275 235 275 200 C 275 150 245 118 200 118 Z"
            :fill="skin"
            :stroke="skinLine"
            stroke-width="2"
          />

          <ellipse cx="150" cy="242" rx="14" ry="7" fill="#ff8fa3" :opacity="blushEff * 0.7" />
          <ellipse cx="250" cy="242" rx="14" ry="7" fill="#ff8fa3" :opacity="blushEff * 0.7" />

          <!-- 眼睛：眼睑滑动实现眨眼，瞳孔跟随视线 -->
          <g v-for="cx in EYES" :key="cx" :transform="`translate(${cx} 212)`">
            <g clip-path="url(#eyeClip)">
              <ellipse cx="0" cy="0" rx="17" ry="14" fill="#ffffff" />
              <circle :cx="gazeX" :cy="gazeY + 2" r="10" fill="url(#irisGrad)" />
              <circle :cx="gazeX" :cy="gazeY + 2" r="4.5" :fill="eyeDark" />
              <circle :cx="gazeX - 3.5" :cy="gazeY - 1.5" r="3" fill="#ffffff" />
              <circle :cx="gazeX + 4" :cy="gazeY + 6" r="1.6" fill="#ffffff" opacity="0.85" />
              <rect x="-19" :y="lidY" width="38" height="32" :fill="skin" />
            </g>
            <path
              d="M -18 -5 C -10 -16.5 10 -16.5 18 -5"
              stroke="#4a3a3d"
              stroke-width="4.5"
              fill="none"
              stroke-linecap="round"
              :transform="`translate(0 ${lashDrop})`"
            />
          </g>

          <g :transform="browT">
            <path :transform="`rotate(${-expr.browAngle} 180 190)`" d="M 152 191 Q 166 185 180 189" :stroke="hairDark" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <path :transform="`rotate(${expr.browAngle} 220 190)`" d="M 220 189 Q 234 185 248 191" :stroke="hairDark" stroke-width="3.5" fill="none" stroke-linecap="round" />
          </g>

          <path d="M 199 231 Q 202 233 200 236" :stroke="skinLine" stroke-width="1.8" fill="none" stroke-linecap="round" />

          <ellipse
            cx="200" cy="256"
            :rx="4 + 7 * mouthEff"
            :ry="1.2 + 11 * mouthEff"
            fill="#9e4a52"
            :opacity="mouthEff > 0.06 ? 1 : 0"
          />
          <path :d="closedMouthD" :opacity="closedMouthOp" stroke="#b35560" stroke-width="2.4" fill="none" stroke-linecap="round" />

          <!-- 前发 -->
          <path
            d="M 122 205 C 118 130 150 108 200 106 C 250 108 282 130 278 205 L 270 172 L 258 198 L 246 172 L 232 194 L 218 170 L 204 192 L 190 170 L 176 194 L 162 172 L 150 198 L 138 174 L 130 200 Z"
            fill="url(#hairGrad)"
            :stroke="hairDark"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <path d="M 122 205 C 118 250 118 280 128 310 C 136 290 138 250 134 215 Z" fill="url(#hairGrad)" :stroke="hairDark" stroke-width="1.5" />
          <path d="M 278 205 C 282 250 282 280 272 310 C 264 290 262 250 266 215 Z" fill="url(#hairGrad)" :stroke="hairDark" stroke-width="1.5" />
          <path d="M 196 112 C 178 84 210 62 224 76 C 206 74 194 92 206 110 Z" :fill="hairColor" />
          <path d="M 150 152 Q 200 130 250 152" :stroke="hairLight" stroke-width="5" fill="none" opacity="0.5" stroke-linecap="round" />

          <!-- 配饰 -->
          <g v-if="accCat">
            <path d="M 152 122 L 126 84 L 172 100 Z" :fill="hairDark" />
            <path d="M 150 116 L 134 92 L 164 102 Z" fill="#ffb7c5" />
            <path d="M 248 122 L 274 84 L 228 100 Z" :fill="hairDark" />
            <path d="M 250 116 L 266 92 L 236 102 Z" fill="#ffb7c5" />
          </g>
          <g v-if="accRibbon" transform="translate(142 138) rotate(-18)">
            <path d="M 0 0 C -22 -14 -26 12 -2 7 Z" fill="#ff5f7e" />
            <path d="M 0 0 C 20 -14 26 12 2 7 Z" fill="#ff5f7e" />
            <circle cx="0" cy="2" r="4.5" :fill="shade('#ff5f7e', -0.25)" />
          </g>
          <g v-if="accGlasses">
            <rect x="146" y="197" width="40" height="31" rx="12" fill="rgba(160,190,255,0.13)" stroke="#3a3f4c" stroke-width="2.5" />
            <rect x="214" y="197" width="40" height="31" rx="12" fill="rgba(160,190,255,0.13)" stroke="#3a3f4c" stroke-width="2.5" />
            <path d="M 186 210 C 194 204 206 204 214 210" stroke="#3a3f4c" stroke-width="2.5" fill="none" />
            <path d="M 146 208 L 128 204 M 254 208 L 272 204" stroke="#3a3f4c" stroke-width="2.5" />
          </g>
        </g>
      </svg>
      <div class="hud">移动鼠标试试 · 她会看向你 (=・ω・=) · 分层视差模拟 Live2D 伪 3D</div>
    </div>

    <div class="side-panel">
      <div class="group">
        <h3>发型（VRoid 式捏人）</h3>
        <div class="row">
          <button
            v-for="h in HAIRSTYLES"
            :key="h.id"
            class="btn"
            :class="{ active: hairstyle === h.id }"
            @click="hairstyle = h.id"
          >
            {{ h.label }}
          </button>
        </div>
        <label class="field">肤色</label>
        <div class="row">
          <button
            v-for="s in SKINS"
            :key="s"
            class="swatch"
            :style="{ background: s }"
            :class="{ picked: skin === s }"
            @click="skin = s"
          />
        </div>
      </div>
      <div class="group">
        <h3>配色</h3>
        <label class="field">发色 <input v-model="hairColor" type="color" /></label>
        <label class="field">瞳色 <input v-model="eyeColor" type="color" /></label>
        <label class="field">服装 <input v-model="outfit" type="color" /></label>
        <label class="field">
          腮红 {{ blush.toFixed(2) }}
          <input v-model.number="blush" type="range" min="0" max="1" step="0.05" />
        </label>
      </div>
      <div class="group">
        <h3>配饰</h3>
        <label class="check"><input v-model="accCat" type="checkbox" /> 猫耳</label>
        <label class="check"><input v-model="accRibbon" type="checkbox" /> 蝴蝶结发饰</label>
        <label class="check"><input v-model="accGlasses" type="checkbox" /> 眼镜</label>
      </div>
      <div class="group">
        <h3>表情</h3>
        <div class="row">
          <button
            v-for="(e, id) in EXPRS"
            :key="id"
            class="btn"
            :class="{ active: exprId === id }"
            @click="exprId = id as string"
          >
            {{ e.label }}
          </button>
        </div>
      </div>
      <div class="group">
        <h3>动作 · 追踪（VTube Studio 式）</h3>
        <label class="check"><input v-model="follow" type="checkbox" /> 视线跟随指针</label>
        <label class="check"><input v-model="autoBlink" type="checkbox" /> 自动眨眼</label>
        <label class="check"><input v-model="breathe" type="checkbox" /> 呼吸浮动</label>
        <button class="btn" :class="{ active: micOn }" @click="toggleMic">
          {{ micOn ? '🎤 口型同步中（点击关闭）' : '🎤 开启麦克风口型同步' }}
        </button>
        <template v-if="!follow">
          <label class="field">
            头部左右 {{ headX.toFixed(2) }}
            <input v-model.number="headX" type="range" min="-1" max="1" step="0.02" />
          </label>
          <label class="field">
            头部上下 {{ headY.toFixed(2) }}
            <input v-model.number="headY" type="range" min="-1" max="1" step="0.02" />
          </label>
        </template>
        <label v-if="!micOn" class="field">
          嘴巴开合 {{ mouthSlider.toFixed(2) }}
          <input v-model.number="mouthSlider" type="range" min="0" max="1" step="0.02" />
        </label>
      </div>
      <div class="group">
        <h3>背景</h3>
        <label class="check"><input v-model="bgOn" type="checkbox" /> 使用背景色（关闭则透明）</label>
        <label v-if="bgOn" class="field">背景色 <input v-model="bgColor" type="color" /></label>
      </div>
      <div class="group">
        <h3>导出</h3>
        <div class="row">
          <button class="btn primary" @click="exportPNG">导出 PNG</button>
          <button class="btn" @click="exportLayers">分层 PNG ×3</button>
          <button class="btn" @click="saveJSON">保存形象</button>
          <button class="btn" @click="fileInput?.click()">导入形象</button>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display: none" @change="loadJSON" />
        <p class="hint">分层 PNG（后发 / 身体 / 头部）可直接导入 Live2D Cubism 做拆件绑定。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  display: grid;
  place-items: center;
  cursor: crosshair;
  background:
    repeating-conic-gradient(#12151d 0% 25%, #171b25 0% 50%) 0 0 / 28px 28px;
}
.stage.has-bg { background: none; }
.avatar {
  height: min(96%, 660px);
  filter: drop-shadow(0 12px 32px rgba(0, 0, 0, 0.45));
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
