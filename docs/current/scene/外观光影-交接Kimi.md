# 外观光影 · 交接 Kimi（2026-09-24）

> 结论先说：主项目的光影**不是审美问题，是管线问题**。今天已修一处会让画面发平发暗的抓取 bug。
> 光影设计整体交给 Kimi 做，但请**只改原型**，不要改生成物。

## 一、主项目光影现在是怎么来的（事实）

1. 光照不是手写的，是**从原型自动抓的**：
   - 源：`tools/exterior-prototype.html` 里 `var sun = new THREE.DirectionalLight...` 到 `scene.add(hemi);` 这一段
   - 抓取：`scripts/vendor-prototype.mjs`（第 3 步「抓光照」）
   - 产物：`js/exterior-layout.js` 末尾的 `window.MuseumExteriorLayout.addLights(scene)`
2. 现在的实际参数（=Kimi 原型里的值）：
   - 日光 `DirectionalLight(0xfff2e0, 1.45)`，位置 (-48, 66, 62)，castShadow，mapSize 2048，阴影范围 ±75，near 10 / far 280，bias -0.0005 / normalBias 0.03
   - 半球光 `HemisphereLight(0xe4eef6, 0x8a9578, 0.85)`
3. 今天修的 bug：Kimi 把原型里 `scene.add(new THREE.HemisphereLight(...))` 改成 `var hemi = ...; scene.add(hemi);`，旧锚点匹配不到 → 抓取落空、**太阳光整个丢失**（画面只剩半球光，所以发平发暗）。现在结束锚点两种写法都认，日志会打印「抓到（含太阳光 N 行）」或「⚠ 没抓到太阳光」。**以后原型改光照结构，先看这行日志。**

## 二、主项目还没有、需要 Kimi 补的（原型里已有或要做）

| 项 | 原型里 | 主项目 | 说明 |
|---|---|---|---|
| 背景色 | `scene.background = 0xdfe9ec`（sRGB→linear） | ✗ 没抓 | 抓进 addLights 即可 |
| 雾 | `scene.fog = Fog(0xdfe9ec, 85, 280)` | ✗ 没抓（主项目只在旧布局分支有一处雾） | 抓进来，远景层次会好很多 |
| 曝光 | `renderer.toneMappingExposure = 1.3` | main.js 写死 1.12（原型布局） | 需要 main.js 或 addLights 侧统一 |
| 昼夜系统 | `applyNight(k)` + `nightGoal/nightCur` 插值 + 灯笼点光群 + 水面暖色倒影 | ✗ 完全没接 | 主项目要的是「一个开关切昼夜」 |
| 馆内暖光 | slots.js 里每厅一盏 `PointLight(0xffe9cf, 1.1)` | ✓ 有 | 夜间应随 k 加强 |
| 立轴灯带 | lampGlow `emissiveIntensity 1.15` | ✓ 有 | 夜间应随 k 抬高 |

## 三、Kimi 要交付什么

1. **只改** `tools/exterior-prototype.html`；改完我跑 `node scripts/vendor-prototype.mjs` 同步（或你告诉我需要补抓哪几块，我扩 vendor 规则）。
2. 主项目要能用一个开关切昼夜，接口先定为：
   - `window.MuseumLighting.setNight(k)`，k 0=白昼 1=入夜，内部做平滑插值（不要瞬变）
   - UI 按钮归组员5，先把接口留出来即可
3. 验收证据：3 个机位 × 昼/夜 = 6 张图
   - `node scripts/visual-check.mjs tools/visual-check plan`（正上方俯视）
   - `node scripts/visual-check.mjs tools/visual-check gate`（南门）
   - `node scripts/visual-check.mjs tools/visual-check aerial`
4. 三条门禁必须过：`node --check js/scene.js`、`node scripts/smoke-scene.mjs`、`npm run build`
5. 分支：`feature/scene-lighting-<序号>`，**不要动 main**（main 只由组长合并）

## 四、坑（踩过的）

1. three 是 **r147**：颜色要 `convertSRGBToLinear()`；主项目用 legacyMode 兼容，别双重转换。
2. `renderer.render` 在 three 里是**实例属性**，给 `THREE.WebGLRenderer.prototype` 打补丁无效——俯视图想关雾/提亮，得从相机沿 parent 上溯拿 Scene（visual-check 已这么改）。
3. **CDN 风险（待处理）**：`index.html` 从 jsdelivr 引 three.js，2026-09-24 实测 jsdelivr 不可达 → 页面直接起不来。答辩现场若断网就是白屏。`node_modules` 里有 three 0.147.0，可以本地化。
4. 无头渲染很慢（软件渲染 + 2300 mesh），单机位约 1 分钟，别以为是卡死。
---

## 状态更新（2026-10-04）

昼夜系统已由组长接进主项目：js/lighting.js（两张参数表 D/N + 10 组灯笼灯位，逐条对应本文件里的 applyNight()），HUD 有「入夜 · 灯火」按钮、快捷键 N，出图工具 scripts/visual-check.mjs 支持 night: true 机位。

Kimi 注意：如果改原型里的灯位 / 颜色 / 曝光，请告诉我，我同步更新 js/lighting.js 的两张表，否则两边会不一致。
