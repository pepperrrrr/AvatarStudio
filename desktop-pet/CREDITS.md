# 致谢 / Credits

本桌宠的默认形象 **Clawd** 是 Claude Code 的官方吉祥物。Anthropic 未公开发布可复用的
Clawd 素材或 API，本项目的像素几何（身体/手臂/眼睛/腿的矩形坐标与配色 `#C27C5C` /
`#8B5A42`）**移植并改编自以下 MIT 许可的社区实现**：

- **stevysmith/clawd-react** — https://github.com/stevysmith/clawd-react （MIT License）
  Clawd 作为可复用 React 组件的精确 `<rect>` 几何与配色常量来源。

在其基础上，本项目自行新增了：可眨眼/视线追踪骨架、四种表情、以及自主行为系统
（走动 / 踢足球物理 / 打盹）。

其它调研参考（未直接取用代码）：
- TeXmeijin/claude-code-mascot-statusline （16×16 像素网格 pack 格式）— MIT
- Codrops《Reverse-Engineering Claude AI's Mascot Animations》— 动画逆向文章

Clawd 名称与形象版权归 Anthropic。本项目为个人学习/自用性质的粉丝还原。
