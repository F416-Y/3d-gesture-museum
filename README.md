# 云墨美术馆 CloudInk Art Museum

> 美术鉴赏 × 软件工程 跨专业课程设计 —— 前端 3D 手势交互数字博物馆

坐在屏幕前，张开手掌向前漫游，握拳停止，食指指向转向，捏合两指查看展品——**无需键鼠**，用摄像头捕捉手势，隔空逛一座新中式数字美术馆。

- 3D 渲染：[Three.js](https://threejs.org/) r147（WebGL，浏览器直接运行）
- 手势识别：[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) Hands（纯前端，调用电脑摄像头）
- 前端壳：[Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + [Vue Router](https://router.vuejs.org/) + [Pinia](https://pinia.vuejs.org/)
- 后端数据：[Supabase](https://www.Supabase.cn/) BaaS（用户系统 / 评论 / 收藏， generous 免费额度）
- 工程形态：Vite 构建，开发期 `npm run dev`，生产构建产物为纯静态文件，可部署到 GitHub Pages

---

## 功能一览

| 区域 | 内容 |
|---|---|
| 园区外景 | 新中式博物馆主楼（基座 · 一层大厅 · 二层外观 · 四坡屋顶 · 匾额）、前庭广场、围墙、门柱、行道树、石狮 |
| 一楼 · 中国绘画厅 | 千里江山图、清明上河图、富春山居图、韩熙载夜宴图、洛神赋图；后母戊鼎、将军俑 |
| 二楼 · 文明对话厅 | 西侧连廊：蒙娜丽莎、星月夜（中西对话） |
| 前庭 | 马踏飞燕（铜奔马） |
| 交互 | 手势漫游 / 键盘备选 / 点击查看 · 展品鉴赏弹窗（作者·年代·形制·馆藏·赏析）· 展厅切换提示 · 重置视角 |
| 用户系统 | 登录 / 注册（Supabase `_User`） |
| 社交 | 展品收藏 · 展品评论 |
| 路由 | 多展馆直达 `/#/hall/plaza` `/#/hall/hall1` `/#/hall/hall2` |

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

## 上手必读（给组员）

| 文档 | 什么时候看 | 内容 |
|---|---|---|
| [流程速查卡.md](./docs/流程速查卡.md) | **开工前只看这一页就够了** | 三条铁律、三行命令、提 PR 五步、出错对照表 |
| [组员上手指南.md](./docs/组员上手指南.md) | **第一次进项目必读** | 环境安装、认领角色、按周任务清单、验收标准 |
| [Git-快速上手.md](./docs/Git-快速上手.md) | 每天开工前照着做 | 克隆、npm install、Git 分支流程、提交规范、常见问题 |

---
## 快速开始

```bash
# 1. 克隆后安装依赖
npm install

# 2.（可选）配置 Supabase 凭证
# 复制 .env.example 为 .env.local，填入 Project URL / Anon Key
# 不填也能跑，只是登录/收藏/评论功能不可用

# 3. 本地开发
npm run dev
# 打开 http://localhost:5173

# 4. 生产构建（产物在 dist/，含 js/ css/ assets/ 静态资源）
npm run build
```

**在线部署（GitHub Pages）**：
1. 仓库必须设为**公开**（GitHub Pages 免费版只支持公开仓库）。
2. 将 `dist/` 目录推送到 `gh-pages` 分支，或使用 GitHub Actions 自动构建 Pages。
3. 打开 Pages 链接：`https://<你的用户名>.github.io/3d-gesture-museum/#/`

> 说明：本工程需要联网加载 Three.js 与 MediaPipe 的 CDN 资源（含 WASM 与手部模型）。

## 目录结构（与 7 人分工一一对应）

```
3d-gesture-museum/
├── index.html            # 唯一入口：加载 3D 引擎脚本 + Vue 入口
├── css/style.css         # 3D 场景内 UI 视觉（组员5）
├── js/
│   ├── config.js         # 展品数据 + 鉴赏文案 + 全局参数（组员4 / 全体共用）
│   ├── scene.js          # 园区·建筑·展厅·灯光（组长·外观）＋ 碰撞体/热点/展厅区域（组员1·接缝）
│   ├── player.js         # 漫游·碰撞·展厅判定（组员2）
│   ├── gesture.js        # MediaPipe 手势识别与映射（组员3）
│   ├── exhibit.js        # 展品热点·拾取·弹窗联动（组员4）
│   ├── ui.js             # 3D 场景内界面面板·弹窗·提示（组员5）
│   └── main.js           # 3D 引擎启动·主循环·输入合成（组长）
├── src/                  # Vue 壳（组长搭建，组员4/5 扩展）
│   ├── App.vue           # 顶部导航：展厅直达 + 登录/收藏入口
│   ├── main.js           # Vue 入口
│   ├── router/           # 多展馆路由
│   ├── stores/user.js    # 当前登录用户（Pinia）
│   ├── services/         # Supabase 初始化 + 收藏/评论数据层
│   ├── views/            # 登录页、收藏夹页、博物馆视图
│   └── styles/           # Vue 壳样式
├── assets/
│   ├── images/           # 名画贴图（组员6 替换程序化示意贴图）
│   └── models/           # glb 雕塑模型（组员6）
├── package.json          # 依赖与脚本
├── vite.config.js        # Vite 配置（base 相对路径，适配 Pages 子目录）
├── scripts/postbuild.mjs # 构建后复制 js/css/assets 到 dist/
├── .env.example          # Supabase 凭证模板
├── .gitattributes
├── .githooks/pre-push    # 推送守卫：禁止直接 push main
├── .github/
├── docs/
│   ├── 7人分工文档.md     # 详细分工与里程碑
│   └── Git-快速上手.md    # 组员日常 Git 命令手册
└── README.md
```

## 7 人分工速览（详见 docs/7人分工文档.md）

| 成员 | 角色 | 负责文件 | 核心职责 |
|---|---|---|---|
| 1 | 3D 场景逻辑与接缝 | `js/scene.js`（接缝部分） | 碰撞体登记、展品热点坐标、展厅区域判定、连廊可达性、性能、素材适配 |
| 2 | 漫游交互工程师 | `js/player.js` | 第一人称移动、碰撞检测、展厅判定、路由传送点配合 |
| 3 | 手势 AI 工程师 | `js/gesture.js` | 摄像头手势识别与手势映射（项目亮点） |
| 4 | 展品系统工程师 | `js/config.js` + `js/exhibit.js` + `src/services/social.js` | 展品数据、鉴赏文案、热点拾取、弹窗、收藏/评论接入 |
| 5 | UI 视觉设计师 | `css/style.css` + `js/ui.js` + `src/views/*.vue` + `src/styles/vue-shell.css` | 3D 场景内界面 + Vue 登录/收藏页视觉 |
| 6 | 素材美工 | `assets/` | 真实名画贴图、glb 模型、资源轻量化 |
| 7 | 整合 · 场景外观（组长） | `js/main.js` + `js/scene.js`（外观）+ `src/` + README | 园区与主楼外观、连廊观感、灯光雾效、Vue 工程搭建、路由、Supabase 接入、部署、分工报告 |

## 模块间依赖

3D 引擎核心仍按原设计通过 `window.MuseumXxx` 全局命名空间解耦：

```
js/config.js ──→ js/scene.js ──→ js/player.js ──→ js/main.js
       └──────→ js/exhibit.js ─┘          ↑
                                js/gesture.js
js/ui.js ←── js/exhibit.js / js/main.js
```

Vue 壳（`src/`）只读取引擎暴露的 API，**不反向写入引擎状态**：

- `src/router` → `window.MuseumPlayer.teleport()`
- `src/services/social.js` 读取 `window.MuseumConfig.exhibits` 做收藏映射
- `src/views/MuseumView.vue` 监听路由参数变化，触发展厅传送

## 用户系统、评论与收藏（Supabase）

### 1. 组长创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) → 用 GitHub 账号登录 → New project
2. 记下 **Project URL** 和 **anon public** API Key
3. Auth → Providers → Email：关闭 **Confirm email**（课程演示不需要邮件验证）
4. 把凭证填入 `.env.local`：

```bash
cp .env.example .env.local
# 编辑 .env.local
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 2. 创建数据表

在 Supabase Table Editor 里创建两张表（启用 RLS）：

**favorites**
| 列名 | 类型 | 说明 |
|---|---|---|
| `id` | uuid / default gen_random_uuid() | 主键 |
| `user_id` | uuid | 关联 auth.users |
| `exhibit_id` | text | 展品 id（对应 js/config.js 里的 id） |
| `created_at` | timestamp / default now() | — |

**comments**
| 列名 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `user_id` | uuid | 关联 auth.users |
| `exhibit_id` | text | 展品 id |
| `content` | text | 评论内容 |
| `created_at` | timestamp / default now() | — |

### 3. 行级安全策略（RLS）

两张表都添加：

- `Enable read access for all users`：SELECT 对 `true` 放行（所有人可读评论/收藏数）
- `Enable insert for authenticated users only`：INSERT 要求 `auth.role() = 'authenticated'`
- `Enable delete for own rows only`：DELETE 要求 `auth.uid() = user_id`

> 本项目用「用户名」登录，内部会转换成 `用户名@cloudink.local` 的邮箱注册 Supabase Auth。用户名仅用于展示，不发送真实邮件。

未配置 Supabase 时，相关功能自动降级，博物馆仍可正常浏览。

## 多展馆路由

右上角导航可直达展厅，URL 会同步变化：

| URL | 展厅 |
|---|---|
| `/#/hall/plaza` | 前庭 · 园区 |
| `/#/hall/hall1` | 一楼 · 中国绘画厅 |
| `/#/hall/hall2` | 二楼 · 文明对话厅 |

新增展厅时：
1. 在 `js/config.js` 的 `halls` 数组里增加 `id` 与 `name`
2. 在 `src/views/MuseumView.vue` 的 `HALL_SPAWNS` 里增加入口坐标
3. 在 `src/App.vue` 的导航里加一个 `RouterLink`

## 素材替换指南（组员6）

- **名画贴图**：将高清图放入 `assets/images/`，在 `js/scene.js` 的 `drawPainting` 处改用 `THREE.TextureLoader` 加载（代码内已留注释锚点）。
- **雕塑模型**：将 `glb` 放入 `assets/models/`，可引入 GLTFLoader 替换 `buildDing` / `buildWarrior` / 铜奔马等几何示意模型（`index.html` 中已预留 addon 引入位置）。
- 大体积素材请启用 Git LFS 管理（见 `.gitignore` 注释）。
- `vite build` 后的 `scripts/postbuild.mjs` 会自动把 `js/` `css/` `assets/` 复制到 `dist/`，保证部署产物完整。

## 已知限制（答辩可主动说明）

1. 名画与雕塑为**程序化示意贴图 / 简化几何体**，非真实原作素材，替换方式见上。
2. 手势识别依赖光照条件与摄像头画质，光照不足时建议开灯并保持手部在取景框内。
3. 主楼二层为纯外观，不可进入（参观动线为：前庭 → 一楼大厅 → 西侧连廊）。
4. MediaPipe 模型首次加载需联网，约数秒。
5. 评论/收藏依赖 Supabase 云端服务，离线或凭证未配置时不可用。

## 技术栈版本

- Vue `^3.5.13`
- Vue Router `^4.4.5`
- Pinia `^2.2.6`
- Vite `^6.0.3`
- Supabase Storage `^4.15.1`
- Three.js `0.147.0`（UMD，SRI 锁定）
- @mediapipe/tasks-vision `0.10.0`（UMD；WASM 与 hand_landmarker.task 由运行时从官方 CDN 加载）
