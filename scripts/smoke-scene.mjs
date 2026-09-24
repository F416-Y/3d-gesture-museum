/* ============================================================
 * smoke-scene.mjs —— 引擎冒烟测试（CI 用）
 * 归属：组长（组员7）
 * ------------------------------------------------------------
 * 在 Node 里用桩 DOM 真实执行 js/scene.js 的 init()，检查这些不变量：
 *   1. init() 不抛错
 *   2. 对外 API 齐全：init / update / getHallAt / obstacles / spotMeshes / hallRegions
 *   3. 每个碰撞体结构合法（rect 四边有序、circle 半径 > 0）
 *   4. 每个展品热点都指向 js/config.js 里真实存在的展品 id
 *   5. 每盏射灯都挂了 target
 *   6. 展厅区域自洽（与具体方案无关）：
 *      · config.halls 里每个展厅都必须有对应 hallRegions 区域（否则顶栏标签空白）
 *      · 每个区域都要能在自身范围内被 getHallAt 命中（采样检查，抓坐标写错/被完全覆盖）
 *      · hallRegions 里多出来的 id 只给警告（等 config 更新，不阻塞 PR）
 * 设计原则：只查不变量，不锁死具体坐标与数量——换方案不用改测试。
 * 用法：node scripts/smoke-scene.mjs
 * ============================================================ */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const THREE = require("three");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const problems = [];
const warnings = [];

/* 元素桩：three 的 ImageLoader 会调 createElementNS + addEventListener */
function makeEl() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, remove() {} }; }
function makeCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", globalAlpha: 1,
    fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, arc() {}, arcTo() {}, rect() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    fillText() {}, strokeText() {}, measureText() { return { width: 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return null; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
  };
}

