# 云墨美术馆 · Git 协作"照着抄"手册（Vue 工程版）

> 给全组 7 个人的操作手册。不用理解原理，按顺序敲命令即可。
> 配套：角色任务清单见 [组员上手指南.md](./组员上手指南.md)。

---

## 一、分支模型（一图看懂）

```
main          ← ★ 仓库默认分支 · 唯一主线 · 稳定版 / 答辩演示发布版
                 只接受 PR 合并；任何人禁止直接 push（本地 pre-push 钩子拦、GitHub 分支保护也拦）
  ├── feature/scene     （组员1）场景接缝（碰撞体/热点/展厅区域）
  ├── feature/player    （组员2）漫游与碰撞
  ├── feature/gesture   （组员3）手势识别
  ├── feature/exhibit   （组员4）展品与弹窗
  ├── feature/ui        （组员5）界面视觉
  ├── feature/assets    （组员6）素材
  ├── feature/main      （组长）整合 / 文档 / 部署
  └── feature/scene-look（组长）场景外观
```

**组长也走分支**：所有代码都经 `feature/* → PR → main`。区别只在于——组长的 review 是唯一能放行 PR 的（由 `CODEOWNERS` + 分支保护保证）。

**三个层次各管什么**

| 分支 | 干什么 | 谁往里写 |
|---|---|---|
| `main` | **唯一主线**：稳定版 / 答辩演示版，也是仓库默认分支 | 只能经 PR 合入，且必须组长批准（组长自己的改动也走分支，但可直接合并） |
| `feature/*` | 你自己的干活分支，随便提交，不影响别人 | 你自己 |

**发布靠 tag，不靠分支**：里程碑和答辩前由组长打标签冻结演示版，例如

```bash
git tag -a v1.0-demo -m "答辩演示版"
git push origin v1.0-demo
```

谁要拿那一版，`git switch --detach v1.0-demo` 即可。


**每人只在自己那条 feature 分支上改，只改自己负责的文件。**

> 唯一的例外是 `js/scene.js`：组长负责**外观**、组员1 负责**接缝**，两人共管。
> 动手前先群里说一声、错开时间改；该文件交叉 review；冲突由后动手的人解决。

---

## 二、第一次使用（每人只做一次）

**1. 装好 Git 并配置身份**

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

> 邮箱建议用 GitHub 的注册邮箱，否则仓库的贡献记录里看不到你。

**2. 安装 Node.js**

