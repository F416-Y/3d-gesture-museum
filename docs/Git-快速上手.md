# 云墨美术馆 · Git 协作"照着抄"手册

> 给全组 7 个人的操作手册。不用理解原理，按顺序敲命令即可。
> 配套：分支模型见 [7人分工文档.md](./7人分工文档.md) 第三节。

---

## 一、分支模型（一图看懂）

```
main          ← 稳定版 / 演示发布版；只接受来自 dev 的合并，禁止直接 push（本地钩子会拦）
  └── dev     ← 开发汇总线；所有功能最终合到这里，组长在这里验收
       ├── feature/scene     （组员1）场景与建筑
       ├── feature/player    （组员2）漫游与碰撞
       ├── feature/gesture   （组员3）手势识别
       ├── feature/exhibit   （组员4）展品与弹窗
       ├── feature/ui        （组员5）界面视觉
       └── feature/assets    （组员6）素材
```

**每人只在自己那条 feature 分支上改，只改自己负责的文件。**

---

## 二、第一次使用（每人只做一次）

**1. 装好 Git 并配置身份**

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

> 邮箱建议用 GitHub/Gitee 的注册邮箱，否则仓库的贡献记录里看不到你。

**2. 克隆仓库**

```bash
git clone <组长给你的仓库地址>
cd 3d-gesture-museum
```

**3. 确认推送守卫生效**

```bash
git config core.hooksPath .githooks
```

> 仓库里已经配好，克隆后确认一次。装好后直接 `git push origin main` 会被拦下来，这是**故意设计的**。

**4. 切到自己的分支**

```bash
git switch feature/scene      # 换成你自己那条，见上面分支表
```

---

## 三、每日流程（最重要）

```bash
# ① 开工前：同步 dev 最新代码（90% 的冲突都是因为漏了这一步）
git switch dev
git pull origin dev

# ② 把自己的分支接到最新 dev 上
git switch feature/scene
git merge dev

# ③ 写代码……（只改自己负责的文件）

# ④ 提交
git add -A
git commit -m "feat(scene): 主楼增加匾额与挑檐细节"

# ⑤ 推到自己分支
git push origin feature/scene

# ⑥ 去网页提 Pull Request：feature/scene → dev，等组长 review 合并
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
| `chore` | 杂项与配置 | `chore: 更新 .gitignore` |

模块名用文件名去后缀：`scene` / `player` / `gesture` / `exhibit` / `ui` / `assets` / `main`。

---

## 五、常见坑（都是真会踩的）

**1. 冲突了怎么办**

```bash
git merge dev          # 提示 CONFLICT
# 打开冲突文件，找到 <<<<<<< ======= >>>>>>> 三处标记，
# 手动改成想要的样子并删掉这些标记
git add 冲突文件
git commit             # 完成合并
```

> 只要遵守"只改自己的文件"，冲突基本不会发生。改不动就喊组长，**别硬删别人的代码**。

**2. 不小心在 main 上改了东西**

```bash
git switch -c feature/你的分支    # 把当前改动搬到新分支
# 回到 main 检查是否干净
```

**3. 推送被 pre-push 钩子拦了**

说明你正想直接推 main，**这是对的拦截**。走流程：先合到 `dev`，再由组长合入 `main`。
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

**5. 素材大小约定（组员6 必看）**

- **单文件 < 5MB → 直接入库**：仓库已不再忽略 `assets/images`、`assets/models`。
- 单张贴图建议压到 **500KB 以内**（长边 2048px、JPG 质量 80 足够展厅使用）。
- 确实超过 5MB 的大模型才考虑 Git LFS，**且必须全组都装了 git-lfs 再启用**，
  否则别人拉下来只有指针文件，项目直接跑不起来。
- 每件素材都要记进 `docs/素材来源.md`（来源 + 授权），答辩一定会被问版权。

---

## 六、组长：建仓与首次发布

```bash
# ① 在 GitHub / Gitee 新建空仓库（不要勾选 README），然后关联远程：
git remote add origin <仓库地址>
git push --no-verify -u origin main     # 首次建仓必须绕过守卫，否则会被 pre-push 拦下
git push -u origin dev

# ② 一次性把 feature 分支推上去，组员就能直接 switch
git push origin feature/scene feature/player feature/gesture feature/exhibit feature/ui feature/assets

# ③ 开启 Pages：Settings → Pages → Source 选分支 main / 根目录
#    发布地址形如 https://<用户名>.github.io/3d-gesture-museum/
```

> 本项目是原生 HTML/CSS/JS，**没有任何构建步骤**，Pages 选 main 分支根目录即可。

**发布节奏**：`dev` 上全组验收通过 → PR 合入 `main` → Pages 自动更新 → 答辩用这条链接。

**仓库设置建议（组长）**：Settings → Branches → 保护 `main`，勾选
「Require a pull request before merging」，把"禁止直接 push"从本地约定升级为服务端强制。