const sandbox = {
  console, setTimeout, clearTimeout, Math, Date, JSON,
  Object, Array, String, Number, Boolean, Error, RegExp, Set, Map,
  Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array, Float32Array,
  performance: { now: () => 0 },
  navigator: { userAgent: "ci-smoke" },
  requestAnimationFrame() {},
  document: {
    readyState: "complete",
    createElement() { return makeEl(); },
    createElementNS() { return makeEl(); },
    getElementById() { return null; },
    querySelector() { return null; },
    addEventListener() {},
  },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.THREE = THREE;
vm.createContext(sandbox);
/* three 的 ImageLoader 在 Node realm 里查全局 document（贴图加载路径），补一个桩才不会 TypeError */
const _savedDoc = globalThis.document;
globalThis.document = sandbox.document;

try {
  vm.runInContext(read("js/config.js"), sandbox, { filename: "js/config.js" });
  /* 与 index.html 同序加载外观模块：不加载它们会退回旧布局（buildJiangnanCompound），
     门禁就测不到真实路径——曾因此漏掉「新布局 0 个展品热点、E 键查不到展品」的 bug */
  ["js/models.js", "js/exterior.js", "js/gallery.js", "js/windows.js",
   "js/exterior-layout.js", "js/slots.js", "js/foliage.js"].forEach(function (f) {
    vm.runInContext(read(f), sandbox, { filename: f });
  });
  vm.runInContext(read("js/scene.js"), sandbox, { filename: "js/scene.js" });
} catch (e) {
  console.error("x 加载引擎脚本失败：" + e.message);
  process.exit(1);
}

let result;
try {
  result = vm.runInContext(`
    (function () {
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
      MuseumScene.init({ scene: scene, camera: camera });
      var meshes = 0, spotTotal = 0, spotWithTarget = 0;
      scene.traverse(function (o) {
        if (o.isMesh) meshes++;
        if (o.isSpotLight) { spotTotal++; if (o.target && o.target.parent) spotWithTarget++; }
      });
      var regions = [];
      for (var id in MuseumScene.hallRegions) {
        var r = MuseumScene.hallRegions[id];
        regions.push({ id: id, type: r.type, x: r.x, z: r.z, radius: r.r,
                       x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 });
      }
      return {
        obstacles: MuseumScene.obstacles,
        spots: MuseumScene.spotMeshes,
        regions: regions,
        cfgHalls: (window.MuseumConfig.halls || []).map(function (h) { return h.id; }),
        exhibitIds: (window.MuseumConfig.exhibits || []).map(function (e) { return e.id; }),
        apiOk: typeof MuseumScene.init === "function" && typeof MuseumScene.update === "function" &&
               typeof MuseumScene.getHallAt === "function" && Array.isArray(MuseumScene.obstacles) &&
               Array.isArray(MuseumScene.spotMeshes),
        meshes: meshes,
        spotTotal: spotTotal,
        spotWithTarget: spotWithTarget
      };
    })();
  `, sandbox);
} catch (e) {
  console.error("x MuseumScene.init() 运行时报错：" + e.message);
  process.exit(1);
}

const num = (v) => typeof v === "number" && isFinite(v);

if (!result.apiOk) problems.push("MuseumScene 对外 API 不完整（需要 init / update / getHallAt / obstacles / spotMeshes）");
if (!result.regions.length) problems.push("hallRegions 为空：玩家无法判断自己在哪个展厅");

Array.prototype.forEach.call(result.obstacles, (o, i) => {
  if (o.type === "rect") {
    if (![o.x0, o.z0, o.x1, o.z1].every(num)) problems.push("obstacles[" + i + "] rect 坐标不是数字：" + JSON.stringify(o));
    else if (o.x0 >= o.x1 || o.z0 >= o.z1) problems.push("obstacles[" + i + "] rect 边界颠倒（须 x0<x1、z0<z1）：" + JSON.stringify(o));
  } else if (o.type === "circle") {
    if (!num(o.x) || !num(o.z) || !num(o.r) || o.r <= 0) problems.push("obstacles[" + i + "] circle 参数非法：" + JSON.stringify(o));
  } else {
    problems.push("obstacles[" + i + "] type 只能是 rect 或 circle：" + JSON.stringify(o));
  }
});

const ids = new Set(result.exhibitIds);
Array.prototype.forEach.call(result.spots, (s, i) => {
  if (!s.exhibitId) problems.push("spotMeshes[" + i + "] 缺少 exhibitId");
  else if (!ids.has(s.exhibitId)) problems.push("spotMeshes[" + i + "] 的 exhibitId「" + s.exhibitId + "」在 config.js 里不存在（展品打不开或弹错内容）");
  if (!num(s.x) || !num(s.y) || !num(s.z) || !num(s.radius) || s.radius <= 0) problems.push("spotMeshes[" + i + "] 坐标或半径非法：" + JSON.stringify(s));
});

/* 热点不能为空：新布局下若一条都没登记，玩家按 E / 捏合都打不开鉴赏弹窗（曾真实发生过） */
if (Array.isArray(result.spots) && result.spots.length === 0) {
  problems.push("展品热点为 0：鉴画交互整个不可用（按 docs/外观原型-坐标对接表.md 在 proto 分支登记热点）");
}
/* 有展品但没热点：只警告不阻塞（补登记进行中） */
const withSpot = new Set(Array.prototype.map.call(result.spots || [], (s) => s.exhibitId));
const noSpot = [...ids].filter((id) => !withSpot.has(id));
if (noSpot.length) warnings.push("config 里有 " + noSpot.length + " 件展品还没登记热点（暂不可交互）：" + noSpot.join(" "));

if (result.spotTotal > 0 && result.spotWithTarget !== result.spotTotal) {
  problems.push("有 " + (result.spotTotal - result.spotWithTarget) + " 盏射灯没挂 target（会照向世界原点，画打不亮）");
}
if (result.meshes < 50) problems.push("场景只有 " + result.meshes + " 个 mesh，疑似外观构建失败");

/* ---------- 展厅区域自洽（与具体方案无关） ---------- */
const regionIds = result.regions.map((r) => r.id);
const hallAt = (x, z) => vm.runInContext("MuseumScene.getHallAt(" + x + ", " + z + ")", sandbox);

result.cfgHalls.forEach((id) => {
  if (!regionIds.includes(id)) {
    problems.push("config.halls 里的「" + id + "」没有对应 hallRegions 区域——玩家进到该厅时顶栏标签会是空的");
  }
});

function samplePoints(r) {
  const pts = [];
  if (r.type === "circle") {
    [0.3, 0.6, 0.9].forEach((k) => {
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * Math.PI * 2;
        pts.push([r.x + Math.cos(th) * r.radius * k, r.z + Math.sin(th) * r.radius * k]);
      }
    });
    pts.push([r.x, r.z]);
  } else {
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= 5; j++) {
        pts.push([r.x0 + ((r.x1 - r.x0) * i) / 6, r.z0 + ((r.z1 - r.z0) * j) / 6]);
      }
    }
  }
  return pts;
}

result.regions.forEach((r) => {
  const hit = samplePoints(r).some(([x, z]) => hallAt(x, z) === r.id);
  if (!hit) {
    problems.push("区域「" + r.id + "」在自身范围内采样都命中不到自己——坐标写错，或被其它区域完全覆盖（玩家进不去这个展厅）");
  }
});

const extra = regionIds.filter((id) => !result.cfgHalls.includes(id));
if (extra.length) {
  warnings.push("hallRegions 里有 " + extra.length + " 个区域尚未写进 config.halls（" + extra.join(", ") +
                "）——补上之前，玩家进这些厅时顶栏标签会是空的；等 config 的 PR 合并后自动消失。");
}

console.log("场景冒烟测试");
console.log("  mesh " + result.meshes + " ｜ 碰撞体 " + result.obstacles.length + " ｜ 展品热点 " + result.spots.length +
            " ｜ 射灯带 target " + result.spotWithTarget + "/" + result.spotTotal);
console.log("  展厅区域 " + result.regions.length + " 个：" + regionIds.join(", ") + " ｜ config.halls " + result.cfgHalls.length + " 个：" + result.cfgHalls.join(", "));

if (warnings.length) {
  console.log("");
  warnings.forEach((w) => console.log("  ! 警告：" + w));
}
if (problems.length) {
  console.error("");
  console.error("x 冒烟测试未通过，共 " + problems.length + " 个问题：");
  problems.forEach((p) => console.error("  · " + p));
  process.exit(1);
}
console.log("");
console.log("OK 冒烟测试通过：引擎能正常初始化，接缝数据结构与展厅区域自洽");