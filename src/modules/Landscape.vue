<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createNoise2D, fbm2D, mulberry32 } from '../lib/noise'
import { downloadBlob } from '../lib/download'

const container = ref<HTMLElement | null>(null)
const seed = ref(20260703)
const mountain = ref(20)
const water = ref(1.5)
const snowLine = ref(14)
const trees = ref(0.5)
const autoRotate = ref(true)
const treeCount = ref(0)

const SIZE = 220
const SEGS = 220
const HALF = SIZE / 2

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let orbit: OrbitControls
let world: THREE.Group
let raf = 0
let ro: ResizeObserver | null = null

function makeHeightFn(seedNum: number) {
  const n1 = createNoise2D(seedNum)
  const n2 = createNoise2D(seedNum + 1013)
  const amp = mountain.value
  return (x: number, z: number) => {
    let h = fbm2D(n1, x * 0.012, z * 0.012, 5)
    h += Math.abs(fbm2D(n2, x * 0.02, z * 0.02, 4)) * 0.55
    const d = Math.hypot(x, z) / HALF
    h -= d * d * 0.55
    return h * amp
  }
}

function disposeWorld() {
  world.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = (mesh as any).material
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m: THREE.Material) => m.dispose())
  })
  world.clear()
}

function buildWorld() {
  disposeWorld()

  const heightAt = makeHeightFn(seed.value)
  const jitter = createNoise2D(seed.value + 77)
  const wl = water.value
  const sl = snowLine.value

  // —— 地形 ——
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const deep = new THREE.Color('#31544a')
  const sand = new THREE.Color('#c9b678')
  const grass = new THREE.Color('#4a8a44')
  const rock = new THREE.Color('#77705f')
  const snow = new THREE.Color('#f5f8fc')

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = heightAt(x, z)
    pos.setY(i, y)
    // 色带边界加噪声抖动，避免生硬的等高线
    const t = y + jitter(x * 0.15, z * 0.15) * 0.9
    if (t < wl - 1.5) c.copy(deep)
    else if (t < wl + 0.7) c.copy(deep).lerp(sand, (t - (wl - 1.5)) / 2.2)
    else if (t < wl + 2) c.copy(sand).lerp(grass, (t - wl - 0.7) / 1.3)
    else if (t < sl - 3) {
      c.copy(grass).lerp(rock, THREE.MathUtils.clamp((t - wl - 2) / Math.max(sl - 5 - wl, 1), 0, 1))
    } else if (t < sl) c.copy(rock).lerp(snow, (t - (sl - 3)) / 3)
    else c.copy(snow)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  )
  terrain.name = 'terrain'
  world.add(terrain)

  // —— 水面 ——
  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(SIZE * 0.72, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: '#2f6fca',
      transparent: true,
      opacity: 0.78,
      roughness: 0.15,
      metalness: 0.3,
    }),
  )
  waterMesh.name = 'water'
  waterMesh.position.y = wl
  world.add(waterMesh)

  // —— 树木（实例化渲染）——
  const rand = mulberry32(seed.value + 5)
  const spots: { x: number; z: number; y: number; s: number }[] = []
  const target = Math.round(trees.value * 700)
  for (let i = 0; i < target * 6 && spots.length < target; i++) {
    const x = (rand() * 2 - 1) * (HALF * 0.92)
    const z = (rand() * 2 - 1) * (HALF * 0.92)
    const y = heightAt(x, z)
    if (y < wl + 1.2 || y > sl - 2) continue
    const slope = Math.abs(heightAt(x + 1.5, z) - y) + Math.abs(heightAt(x, z + 1.5) - y)
    if (slope > 2.2) continue
    spots.push({ x, z, y, s: 0.7 + rand() * 1.1 })
  }
  treeCount.value = spots.length
  if (spots.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.16, 0.9, 5)
    const leafGeo = new THREE.ConeGeometry(0.6, 2, 6)
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5d4632', roughness: 1 })
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2e6b34', roughness: 0.9 })
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length)
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const sc = new THREE.Vector3()
    const p = new THREE.Vector3()
    spots.forEach((t, i) => {
      sc.setScalar(t.s)
      p.set(t.x, t.y + 0.45 * t.s, t.z)
      m.compose(p, q, sc)
      trunks.setMatrixAt(i, m)
      p.set(t.x, t.y + 1.9 * t.s, t.z)
      m.compose(p, q, sc)
      leaves.setMatrixAt(i, m)
    })
    trunks.instanceMatrix.needsUpdate = true
    leaves.instanceMatrix.needsUpdate = true
    world.add(trunks, leaves)
  }
}

