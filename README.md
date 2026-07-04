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

## Claude Code 桌宠 · Clawd（desktop-pet/）

默认形象是一个**动漫角色**：紫色刘海 + 肩上两个小啾啾、**汽车速度表盘造型的眼睛**、毛茸茸白色小狗连体衣（带狗耳/爪套），支持**站立 / 坐下**两种姿势（自动切换，点一下也能坐/起）。另内置 Clawd 像素形象（`buildClaudePet()`，移植自 MIT 的 [stevysmith/clawd-react](https://github.com/stevysmith/clawd-react)，见 [desktop-pet/CREDITS.md](desktop-pet/CREDITS.md)）与一句话生成的自定义皮肤。

**自主行为（无需操作，自己活动）**
- 🚶 **走动**：随机四处走，四条腿交替摆动，转身面朝前进方向
- ⚽ **踢足球**：自己召唤足球、追球、射门；球带重力/弹跳/滚动物理，撞墙反弹；点球或点身体也能踢
- 😴 **打盹**：坐下半闭眼冒 z，休息一会儿再起来
- 🧠 **发呆**：idle 时头顶火花亮起（Clawd 的 thinking 态）

**互动 & 外观**
- 视线跟随全局鼠标光标；自动眨眼、呼吸浮动、投影脚感
- 点击换心情、冒爱心；终端风格气泡（`❯ git push origin main`…）
- 悬停出现 ✕ 退出 / ✎ 生成 / ↺ 还原；低占用

> 关于原型：Clawd 是 Anthropic **未公开说明**的吉祥物，官方没有可复用的素材或 API。本项目根据社区逆向（`claude-code-mascot-statusline` 的 16×16 像素网格格式、Codrops 的 SVG 逆向）自行重建，力求形似。

### ✎ 一句话生成新桌宠（离线程序化生成）

点 ✎ 输入一句描述，即时拼装出全新桌宠皮肤，**无需联网、无需 API、不花额度**：

- **颜色**：橙/红/粉/黄/绿/蓝/青/紫/棕/黑/白/灰/彩虹
- **种类**：猫/狐狸/兔/熊/熊猫/狗/鼠/企鹅/青蛙/鸡鸟/幽灵/机器人/龙/史莱姆/星星
- **配饰**：帽子/皇冠/眼镜/墨镜/蝴蝶结/围巾/耳机/花/星星/爱心

例：`戴皇冠的紫色小猫`、`彩虹史莱姆`、`戴眼镜的绿色青蛙`。所有生成结果都自动继承同一套动画骨架（眨眼 / 视线追踪 / 四种表情），生成的 SVG 会存到 `desktop-pet/skins/`。皮肤记忆在本地，重启后保留；点 ↺ 随时换回官方小 Claude。

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
