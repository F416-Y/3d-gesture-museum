# 云墨美术馆 CloudInk Art Museum

> 美术鉴赏 × 软件工程 跨专业课程设计 —— 前端 3D 手势交互数字博物馆
> 版本：2026-10-09（原型驱动的江南文人园林布局 · 23 件展品 · 昼夜氛围 · 手势离线可用）

坐在屏幕前，张开手掌前进、食指左右指点转向、拇指食指捏合查看展品——**无需键鼠**，用摄像头捕捉手势，隔空逛一座江南文人国画博物馆。

- 3D 渲染：[Three.js](https://threejs.org/) r147（**已本地化**，`js/vendor/`，运行时零 CDN 依赖）
- 手势识别：[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) HandLandmarker（**WASM 与手部模型已随仓库离线分发**，断网可用）
- 前端壳：[Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + [Vue Router](https://router.vuejs.org/) + [Pinia](https://pinia.vuejs.org/)
- 后端数据：[Supabase](https://supabase.com/) BaaS（登录 / 收藏 / 评论）
- 外观来源：外协 **Kimi** 的《江南文人国画博物馆 · 建筑外观布局原型》，由 `scripts/vendor-prototype.mjs` 自动同步进本项目

---

## 一、功能一览（当前版本）

| 区域 | 内容 |
|---|---|
| 园区布局 | 原型驱动的江南园林：**序厅高台**（青铜方鼎 + 中央大踏跺 + 寻杖栏杆）→ **中轴南院影壁** → **中轴双廊画廊** → **抄手游廊闭环**（内 / 外转角亭各一对）→ **月洞门** → **筒车水院** → 六座展厅院落 + 中西对话院 |
| 中国画展区 | 山水（hall1）/ 花鸟（hall2）/ 人物（hall3）三厅 + 序厅（hall0）+ 书斋·茶室（hall4）+ 文创·临摹（hall5） |
| 展品（23 件） | 中轴双廊画廊墙 **8 幅真画**（千里江山图 / 富春山居图 / 溪山行旅图 / 韩熙载夜宴图 / 步辇图 / 写生珍禽图 / 五牛图 / 墨兰图）+ 东长廊首间 **洛神赋图** + 序厅 **后母戊鼎** + 人物厅 **将军俑** + 中心庭 **马踏飞燕** + 书斋/茶室/文创/临摹背墙 **8 幅立轴** + 对话院 3 件 |
| **中西对话院** | 景观庭院（x 11.5~18 / z −15~−7）：**米洛的维纳斯 + 蒙娜丽莎 + 星月夜**，按"人像 / 风景 / 形体"三组与本馆中国画对照（见 [展陈故事线 · 中西对话](./docs/current/展陈故事线-中西对话.md)） |
| 交互 | 手势漫游 / 键鼠漫游 / 鼠标点击锁定视角 · 展品鉴赏弹窗（作者·年代·形制·馆藏·赏析）· 收藏与评论 · 展厅导航栏 · 重置视角 · 全景模式 |
| 氛围 | **昼夜切换**（入夜灯火：全园灯笼 / 石灯 / 宫灯点亮，水面暖色倒影）· **开场粒子序章**（宣纸墨点 + 5 个预设自动巡展，全园沙盘压轴） |
| 地图页 | `/#/map`：用**场景真实俯视渲染图**作底图（1m = 8.4px 世界坐标对齐），红点是当前位置，标注八个展厅与中西对话院 |
| 用户与社交 | 登录 / 注册（Supabase）· 展品收藏 · 展品评论 |
| 路由 | `/#/`（博物馆）· `/#/hall/:hallId`（展厅直达）· `/#/login` · `/#/favorites` · `/#/map` |

### 手势与键盘操作

| 手势 | 效果 | 键盘备选 |
|---|---|---|
| 张开手掌 | 向前漫游 | `W` / `↑` |
| 握拳 | 向后退 | `S` / `↓` |
| 食指指向左 / 右 | 左右转向 | `A` `D` / `←` `→` |
| 捏合拇指 + 食指 | 查看展品（等价按 E） | `E` |
| —— | 重置视角 | `R` |
| —— | 全景模式（俯瞰自转） | `V` |
| —— | 昼夜切换（入夜 · 灯火） | `N`（或点 HUD 按钮） |
| —— | 加速移动 | `Shift` |
| 鼠标 | 点击画面锁定指针 → 移动鼠标转视角；准星对着展品时点击即查看 | —— |

## 二、快速开始

```bash
# 1. 安装依赖
npm install

# 2.（可选）配置 Supabase 凭证：复制 .env.example 为 .env.local 并填写
#    不填也能跑，只是登录 / 收藏 / 评论不可用

# 3. 本地开发
npm run dev          # 打开 http://localhost:5173

# 4. 生产构建（产物在 dist/，静态文件，含 js/ css/ assets/）
npm run build
```

> **完全离线可用**：Three.js、MediaPipe（wasm + 手部模型）都已随仓库分发，运行时**不访问任何 CDN**，断网也能启动手势识别与全部场景。

**部署（GitHub Pages）**：把 `dist/` 推到 `gh-pages` 分支（或用 Actions 自动构建）→ 访问 `https://<用户名>.github.io/3d-gesture-museum/#/`。注意免费版 Pages 只支持**公开仓库**。

## 三、质量门禁与验收

| 命令 / 检查 | 作用 |
|---|---|
| `node scripts/smoke-scene.mjs` | 引擎冒烟：真实加载外观模块、检查碰撞体/热点/展厅区域自洽（**热点为 0 即失败**） |
| `node scripts/verify-exhibits.mjs` | 展品全量验收：config ↔ 权威落位一一对应、热点坐标一致、每件可接近、捏合/E 路由正确 |
| `npm run build` | 生产构建 |
| `node scripts/visual-check.mjs [输出目录] [机位名]` | 无头渲染出图 + 像素自检（可加 `night: true` 机位出夜景） |
| `node scripts/vendor-prototype.mjs` | **原型 → 生成物同步**（改原型后必须跑，见下） |
| CI（`.github/workflows/ci.yml`） | 三个 job：引擎冒烟测试 + 语法检查 / 生产构建 / 安全与体积守卫 |

> ⚠️ **不要手改生成物**：`js/exterior-layout.js`、`js/slots.js` 由 `tools/exterior-prototype.html`（外观原型）经
> `node scripts/vendor-prototype.mjs` 自动生成。要改外观请改原型，然后重跑同步脚本。
> 大文件守卫对 MediaPipe 的 wasm 与手部模型有白名单（离线推理需要，Apache-2.0）。

## 四、目录结构

```text
3d-gesture-museum/
├── index.html                # 入口：加载 3D 引擎脚本 + 序章覆盖层 + Vue 入口
├── css/
│   ├── style.css             # 3D 场景内 UI 视觉
│   └── intro.css             # 开场粒子序章样式
├── js/
│   ├── config.js             # 展品数据 + 鉴赏文案 + 全局参数
│   ├── scene.js              # 园区/建筑/展厅/灯光 + 碰撞体·热点·展厅区域（接缝）
│   ├── exterior-layout.js    # ⚙ 生成物：原型布局（勿手改）
│   ├── slots.js              # ⚙ 生成物：真模型替换 + 室内布展（勿手改）
│   ├── gallery.js            # 画廊墙真画（seed → 画作 id）
│   ├── windows.js            # 格扇窗立面清单
│   ├── lighting.js           # 昼夜氛围（白昼 ⇄ 入夜灯火）
│   ├── intro.js              # 开场粒子序章（宣纸墨点 + 预设巡展）
│   ├── player.js             # 漫游·碰撞·高度跟随·视角
│   ├── gesture.js            # 手势识别与映射（离线 MediaPipe）
│   ├── exhibit.js            # 展品热点·拾取·弹窗联动
│   ├── ui.js                 # 场景内界面面板·弹窗·提示
│   ├── models.js / foliage.js / exterior.js
│   ├── main.js               # 引擎启动·主循环·输入合成
│   └── vendor/               # three.js / GLTFLoader / MediaPipe（本地化，离线可用）
├── src/                      # Vue 3 壳
│   ├── App.vue / main.js / router/ / stores/ / services/ / styles/ / views/
│   └── views/                # 博物馆视图·登录·收藏夹·地图页
├── assets/
│   ├── images/               # 名画贴图（同名 <展品id>.jpg 自动上墙）
│   └── models/               # glb 模型（opt/ 为压缩件；hand_landmarker.task 为手势模型）
├── tools/
│   └── exterior-prototype.html   # ★ 外观原型（唯一源头，Kimi 原作）
├── scripts/                  # 同步 / 出图 / 冒烟 / 展品验收 / 模型压缩等脚本
├── docs/
│   ├── current/              # 现行文档（流程速查卡 / 上手指南 / 素材来源 / 落位表 / 故事线 …）
│   └── archive/              # 历史文档（旧方案与已完成的旧任务卡）
└── README.md
```

## 五、团队与协作

| 成员 | 角色 | 负责文件 |
|---|---|---|
| 1 | 3D 场景逻辑与接缝 | `js/scene.js`（碰撞体 / 热点 / 展厅区域）、连廊可达性、性能 |
| 2 | 漫游交互工程师 | `js/player.js`（移动·碰撞·高度跟随·视角） |
| 3 | 手势 AI 工程师 | `js/gesture.js`（识别·映射·离线化） |
| 4 | 展品系统工程师 | `js/config.js`、`js/exhibit.js`、`tools/exhibit-anchors.json`、展品验收脚本 |
| 5 | UI 视觉设计师 | `css/style.css`、`js/ui.js`、`src/views/*.vue`、`src/styles/` |
| 6 | 素材美工 | `assets/`（名画贴图、glb 模型、素材授权清单） |
| 7 | 组长 · 整合与外观 | `js/main.js`、`js/scene.js`（外观）、`js/lighting.js`、`js/intro.js`、`src/`、README、部署 |
| 外协 | 外观原型（Kimi） | `tools/exterior-prototype.html`（原型定稿与日景/夜景对照图） |

**协作规则**：`main` 是唯一主线，**只能走 PR 合并**；每个子任务从最新 `main` 开 `feature/<模块>-<子任务>-<序号>`；
`pre-commit` 拦"在 main 上直接改代码"、`pre-push` 拦"直接 push main"；提交信息格式 `类型(模块): 一句话`。
详见 [流程速查卡](./docs/current/流程速查卡.md)（开工前只看这一页）与 [Git 快速上手](./docs/current/Git-快速上手.md)。

## 六、素材与授权

全部素材逐条登记在 [素材来源与授权清单](./docs/current/素材来源.md)：

- 名画：故宫名画记公开影像，原作均为 **公共领域（PD-old）**；本仓库使用等比缩放后的版本，仅用于课程教学演示
- 西画：维基共享资源，**PD-old**（蒙娜丽莎 / 星月夜原作为公共领域）
- 三维模型：`venus.glb` **CC0**（SMK 开放扫描）；`horse-statue / statue-*` 为 Poly Pizza 的 **CC0 / CC BY** 素材
- ⚠️ **CC BY 素材必须署名**（如用到 `Statue by Zsky (CC BY)`），否则请换 CC0 版本

## 七、已知限制与待办

1. **正门那条竖缝**：三个方案待定（门扇贴墙折平 / 挪开抱厦柱子 / 保持现状），标注图见 本地出图工具生成的标注图（`node scripts/visual-check.mjs`）
2. **6 个空画位**（东长廊 5 间 + 临水半亭 1 个）：等素材补齐（任务卡：[组员6任务-补画与授权](./docs/current/组员6任务-补画与授权.md)，只收 CC0 / PD / CC BY）
3. **书斋·茶室·文创·临摹背墙 8 幅立轴**：现为题名占位卷轴，放同名 `<id>.jpg` 到 `assets/images/` 即自动换真图
4. **性能**：真机目标 ≥40fps（树 / 竹可做实例化）
5. **第三人称"蛋小人"**：方案已给（`js/avatar.js` + 相机防穿墙 + `C` 键切换），未实现
6. **部署**：目前只有 CI，尚未接 GitHub Pages
7. **演示视频**：分镜与解说词已写好（[演示视频分镜与解说词](./docs/current/演示视频-分镜与解说词.md)），待外观收尾后开拍

## 八、Supabase（登录 / 收藏 / 评论）

建表与 RLS 的完整步骤见 [Supabase 配置与建表](./docs/current/Supabase-配置与建表.md)，简述：

1. Supabase 新建项目 → Auth → Email 关闭 **Confirm email**（演示无需邮件验证）
2. 复制 `.env.example` 为 `.env.local`，填 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`
3. 建两张表（启用 RLS）：`favorites`（user_id / exhibit_id / created_at）、`comments`（user_id / exhibit_id / content / created_at）
4. 不配凭证也能跑：弹窗里的收藏 / 评论区会降级为"登录后留言"提示

---

> 本项目为课程作业，素材均取自公共领域 / CC0 / CC BY 来源并逐条登记；如有疏漏请提 Issue。