# AvatarStudio（OmniStudio 全能建模平台）

一个纯前端、本地运行的多模块创作平台：3D 建模、2D 设计、VTuber 虚拟形象、虚拟背景生成、程序化风景生成，外加一只可以放在桌面上的 **Claude Code 桌宠**。

技术栈：Vue 3 + TypeScript + Vite + Three.js（无后端，数据不出设备）

**在线体验**：https://pepperrrrr.github.io/AvatarStudio/

## 模块一览

| 模块 | 功能 | 导出 |
|---|---|---|
| 3D 建模 | 六种几何体、选中/移动/旋转/缩放（G/R/S）、材质编辑、实时阴影 | GLB / STL |
| 2D 设计 | 画笔、橡皮、直线、矩形、椭圆、文字、撤销 | PNG |
| 虚拟形象 | VRoid 式捏人 + Live2D 式参数表情 + VTube Studio 式追踪（指针视线 / 自动眨眼 / 呼吸 / 麦克风口型） | PNG / 分层 PNG（Live2D 拆件）/ 形象 JSON |
| 虚拟背景 | 6 种风格种子化生成（渐变 / 光斑 / 波浪 / 星空 / 网格 / 低多边形） | 1080p / 4K PNG |
| 风景生成 | 分形噪声地形 + 湖泊 + 雪线 + 实例化树木，种子可复现 | PNG / GLB |

## Claude Code 桌宠（desktop-pet/）

星芒造型的"小 Claude"，悬浮在桌面最顶层：

- 视线跟随全局鼠标光标（真·全屏追踪，不限于窗口内）
- 自动眨眼、呼吸浮动、投影脚感
- 点击换心情（默认 / 开心 / 惊讶 / 打盹），冒爱心
- 终端风格气泡（`❯ 正在思考…`、`❯ git push origin main`…）
- 整体可拖拽移动，悬停出现 ✕ 退出
- 低占用：单个小窗口 + 轻量定时器

```bash
cd desktop-pet
npm install
npm start
```

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`）。

## 市场调研 → 功能对照

**桌宠类**（参考 Shimeji / Desktop Goose / VPet / Bongo Cat）：

| 市场核心功能 | 状态 |
|---|---|
| 置顶悬浮、全屏可见 | ✅ |
| 拖拽移动、点击互动 | ✅ |
| 待机动画（眨眼/呼吸/表情） | ✅ |
| 低资源占用 | ✅ |
| 屏幕边缘行走/爬窗（Shimeji 式） | 🗺 roadmap |
| 多只同屏、换装 | 🗺 roadmap |

**VTuber 工具类**（参考 VTube Studio / Live2D Cubism / VRoid Studio / VSeeFace）：

| 市场核心功能 | 状态 |
|---|---|
| 捏人（发型/配色/配饰） | ✅ |
| 参数化表情、口型 | ✅ |
| 指针追踪 + 麦克风口型同步 | ✅ |
| 分层素材导出（对接 Live2D 拆件） | ✅ |
| 摄像头面捕（MediaPipe FaceMesh） | 🗺 roadmap |
| VRM 导入/导出（three-vrm） | 🗺 roadmap |
| 手部追踪 | 🗺 roadmap |

## License

MIT
