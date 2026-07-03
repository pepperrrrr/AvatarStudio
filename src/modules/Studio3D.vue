<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { downloadBlob } from '../lib/download'

const container = ref<HTMLElement | null>(null)
const mode = ref<'translate' | 'rotate' | 'scale'>('translate')
const hasSelection = ref(false)
const selName = ref('')
const matColor = ref('#4f8cff')
const metalness = ref(0.15)
const roughness = ref(0.55)
const objectCount = ref(0)

const PALETTE = ['#4f8cff', '#ff6b6b', '#ffd166', '#63d471', '#b197fc', '#ff9f43', '#4dd4e8']

const SHAPES: Record<string, { label: string; make: () => THREE.BufferGeometry; y: number }> = {
  box: { label: '立方体', make: () => new THREE.BoxGeometry(1, 1, 1), y: 0.5 },
  sphere: { label: '球体', make: () => new THREE.SphereGeometry(0.6, 48, 24), y: 0.6 },
  cylinder: { label: '圆柱', make: () => new THREE.CylinderGeometry(0.5, 0.5, 1.2, 40), y: 0.6 },
  cone: { label: '圆锥', make: () => new THREE.ConeGeometry(0.6, 1.3, 40), y: 0.65 },
  torus: { label: '圆环', make: () => new THREE.TorusGeometry(0.55, 0.22, 20, 60), y: 0.77 },
  knot: { label: '环结', make: () => new THREE.TorusKnotGeometry(0.45, 0.16, 120, 20), y: 0.85 },
}

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let orbit: OrbitControls
let gizmo: TransformControls
let userGroup: THREE.Group
let selected: THREE.Mesh | null = null
let raf = 0
let ro: ResizeObserver | null = null
let counter = 0
let active = true
let downX = 0
let downY = 0

function init() {
  const el = container.value!
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#12151c')

  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  camera.position.set(6, 5, 8)

  orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(0, 0.8, 0)
  orbit.enableDamping = true

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(6, 10, 4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -12
  sun.shadow.camera.right = 12
  sun.shadow.camera.top = 12
  sun.shadow.camera.bottom = -12
  scene.add(sun)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#1a1f2a', roughness: 0.95 }),
  )
  ground.receiveShadow = true
  ground.position.y = -0.001
  scene.add(ground)

  const grid = new THREE.GridHelper(20, 40, 0x33405c, 0x232a3a)
  const gridMat = grid.material as THREE.Material
  gridMat.transparent = true
  gridMat.opacity = 0.6
  scene.add(grid)

  userGroup = new THREE.Group()
  scene.add(userGroup)

  gizmo = new TransformControls(camera, renderer.domElement)
  ;(gizmo as any).addEventListener('dragging-changed', (e: any) => {
    orbit.enabled = !e.value
  })
  scene.add(gizmo.getHelper())

  ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  window.addEventListener('keydown', onKey)
  start()
  addShape('box')
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

function onPointerDown(e: PointerEvent) {
  downX = e.clientX
  downY = e.clientY
}

function onPointerUp(e: PointerEvent) {
  // 拖动视角或拖动 gizmo 时不改变选中
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return
  if ((gizmo as any).dragging) return
  const rect = renderer!.domElement.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  )
  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObjects(userGroup.children, false)[0]
  select(hit ? (hit.object as THREE.Mesh) : null)
}

function select(mesh: THREE.Mesh | null) {
  selected = mesh
  hasSelection.value = !!mesh
  if (mesh) {
    gizmo.attach(mesh)
    selName.value = mesh.name
    const m = mesh.material as THREE.MeshStandardMaterial
    matColor.value = '#' + m.color.getHexString()
    metalness.value = m.metalness
    roughness.value = m.roughness
  } else {
    gizmo.detach()
    selName.value = ''
  }
}

function addShape(kind: string) {
  const def = SHAPES[kind]
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE[counter % PALETTE.length],
    metalness: 0.15,
    roughness: 0.55,
  })
  const mesh = new THREE.Mesh(def.make(), mat)
  counter++
  mesh.name = `${def.label} ${counter}`
  const spread = userGroup.children.length ? 2.6 : 0
  mesh.position.set((Math.random() - 0.5) * spread * 2, def.y, (Math.random() - 0.5) * spread * 2)
  mesh.castShadow = mesh.receiveShadow = true
  userGroup.add(mesh)
  objectCount.value = userGroup.children.length
  select(mesh)
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
}

