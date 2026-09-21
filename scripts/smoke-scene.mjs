/* ============================================================
 * smoke-scene.mjs —— 引擎冒烟测试（CI 用）
 * 归属：组长（组员7）
 * ------------------------------------------------------------
 * 在 Node 里用桩 DOM 真实执行 js/scene.js 的 init()，检查这些不变量：
 *   1. init() 不抛错
 *   2. 对外 API 齐全：init / update / getHallAt / obstacles / spotMeshes / hallRegions
 *   3. 每个碰撞体结构合法（rect 四边有序、circle 半径 > 0）
 *   4. 每个展品热点都指向 js/config.js 里真实存在的展品 id
 *   5. 三个展厅的判定点返回正确 id
 *   6. 每盏射灯都挂了 target（否则 three.js 会照向世界原点）
 * 只查「不变量」，不锁定具体数量——组员1 增删碰撞体不会误报。
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
    createElement() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx() }; },
    createElementNS() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx() }; },
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

try {
  vm.runInContext(read("js/config.js"), sandbox, { filename: "js/config.js" });
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
      var ids = (window.MuseumConfig.exhibits || []).map(function (e) { return e.id; });
      return {
        obstacles: MuseumScene.obstacles,
        spots: MuseumScene.spotMeshes,
        halls: Object.keys(MuseumScene.hallRegions),
        apiOk: typeof MuseumScene.init === "function" && typeof MuseumScene.update === "function" &&
               typeof MuseumScene.getHallAt === "function" && Array.isArray(MuseumScene.obstacles) &&
               Array.isArray(MuseumScene.spotMeshes),
        exhibitIds: ids,
        hallCenter: MuseumScene.getHallAt(0, 0),
        hallPlaza: MuseumScene.getHallAt(0, 20),
        hallCorridor: MuseumScene.getHallAt(-14.5, 0),
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
if (!result.halls || result.halls.length < 1) problems.push("hallRegions 为空：玩家无法判断自己在哪个展厅");

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

if (result.hallCenter !== "hall1") problems.push("getHallAt(0,0) 应为 hall1，实际：" + result.hallCenter);
if (result.hallPlaza !== "plaza") problems.push("getHallAt(0,20) 应为 plaza，实际：" + result.hallPlaza);
if (result.hallCorridor !== "hall2") problems.push("getHallAt(-14.5,0) 应为 hall2，实际：" + result.hallCorridor);
if (result.spotTotal > 0 && result.spotWithTarget !== result.spotTotal) {
  problems.push("有 " + (result.spotTotal - result.spotWithTarget) + " 盏射灯没挂 target（会照向世界原点，画打不亮）");
}
if (result.meshes < 50) problems.push("场景只有 " + result.meshes + " 个 mesh，疑似外观构建失败");

console.log("场景冒烟测试");
console.log("  mesh " + result.meshes + " ｜ 碰撞体 " + result.obstacles.length + " ｜ 展品热点 " + result.spots.length + " ｜ 射灯带 target " + result.spotWithTarget + "/" + result.spotTotal);
console.log("  展厅判定 (0,0)=" + result.hallCenter + "  (0,20)=" + result.hallPlaza + "  (-14.5,0)=" + result.hallCorridor);

if (problems.length) {
  console.error("");
  console.error("x 冒烟测试未通过，共 " + problems.length + " 个问题：");
  problems.forEach((p) => console.error("  · " + p));
  process.exit(1);
}
console.log("");
console.log("OK 冒烟测试通过：引擎能正常初始化，接缝数据结构合法");
