<script setup lang="ts">
import { shallowRef } from 'vue'
import Studio3D from './modules/Studio3D.vue'
import Design2D from './modules/Design2D.vue'
import AvatarStudio from './modules/AvatarStudio.vue'
import BackgroundLab from './modules/BackgroundLab.vue'
import Landscape from './modules/Landscape.vue'

const modules = [
  { id: '3d', label: '3D 建模', desc: '几何体 · 材质 · 导出', icon: '◆', comp: Studio3D },
  { id: '2d', label: '2D 设计', desc: '画笔 · 图形 · 文字', icon: '✎', comp: Design2D },
  { id: 'avatar', label: '虚拟形象', desc: 'VTuber · 捏人 · 参数动作', icon: '✦', comp: AvatarStudio },
  { id: 'bg', label: '虚拟背景', desc: '会议 · 直播 · 壁纸', icon: '▦', comp: BackgroundLab },
  { id: 'scenery', label: '风景生成', desc: '程序化地形 · 树木 · 湖泊', icon: '△', comp: Landscape },
]
const current = shallowRef(modules[0])
</script>

<template>
  <div class="shell">
    <aside>
      <div class="logo">
        <span class="logo-mark">◈</span>
        <div>
          <strong>OmniStudio</strong>
          <small>全能建模平台</small>
        </div>
      </div>
      <nav>
        <button
          v-for="m in modules"
          :key="m.id"
          class="nav-item"
          :class="{ active: current.id === m.id }"
          @click="current = m"
        >
          <span class="nav-icon">{{ m.icon }}</span>
          <span class="nav-text">
            <strong>{{ m.label }}</strong>
            <small>{{ m.desc }}</small>
          </span>
        </button>
      </nav>
      <footer>本地运行 · 数据不出设备</footer>
    </aside>
    <main>
      <keep-alive>
        <component :is="current.comp" />
      </keep-alive>
    </main>
  </div>
</template>

<style scoped>
.shell { display: flex; height: 100%; }
aside {
  width: 216px;
  flex-shrink: 0;
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.logo {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 18px 16px;
  border-bottom: 1px solid var(--border);
}
.logo-mark { font-size: 22px; color: var(--accent); }
.logo strong { display: block; font-size: 15px; }
.logo small { color: var(--text-dim); font-size: 11px; }
nav { padding: 10px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.nav-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  text-align: left;
  border: 1px solid transparent;
}
.nav-item:hover { background: var(--bg-3); }
.nav-item.active { background: rgba(79, 140, 255, .14); border-color: rgba(79, 140, 255, .45); }
.nav-icon {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--bg-3);
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 14px;
  flex-shrink: 0;
}
.nav-text strong { display: block; font-size: 13.5px; }
.nav-text small { color: var(--text-dim); font-size: 11px; }
footer {
  padding: 12px 16px;
  font-size: 11px;
  color: var(--text-dim);
  border-top: 1px solid var(--border);
}
main { flex: 1; min-width: 0; }
</style>
