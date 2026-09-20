# 云墨美术馆 CloudInk Art Museum

> 美术鉴赏 × 软件工程 跨专业课程设计 —— 前端 3D 手势交互数字博物馆

坐在屏幕前，张开手掌向前漫游，握拳停止，食指指向转向，捏合两指查看展品——**无需键鼠**，用摄像头捕捉手势，隔空逛一座新中式数字美术馆。

- 3D 渲染：[Three.js](https://threejs.org/) r147（WebGL，浏览器直接运行）
- 手势识别：[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) Hands（纯前端，调用电脑摄像头）
- 工程形态：原生 HTML/CSS/JS，无构建，`index.html` 唯一入口，静态部署

---

## 功能一览

| 区域 | 内容 |
|---|---|
| 园区外景 | 新中式博物馆主楼（基座 · 一层大厅 · 二层外观 · 四坡屋顶 · 匾额）、前庭广场、围墙、门柱、行道树、石狮 |
| 一楼 · 中国绘画厅 | 千里江山图、清明上河图、富春山居图、韩熙载夜宴图、洛神赋图；后母戊鼎、将军俑 |
| 二楼 · 文明对话厅 | 西侧连廊：蒙娜丽莎、星月夜（中西对话） |
| 前庭 | 马踏飞燕（铜奔马） |
| 交互 | 手势漫游 / 键盘备选 / 点击查看 · 展品鉴赏弹窗（作者·年代·形制·馆藏·赏析）· 展厅切换提示 · 重置视角 |

## 手势与键盘操作

| 手势 | 效果 | 键盘备选 |
|---|---|---|
| 张开手掌 | 向前漫游 | W / ↑ |
| 握拳 | 停止 | —— |
| —— | 后退 | S / ↓ |
| 食指指向左/右 | 左右转向 | A / D / ← / → |
| 捏合拇指+食指 | 查看当前展品 | E |
| —— | 重置视角 | R |
| —— | 加速 | Shift |

## 快速开始

1. **本地运行**：直接双击 `index.html`，或本地起静态服务（推荐，保证摄像头权限正常）：
   ```bash
   python -m http.server 8080
   # 打开 http://localhost:8080
   ```
2. **在线部署（GitHub Pages）**：将本仓库推送到 GitHub → Settings → Pages → 选择分支发布，即可获得在线演示链接。

> 说明：本工程需要联网加载 Three.js 与 MediaPipe 的 CDN 资源（含 WASM 与手部模型）。

## 目录结构（与 7 人分工一一对应）

```
3d-gesture-museum/
├── index.html            # 唯一入口（引入全部模块）
├── css/style.css         # 界面视觉（组员5）
├── js/
│   ├── config.js         # 展品数据 + 鉴赏文案 + 全局参数（组员4 / 全体共用）
│   ├── scene.js          # 园区·建筑·展厅·灯光（组员1）
│   ├── player.js         # 漫游·碰撞·展厅判定（组员2）
│   ├── gesture.js        # MediaPipe 手势识别与映射（组员3）
│   ├── exhibit.js        # 展品热点·拾取·弹窗联动（组员4）
│   ├── ui.js             # 界面面板·弹窗·提示（组员5）
│   └── main.js           # 启动·主循环·输入合成（组员7）
├── assets/
│   ├── images/           # 名画贴图（组员6 替换程序化示意贴图）
│   └── models/           # glb 雕塑模型（组员6）
├── .gitattributes        # 统一 LF 换行 + 二进制素材声明
├── .githooks/pre-push    # 推送守卫：禁止直接 push main
├── .github/              # PR 模板
├── docs/
│   ├── 7人分工文档.md     # 详细分工与里程碑
│   └── Git-快速上手.md    # 组员日常 Git 命令手册（照着抄）
└── README.md
```

## 7 人分工速览（详见 docs/7人分工文档.md）

| 成员 | 角色 | 负责文件 | 核心职责 |
|---|---|---|---|
| 1 | 3D 场景主程 | `scene.js` | 园区建筑外观、室内展厅、灯光氛围 |
| 2 | 漫游交互工程师 | `player.js` | 第一人称移动、碰撞检测、展厅判定 |
| 3 | 手势 AI 工程师 | `gesture.js` | 摄像头手势识别与手势映射（项目亮点） |
| 4 | 展品系统工程师 | `config.js` + `exhibit.js` | 展品数据、鉴赏文案、热点拾取、弹窗 |
| 5 | UI 视觉设计师 | `style.css` + `ui.js` | 页面视觉、弹窗排版、整体美术风格 |
| 6 | 素材美工 | `assets/` | 真实名画贴图、glb 模型、资源轻量化 |
| 7 | 整合与文档（组长） | `main.js` + README | 模块整合、部署、分工报告 |

## 模块间依赖（不交叉）

```
config.js ──→ scene.js ──→ player.js ──→ main.js
     └──────→ exhibit.js ─┘      ↑
                         gesture.js
ui.js ←—— exhibit.js / main.js
```

每个模块通过 `window.MuseumXxx` 全局命名空间暴露，**只读他人的导出、不改他人的文件**，Git 冲突面极小。

## 素材替换指南（组员6）

- **名画贴图**：将高清图放入 `assets/images/`，在 `scene.js` 的 `drawPainting` 处改用 `THREE.TextureLoader` 加载（代码内已留注释锚点）。
- **雕塑模型**：将 `glb` 放入 `assets/models/`，可引入 GLTFLoader 替换 `buildDing` / `buildWarrior` / 铜奔马等几何示意模型（`index.html` 中已预留 addon 引入位置）。
- 大体积素材请启用 Git LFS 管理（见 `.gitignore` 注释）。

## 已知限制（答辩可主动说明）

1. 名画与雕塑为**程序化示意贴图 / 简化几何体**，非真实原作素材，替换方式见上。
2. 手势识别依赖光照条件与摄像头画质，光照不足时建议开灯并保持手部在取景框内。
3. 主楼二层为纯外观，不可进入（参观动线为：前庭 → 一楼大厅 → 西侧连廊）。
4. MediaPipe 模型首次加载需联网，约数秒。

## 技术栈版本

- Three.js `0.147.0`（UMD，SRI 锁定）
- @mediapipe/tasks-vision `0.10.0`（UMD，SRI 锁定；WASM 与 hand_landmarker.task 由运行时从官方 CDN 加载）