function deleteSelected() {
  if (!selected) return
  const doomed = selected
  select(null)
  userGroup.remove(doomed)
  disposeMesh(doomed)
  objectCount.value = userGroup.children.length
}

function clearAll() {
  select(null)
  ;[...userGroup.children].forEach((c) => {
    userGroup.remove(c)
    disposeMesh(c as THREE.Mesh)
  })
  objectCount.value = 0
}

function onKey(e: KeyboardEvent) {
  if (!active) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
  if (e.key === 'g') mode.value = 'translate'
  if (e.key === 'r') mode.value = 'rotate'
  if (e.key === 's') mode.value = 'scale'
}

function exportGLB() {
  if (!userGroup.children.length) return alert('场景是空的，先添加一个几何体吧')
  new GLTFExporter().parse(
    userGroup,
    (res) => downloadBlob(res as ArrayBuffer, 'omnistudio-model.glb', 'model/gltf-binary'),
    (err) => console.error(err),
    { binary: true },
  )
}

function exportSTL() {
  if (!userGroup.children.length) return alert('场景是空的，先添加一个几何体吧')
  const data = new STLExporter().parse(userGroup, { binary: true })
  downloadBlob(data as unknown as DataView, 'omnistudio-model.stl', 'model/stl')
}

watch(mode, (m) => gizmo?.setMode(m))
watch(matColor, (c) => {
  if (selected) (selected.material as THREE.MeshStandardMaterial).color.set(c)
})
watch([metalness, roughness], ([m, r]) => {
  if (!selected) return
  const mat = selected.material as THREE.MeshStandardMaterial
  mat.metalness = m
  mat.roughness = r
})

onMounted(init)
onActivated(() => {
  active = true
  resize()
  start()
})
onDeactivated(() => {
  active = false
  stop()
})
onBeforeUnmount(() => {
  stop()
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
  renderer?.dispose()
})
</script>

<template>
  <div class="module">
    <div ref="container" class="viewport">
      <div class="hud">单击选中物体 · 拖动手柄变换 · G/R/S 切换模式 · Delete 删除</div>
    </div>
    <div class="side-panel">
      <div class="group">
        <h3>添加几何体</h3>
        <div class="row">
          <button v-for="(def, k) in SHAPES" :key="k" class="btn" @click="addShape(k as string)">
            {{ def.label }}
          </button>
        </div>
      </div>
      <div class="group">
        <h3>变换模式</h3>
        <div class="row">
          <button class="btn" :class="{ active: mode === 'translate' }" @click="mode = 'translate'">移动</button>
          <button class="btn" :class="{ active: mode === 'rotate' }" @click="mode = 'rotate'">旋转</button>
          <button class="btn" :class="{ active: mode === 'scale' }" @click="mode = 'scale'">缩放</button>
        </div>
      </div>
      <div v-if="hasSelection" class="group">
        <h3>材质 · {{ selName }}</h3>
        <label class="field">颜色 <input v-model="matColor" type="color" /></label>
        <label class="field">
          金属度 {{ metalness.toFixed(2) }}
          <input v-model.number="metalness" type="range" min="0" max="1" step="0.01" />
        </label>
        <label class="field">
          粗糙度 {{ roughness.toFixed(2) }}
          <input v-model.number="roughness" type="range" min="0" max="1" step="0.01" />
        </label>
        <button class="btn danger" @click="deleteSelected">删除选中</button>
      </div>
      <div v-else class="group">
        <h3>材质</h3>
        <p class="hint">在场景中单击一个物体，即可编辑它的颜色、金属度与粗糙度。</p>
      </div>
      <div class="group">
        <h3>导出 · 共 {{ objectCount }} 个物体</h3>
        <div class="row">
          <button class="btn primary" @click="exportGLB">导出 GLB</button>
          <button class="btn" @click="exportSTL">导出 STL（3D 打印）</button>
          <button class="btn" @click="clearAll">清空场景</button>
        </div>
      </div>
    </div>
  </div>
</template>