function init() {
  const el = container.value!
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#a8d8f0')
  scene.fog = new THREE.Fog(0xa8d8f0, 150, 450)

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200)
  camera.position.set(95, 65, 95)

  orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(0, 8, 0)
  orbit.enableDamping = true
  orbit.maxPolarAngle = Math.PI * 0.49
  orbit.autoRotate = autoRotate.value
  orbit.autoRotateSpeed = 0.8

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x55624a, 1.0))
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.0)
  sun.position.set(90, 130, -60)
  scene.add(sun)

  world = new THREE.Group()
  world.name = 'landscape'
  scene.add(world)
  buildWorld()

  ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()
  start()
}

function resize() {
  const el = container.value
  if (!el || !renderer) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function tick() {
  raf = requestAnimationFrame(tick)
  orbit.update()
  renderer!.render(scene, camera)
}
function start() {
  if (!raf && renderer) tick()
}
function stop() {
  cancelAnimationFrame(raf)
  raf = 0
}

function regenerate() {
  buildWorld()
}
function randomize() {
  seed.value = Math.floor(Math.random() * 1e9)
  buildWorld()
}

function exportPNG() {
  renderer!.domElement.toBlob((b) => b && downloadBlob(b, `omnistudio-scenery-${seed.value}.png`), 'image/png')
}

function exportGLB() {
  new GLTFExporter().parse(
    world,
    (res) => downloadBlob(res as ArrayBuffer, `omnistudio-scenery-${seed.value}.glb`, 'model/gltf-binary'),
    (err) => console.error(err),
    { binary: true },
  )
}

watch(autoRotate, (v) => {
  if (orbit) orbit.autoRotate = v
})

onMounted(init)
onActivated(() => {
  resize()
  start()
})
onDeactivated(stop)
onBeforeUnmount(() => {
  stop()
  ro?.disconnect()
  renderer?.dispose()
})
</script>

<template>
  <div class="module">
    <div ref="container" class="viewport">
      <div class="hud">拖动旋转视角 · 滚轮缩放 · 每个种子对应一片独一无二的风景</div>
    </div>
    <div class="side-panel">
      <div class="group">
        <h3>生成</h3>
        <button class="btn primary" @click="randomize">🏔 随机生成新风景</button>
        <label class="field">
          种子
          <input v-model.number="seed" type="number" @change="regenerate" />
        </label>
      </div>
      <div class="group">
        <h3>地形参数</h3>
        <label class="field">
          山体高度 {{ mountain }}
          <input v-model.number="mountain" type="range" min="8" max="35" step="1" @change="regenerate" />
        </label>
        <label class="field">
          水位 {{ water.toFixed(1) }}
          <input v-model.number="water" type="range" min="-4" max="6" step="0.5" @change="regenerate" />
        </label>
        <label class="field">
          雪线 {{ snowLine }}
          <input v-model.number="snowLine" type="range" min="6" max="30" step="1" @change="regenerate" />
        </label>
        <label class="field">
          树木密度 {{ trees.toFixed(2) }} · 当前 {{ treeCount }} 棵
          <input v-model.number="trees" type="range" min="0" max="1" step="0.05" @change="regenerate" />
        </label>
      </div>
      <div class="group">
        <h3>视角</h3>
        <label class="check"><input v-model="autoRotate" type="checkbox" /> 自动环绕旋转</label>
      </div>
      <div class="group">
        <h3>导出</h3>
        <div class="row">
          <button class="btn primary" @click="exportPNG">导出 PNG</button>
          <button class="btn" @click="exportGLB">导出 GLB 模型</button>
        </div>
        <p class="hint">PNG 可直接当壁纸或虚拟背景；GLB 可导入 Blender、Unity 等继续加工。</p>
      </div>
    </div>
  </div>
</template>