到 [nodejs.org](https://nodejs.org/) 下载 LTS 版，安装后检查：

```bash
node -v   # v20.x.x 或 v22.x.x
npm -v    # 10.x.x
```

**3. 克隆仓库**

```bash
git clone https://github.com/F416-Y/3d-gesture-museum.git

cd 3d-gesture-museum

# 克隆后你就在唯一的 main 上（不用切分支）；但别在 main 上直接写代码
# 日常开发请切到自己的 feature 分支，见下一节
```

**4. 安装依赖**

```bash
npm install
```

> 卡住就换国内镜像：`npm install --registry=https://registry.npmmirror.com`

**5. 启动项目**

```bash
npm run dev
```

打开终端显示的地址（如 `http://localhost:5173`）。

**6. 确认推送守卫生效**

```bash
git config core.hooksPath .githooks
```

> 装好后直接 `git push origin main` 会被拦下来，这是**故意设计的**。

**7. 切到自己的分支**

```bash
git switch feature/scene      # 换成你自己的分支
```

---

## 三、每日流程（最重要）

```bash
# ① 开工前：同步 main 最新代码（90% 的冲突都是因为漏了这一步）
git switch main
git pull origin main

# ② 把自己的分支接到最新 main 上
git switch feature/scene
git merge main

# ③ 写代码……（只改自己负责的文件；scene.js 是共管文件，动手前先群里说一声）

# ④ 提交
git add -A
git commit -m "feat(scene): 主楼增加匾额与挑檐细节"

# ⑤ 推到自己分支
git push origin feature/scene

# ⑥ 去网页提 Pull Request：feature/scene → main（base 默认就是 main），等组长 review 合并
```

---

## 四、提交信息规范

格式：`类型(模块): 一句话描述`

| 类型 | 用途 | 例子 |
|---|---|---|
| `feat` | 新功能 | `feat(gesture): 捏合手势增加边沿触发防连发` |
| `fix` | 修 bug | `fix(player): 撞墙后不再穿模` |
| `style` | 纯视觉/格式，不改逻辑 | `style(ui): 弹窗字号与行距调整` |
| `docs` | 文档 | `docs: 补充素材来源与版权说明` |
| `asset` | 素材替换 | `asset: 替换千里江山图高清贴图` |
| `chore` | 杂项与配置 | `chore: 更新 vite base 路径` |

模块名用文件名去后缀：`scene` / `player` / `gesture` / `exhibit` / `ui` / `assets` / `main`。

---

## 五、常见坑（都是真会踩的）

**1. 冲突了怎么办**

```bash
git merge main         # 提示 CONFLICT
# 打开冲突文件，找到 <<<<<<< ======= >>>>>>> 三处标记，
# 手动改成想要的样子并删掉这些标记
git add 冲突文件
git commit             # 完成合并
```

> 只要遵守"只改自己的文件"，冲突基本不会发生。唯一的共管文件是 `js/scene.js`（组长外观 / 组员1 接缝）：两人错开时间改，动手前先 `git pull --rebase origin main`。改不动就喊组长，**别硬删别人的代码**。

**2. 不小心在 main 上改了东西**

```bash
git switch -c feature/你的分支    # 把当前改动搬到新分支
# 回到 main 检查是否干净
```

**3. 推送被 pre-push 钩子拦了**

说明你正想直接推 main，**这是对的拦截**。走流程：在自己的 feature 分支上提交 → push 那条分支 → 提 PR 到 `main`。
只有首次建仓或正式发布时才用：

```bash
git push --no-verify origin main
```

**4. 换行符把整个文件标成改动**

仓库已有 `.gitattributes`（统一存 LF）。若仍出现：

```bash
git config core.autocrlf false
git rm --cached -r .
git reset --hard
```

**5. npm run dev 报错 / 页面空白**

```bash
# 先清缓存重装
rm -rf node_modules package-lock.json
npm install
npm run dev
```

Windows 用 PowerShell 时删目录：

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
npm run dev
```

**6. 素材大小约定（组员6 必看）**

- **单文件 < 5MB → 直接入库**：仓库已不再忽略 `assets/images`、`assets/models`。
- 单张贴图建议压到 **500KB 以内**（长边 2048px、JPG 质量 80 足够展厅使用）。
- 确实超过 5MB 的大模型才考虑 Git LFS，**且必须全组都装了 git-lfs 再启用**，
  否则别人拉下来只有指针文件，项目直接跑不起来。
- 每件素材都要记进 `docs/素材来源.md`（来源 + 授权），答辩一定会被问版权。

---

## 六、组长：建仓与首次发布

```bash
# ① 在 GitHub 新建空仓库（不要勾选 README），然后关联远程：
git remote add origin <仓库地址>

# ② 首次必须把 main 推上去（绕过本地守卫）
git push --no-verify -u origin main

# ③ 推全部 feature 分支（只有 main 一条主线，不再有 dev）
git push origin feature/scene feature/scene-look feature/main feature/player feature/gesture feature/exhibit feature/ui feature/assets

# ④ 组员 clone 后让他们执行 npm install
```

**部署 GitHub Pages**：

1. 仓库必须是**公开**的（免费 Pages 只支持公开仓库）。
2. 推荐用 GitHub Actions 自动构建 `dist/` 并发布到 `gh-pages` 分支。
3. 也可以手动：`npm run build` 后把 `dist/` 目录推到 `gh-pages` 分支。
4. Pages 链接形如：`https://<用户名>.github.io/3d-gesture-museum/#/`

> 本项目使用 Vite 构建，**不要**直接把 main 分支根目录设 Pages 源，否则 Vue 路由和资源路径会出问题。

**发布节奏**：PR 合入 `main` → 组长本地跑通验收 → 打 tag（如 `v1.0-demo`）→ 触发 Pages 构建 → 用 Pages 链接答辩。

**仓库设置建议（组长）**：Settings → Branches → 保护 `main`，勾选
「Require a pull request before merging」，把"禁止直接 push"从本地约定升级为服务端强制。
