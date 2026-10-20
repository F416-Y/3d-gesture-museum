/* ============================================================
 * verify-exhibits.mjs —— 展品热点、弹窗与画位全量验收
 * 归属：组员4（展品系统工程师）
 * ------------------------------------------------------------
 * 运行：node scripts/verify-exhibits.mjs
 * 校验：
 *   1. config.exhibits 与 tools/exhibit-anchors.json 一一对应
 *   2. 每件展品恰好一个热点，热点坐标与权威落位表完全一致
 *   3. 每个热点至少有一个玩家可站立的接近点
 *   4. 每个热点经 MuseumExhibit.update()/pick() 都打开正确展品
 *   5. 所有挂画 seed 都已接入 MuseumGallery；缺图时必须有占位卷轴
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
const anchors = JSON.parse(read("tools/exhibit-anchors.json"));
const problems = [];
const warnings = [];

function makeEl() {
  return {
    width: 0, height: 0, style: {},
    getContext: () => makeCtx(),
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, removeAttribute() {}, remove() {},
  };
}
function makeCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "", globalAlpha: 1,
    fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, arc() {}, arcTo() {}, rect() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    fillText() {}, strokeText() {}, measureText() { return { width: 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return null; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
    ellipse() {}, roundRect() {}, setLineDash() {}, getLineDash() { return []; },
    drawImage() {}, putImageData() {}, createImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
    setTransform() {}, resetTransform() {}, transform() {}, isPointInPath() { return false; },
  };
}

const sandbox = {
  console, setTimeout, clearTimeout, Math, Date, JSON,
  Object, Array, String, Number, Boolean, Error, RegExp, Set, Map,
  Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array, Float32Array,
  performance: { now: () => 0 },
  navigator: { userAgent: "verify-exhibits" },
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
const savedDocument = globalThis.document;
globalThis.document = sandbox.document;

try {
  [
    "js/config.js", "js/models.js", "js/exterior.js", "js/gallery.js",
    "js/windows.js", "js/exterior-layout.js", "js/slots.js", "js/foliage.js",
    "js/scene.js", "js/exhibit.js",
  ].forEach((file) => vm.runInContext(read(file), sandbox, { filename: file }));
} catch (error) {
  globalThis.document = savedDocument;
  console.error("加载展品链路失败：" + error.message);
  process.exit(1);
}

let snapshot;
try {
  snapshot = vm.runInContext(`
    (function () {
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
      MuseumScene.init({ scene: scene, camera: camera });
      return {
        exhibits: window.MuseumConfig.exhibits,
        halls: window.MuseumConfig.halls,
        spots: MuseumScene.spotMeshes,
        obstacles: MuseumScene.obstacles,
        galleryMap: window.MuseumGallery.map,
        galleryList: window.MuseumGallery.list()
      };
    })();
  `, sandbox);
} catch (error) {
  globalThis.document = savedDocument;
  console.error("场景初始化失败：" + error.message);
  process.exit(1);
}
const ids = snapshot.exhibits.map((ex) => ex.id);
const anchorIds = anchors.map((a) => a.id);
if (new Set(ids).size !== ids.length) problems.push("config.exhibits 存在重复 id");
if (new Set(anchorIds).size !== anchorIds.length) problems.push("tools/exhibit-anchors.json 存在重复 id");
if (ids.length !== anchorIds.length) problems.push("config.exhibits 与权威落位表数量不一致：" + ids.length + " vs " + anchorIds.length);
for (const id of ids) if (!anchorIds.includes(id)) problems.push("权威落位表缺少展品：" + id);
for (const id of anchorIds) if (!ids.includes(id)) problems.push("config.exhibits 缺少落位项：" + id);

const validTypes = new Set(["painting", "sculpture", "artifact"]);
const hallIds = new Set(snapshot.halls.map((h) => h.id));
for (const ex of snapshot.exhibits) {
  for (const key of ["id", "type", "hall", "title", "artist", "dynasty", "era", "medium", "collection", "intro", "appreciation"]) {
    if (typeof ex[key] !== "string" || !ex[key].trim()) problems.push(ex.id + " 缺少字段 " + key);
  }
  if (!validTypes.has(ex.type)) problems.push(ex.id + " 的 type 非法：" + ex.type);
  if (!hallIds.has(ex.hall)) problems.push(ex.id + " 的 hall 不存在：" + ex.hall);
  if ([...ex.intro].length < 80) problems.push(ex.id + " 的 intro 少于 80 字");
  if ([...ex.appreciation].length < 120) problems.push(ex.id + " 的 appreciation 少于 120 字");
}

const spotById = new Map();
for (const spot of snapshot.spots) {
  if (!spot.exhibitId) problems.push("存在缺少 exhibitId 的热点");
  else if (spotById.has(spot.exhibitId)) problems.push("展品存在重复热点：" + spot.exhibitId);
  else spotById.set(spot.exhibitId, spot);
}
for (const ex of snapshot.exhibits) {
  if (!spotById.has(ex.id)) problems.push("展品缺少热点：" + ex.id);
}
for (const spot of snapshot.spots) {
  if (!ids.includes(spot.exhibitId)) problems.push("热点指向不存在的展品：" + spot.exhibitId);
}
if (snapshot.spots.length !== snapshot.exhibits.length) {
  problems.push("热点数与展品数不一致：" + snapshot.spots.length + " vs " + snapshot.exhibits.length);
}

const anchorById = new Map(anchors.map((a) => [a.id, a]));
for (const [id, spot] of spotById) {
  const anchor = anchorById.get(id);
  if (!anchor) continue;
  for (const axis of ["x", "y", "z"]) {
    if (Math.abs(Number(spot[axis]) - Number(anchor[axis])) > 0.001) {
      problems.push(id + " 热点 " + axis + " 与落位表不一致：" + spot[axis] + " vs " + anchor[axis]);
    }
  }
  if (!(spot.radius > 0)) problems.push(id + " 的热点半径非法");
}

function blocked(x, z, radius) {
  for (const o of snapshot.obstacles) {
    if (o.type === "circle") {
      const dx = x - o.x, dz = z - o.z;
      if (Math.sqrt(dx * dx + dz * dz) < o.r + radius) return true;
    } else {
      const cx = Math.min(Math.max(x, o.x0), o.x1);
      const cz = Math.min(Math.max(z, o.z0), o.z1);
      const dx = x - cx, dz = z - cz;
      if (Math.sqrt(dx * dx + dz * dz) < radius) return true;
    }
  }
  return false;
}
for (const [id, spot] of spotById) {
  let reachable = false;
  const radii = [0.8, 1.1, 1.4, Math.min(1.8, spot.radius * 0.75)];
  for (const r of radii) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      if (!blocked(spot.x + Math.cos(angle) * r, spot.z + Math.sin(angle) * r, 0.5)) {
        reachable = true;
        break;
      }
    }
    if (reachable) break;
  }
  if (!reachable) problems.push(id + " 的热点 1.8m 内没有可达站位");
}

const popupFailures = vm.runInContext(`
  (function () {
    var failures = [];
    var current = { x: 0, z: 0 };
    var lastPopup = null;
    MuseumPlayer = { getPosition: function () { return current; } };
    MuseumUI = { showExhibit: function (ex) { lastPopup = ex; } };
    MuseumExhibit.init();
    MuseumScene.spotMeshes.forEach(function (spot) {
      current = { x: spot.x, z: spot.z };
      lastPopup = null;
      MuseumExhibit.update();
      var picked = MuseumExhibit.pick();
      if (!picked || !lastPopup || lastPopup.id !== spot.exhibitId) {
        failures.push(spot.exhibitId + " -> " + (lastPopup && lastPopup.id || "null"));
      }
    });
    return failures;
  })();
`, sandbox);
for (const failure of popupFailures) problems.push("弹窗路由错误：" + failure);

for (const item of snapshot.galleryList) {
  if (!item.seed || !item.id) problems.push("画廊映射项不完整：" + JSON.stringify(item));
}
for (const anchor of anchors) {
  if (!anchor.seed) continue;
  if (snapshot.galleryMap[anchor.seed] !== anchor.id) {
    problems.push("seed " + anchor.seed + " 未接入或映射错误，应为 " + anchor.id + "，实际 " + snapshot.galleryMap[anchor.seed]);
  }
}
const texturesOk = vm.runInContext("MuseumGallery.list().every(function (item) { return !!MuseumGallery.tex(item.seed); })", sandbox);
if (!texturesOk) problems.push("存在无法生成真实/占位纹理的画位");
const missingImages = snapshot.galleryList
  .filter((item) => !fs.existsSync(path.join(root, "assets/images", item.id + ".jpg")))
  .map((item) => item.id);
if (missingImages.length) warnings.push("以下展品图片尚未入库，当前使用题名占位卷轴，放入同名 JPG 后自动替换：" + missingImages.join(" "));

console.log("展品热点与弹窗全量验收");
console.log("  展品 " + snapshot.exhibits.length + " 件 ｜ 热点 " + snapshot.spots.length + " 个 ｜ 权威落位 " + anchors.length + " 条 ｜ 画廊映射 " + snapshot.galleryList.length + " 个");
if (warnings.length) warnings.forEach((w) => console.log("  ! 警告：" + w));
if (problems.length) {
  console.error("");
  console.error("验收未通过，共 " + problems.length + " 个问题：");
  problems.forEach((p) => console.error("  · " + p));
  process.exit(1);
}
globalThis.document = savedDocument;
console.log("");
console.log("OK 全部展品热点坐标一致、可接近，且捏合/E 路由到正确弹窗");
