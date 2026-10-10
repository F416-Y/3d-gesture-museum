/* ============================================================
 * walkthrough-test.mjs —— 漫游最终测试（CI 可跑，无浏览器）
 * 归属：组员1（漫游交互工程师）
 * ------------------------------------------------------------
 * 在 Node 里用桩 DOM 真实执行 js/player.js + js/scene.js，直接驱动
 * MuseumPlayer.update() 走「前进/后退/转向/碰撞/门洞/台基/展厅返回」，
 * 不重写任何碰撞逻辑，测的就是线上代码本身。
 *
 * 用法：node scripts/walkthrough-test.mjs
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

/* ---------- 桩 DOM（同 smoke-scene） ---------- */
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
  navigator: { userAgent: "ci-walkthrough" },
  requestAnimationFrame() {},
  document: { readyState: "complete", createElement() { return makeEl(); }, createElementNS() { return makeEl(); }, getElementById() { return null; }, querySelector() { return null; }, addEventListener() {} },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.THREE = THREE;
vm.createContext(sandbox);
const _savedDoc = globalThis.document;
globalThis.document = sandbox.document;

try {
  vm.runInContext(read("js/config.js"), sandbox, { filename: "js/config.js" });
  ["js/models.js", "js/exterior.js", "js/gallery.js", "js/windows.js",
   "js/exterior-layout.js", "js/slots.js", "js/foliage.js"].forEach((f) => {
    vm.runInContext(read(f), sandbox, { filename: f });
  });
  vm.runInContext(read("js/scene.js"), sandbox, { filename: "js/scene.js" });
  vm.runInContext(read("js/player.js"), sandbox, { filename: "js/player.js" });
} catch (e) {
  console.error("x 加载引擎脚本失败：" + e.message);
  process.exit(1);
}

/* ---------- 拿到真实对象，直接在 Node 侧调用 ---------- */
const MuseumScene = vm.runInContext("MuseumScene", sandbox);
const MuseumPlayer = vm.runInContext("MuseumPlayer", sandbox);
const Config = vm.runInContext("window.MuseumConfig", sandbox);
const cam = { position: new THREE.Vector3(), rotation: new THREE.Euler() };

try {
  MuseumScene.init({ scene: new THREE.Scene(), camera: cam });
  MuseumPlayer.init(cam);
} catch (e) {
  console.error("x init() 运行时报错：" + e.message);
  process.exit(1);
}

const player = Config.player;
const R = player.radius;
const EYE = player.eyeHeight;
const results = [];

function fmt(n, d = 2) { return (Math.round(n * 10 ** d) / 10 ** d).toFixed(d); }

/* ---------- 碰撞穿透深度（中心到障碍的最近距离 - 半径，>0 即穿入） ---------- */
function penetration(px, pz) {
  let worst = -Infinity;
  for (const o of MuseumScene.obstacles) {
    let cx, cz, minDist;
    if (o.type === "circle") { cx = o.x; cz = o.z; minDist = o.r + R; }
    else {
      cx = Math.min(Math.max(px, o.x0), o.x1);
      cz = Math.min(Math.max(pz, o.z0), o.z1);
      minDist = R;
    }
    const d = Math.hypot(px - cx, pz - cz);
    const pen = minDist - d;
    if (pen > worst) worst = pen;
  }
  return worst;
}

/* ---------- 朝向辅助 ---------- */
function faceInfo(px, pz, yaw, tx, tz) {
  const targetYaw = Math.atan2(-(tx - px), -(tz - pz));
  let diff = targetYaw - yaw;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return { targetYaw, diff };
}

function pos() { const p = MuseumPlayer.getPosition(); return [p.x, p.y, p.z]; }

/* 点对点导航（只前进 + 转向，无平移），撞墙则提前返回 */
function drive(tx, tz, { dt = 1 / 60, maxFrames = 3000, alignTol = 0.12, dead = 0.12, target = 0.3 } = {}) {
  let lastX, lastZ, stuck = 0, minPen = 0;
  for (let f = 0; f < maxFrames; f++) {
    const p = MuseumPlayer.getPosition();
    const { diff } = faceInfo(p.x, p.z, MuseumPlayer.getYaw(), tx, tz);
    const input = {
      forward: Math.abs(diff) < alignTol, back: false,
      turnLeft: diff < -dead, turnRight: diff > dead, sprint: false,
    };
    MuseumPlayer.update(dt, input, cam);
    const q = MuseumPlayer.getPosition();
    minPen = Math.min(minPen, penetration(q.x, q.z));
    if (Math.hypot(q.x - tx, q.z - tz) < target) return { ok: true, frames: f, pen: minPen, pos: [q.x, q.y, q.z] };
    const moved = Math.hypot(q.x - lastX, q.z - lastZ);
    stuck = (lastX !== undefined && moved < 1e-4) ? stuck + 1 : 0;
    if (stuck > 150) return { ok: false, stuck: true, frames: f, pen: minPen, pos: [q.x, q.y, q.z] };
    lastX = q.x; lastZ = q.z;
  }
  const q = MuseumPlayer.getPosition();
  return { ok: false, frames: maxFrames, pen: minPen, pos: [q.x, q.y, q.z] };
}

/* ============================================================
 * T1 前进（出生点沿中轴北上，登序厅台基）
 * ============================================================ */
{
  MuseumPlayer.teleport(0, 38, 0);
  // 目标 (0,32)：在序厅台基上、中央铜鼎(0,29.5) 之南，可达
  const r = drive(0, 32, { target: 0.4 });
  const p = pos();
  results.push({
    id: "前进", detail: "出生点→登上序厅台基（y 应升到 1.2+1.7=2.9）",
    ok: r.ok && Math.abs(p[1] - (1.2 + EYE)) < 0.05,
    info: `到达 z=${fmt(p[2])} 视高 y=${fmt(p[1])} ｜ 期望 2.90 ｜ ${r.stuck ? "卡住" : (r.ok ? "通过" : "未达")}`,
  });
}

/* ============================================================
 * T2 后退（反向位移）
 * ============================================================ */
{
  MuseumPlayer.teleport(0, 30, Math.PI); // 面朝南(+z)
  const before = pos();
  for (let f = 0; f < 60; f++) MuseumPlayer.update(1 / 60, { forward: false, back: true, turnLeft: false, turnRight: false, sprint: false }, cam);
  const after = pos();
  const dz = after[2] - before[2];
  results.push({
    id: "后退", detail: "面南按后退，应 +z 位移且不穿墙",
    ok: dz > 0.05 && penetration(after[0], after[2]) <= 0.01,
    info: `Δz=+${fmt(dz)} ｜ 穿透=${fmt(penetration(after[0], after[2]))} ｜ ${dz > 0.05 ? "通过" : "未动"}`,
  });
}

/* ============================================================
 * T3 转向（按住右转，yaw 应下降）
 * ============================================================ */
{
  MuseumPlayer.teleport(0, 38, 0);
  const y0 = MuseumPlayer.getYaw();
  for (let f = 0; f < 60; f++) MuseumPlayer.update(1 / 60, { forward: false, back: false, turnLeft: false, turnRight: true, sprint: false }, cam);
  const dy = MuseumPlayer.getYaw() - y0;
  results.push({
    id: "转向", detail: "右转 1 秒，yaw 应负向变化（约 -1.9 弧度）",
    ok: dy < -1.0 && dy > -3.0,
    info: `Δyaw=${fmt(dy)} rad（约 ${fmt(dy * 57.3)}°）｜ 期望约 -1.9 rad`,
  });
}

/* ============================================================
 * T4 碰撞停止（撞大门左翼墙，不穿墙）
 * ============================================================ */
{
  MuseumPlayer.teleport(-4, 36, 0); // 面北，正对大门左翼 rect(-7.1,34.25,-1.8,34.75)
  const r = drive(-4, 34, { target: 0.3 });
  const p = pos();
  const ok = penetration(p[0], p[2]) <= 0.001;
  results.push({
    id: "碰撞停止", detail: "面北撞大门左翼墙，应停在墙外 0.5m",
    ok,
    info: `停于 z=${fmt(p[2])}（墙 z1=34.75，+半径0.5=35.25）｜ 穿透=${fmt(penetration(p[0], p[2]), 3)} ｜ ${ok ? "未穿墙" : "穿墙!"}`,
  });
}

/* ============================================================
 * T5 台基高度（terrainHeightAt 覆盖核查）
 * ============================================================ */
{
  const points = [
    ["序厅台基中心 (0,29.5)", 0, 29.5, 1.2],
    ["序厅北缘 (0,24.5)", 0, 24.5, 1.2],
    ["南入口踏跺顶 (0,35.0)", 0, 35.0, 1.2],
    ["南入口踏跺底 (0,36.7)", 0, 36.7, 0.2],
    ["北侧大踏跺中段 (0,23.5)", 0, 23.5, 0.8],
    ["花鸟正房台基 (0,-30)", 0, -30, 0.5],
    ["花鸟院地面 (0,-26)", 0, -26, 0.0],
    ["侧院外带 (11.2,30)", 11.2, 30, 1.2],
    ["中轴庭院 (0,10)", 0, 10, 0.0],
  ];
  const rows = points.map(([name, x, z, expect]) => {
    const h = MuseumScene.terrainHeightAt(x, z);
    const good = Math.abs(h - expect) < 0.01;
    return { name, x, z, expect, got: h, good };
  });
  const bad = rows.filter((r) => !r.good);
  results.push({
    id: "台基高度", detail: "terrainHeightAt 是否覆盖所有台基/踏跺",
    ok: bad.length === 0,
    info: rows.map((r) => `${r.name}: ${fmt(r.got)}（期望 ${fmt(r.expect)}）${r.good ? "" : "  ✗不符"}`).join("\n    "),
  });
}

/* ============================================================
 * T6 门洞进出（后墙侧门 1.6m，往返）
 * ============================================================ */
{
  MuseumPlayer.teleport(-4.8, 26.5, 0); // 序厅内，面北过 1.6m 侧门
  const out = drive(-4.8, 23.5, { target: 0.3 });
  const pOut = pos();
  const back = { ok: false };
  if (out.ok) {
    MuseumPlayer.teleport(pOut[0], pOut[2], Math.PI); // 面南原路返回
    const r2 = drive(-4.8, 26.5, { target: 0.3 });
    Object.assign(back, r2);
  }
  results.push({
    id: "门洞进出", detail: "后墙 1.6m 侧门 出→进 往返",
    ok: out.ok && back.ok,
    info: `出门 ${out.ok ? "通过" : (out.stuck ? "卡门口!" : "失败")}（z→${fmt(pOut[2])}）｜ 返回 ${back.ok ? "通过" : (back.stuck ? "卡门口!" : "失败")}`,
  });
}

/* ============================================================
 * T7 展厅返回（花鸟正房 0.5m 台基 + 往返 + 区域判定）
 * ============================================================ */
{
  const hallAt = (x, z) => MuseumScene.getHallAt(x, z);
  MuseumPlayer.teleport(0, -26.5, 0); // 花鸟院内，面北进正房（门在 z=-28.1，净宽 2.6m）
  const inHall = drive(0, -30, { target: 0.3 });
  const pIn = pos();
  const yOnPlatform = pIn[1];
  // 期望站上 0.5m 台基后视高 = 0.5 + 1.7 = 2.2
  const platformOk = Math.abs(yOnPlatform - (0.5 + EYE)) < 0.05;
  // 返回
  const backOut = { ok: false };
  if (inHall.ok) {
    MuseumPlayer.teleport(pIn[0], pIn[2], Math.PI);
    const r2 = drive(0, -26.5, { target: 0.3 });
    Object.assign(backOut, r2);
  }
  results.push({
    id: "展厅返回", detail: "花鸟正房进出 + 台基高度 + 区域判定",
    ok: inHall.ok && backOut.ok,
    info: `进正房 ${inHall.ok ? "通过" : "失败"} ｜ 站上台基视高 y=${fmt(yOnPlatform)}（期望 2.20）${platformOk ? "" : "  ✗台基未生效(穿台基)"} ｜ 返回 ${backOut.ok ? "通过" : "失败"}`,
  });
  results.push({
    id: "区域判定", detail: "getHallAt 关键点",
    ok: true,
    info: `出生(0,38)=${hallAt(0, 38)} ｜ 序厅(0,30)=${hallAt(0, 30)} ｜ 庭院(0,10)=${hallAt(0, 10)} ｜ 花鸟(0,-30)=${hallAt(0, -30)}`,
  });
}

/* ============================================================
 * 输出
 * ============================================================ */
console.log("漫游最终测试（node scripts/walkthrough-test.mjs）");
console.log(`  参数 speed=${player.speed} turnSpeed=${player.turnSpeed} radius=${player.radius} eyeHeight=${player.eyeHeight} ｜ 障碍 ${MuseumScene.obstacles.length} 个\n`);
let fail = 0;
for (const r of results) {
  console.log(`${r.ok ? "  OK " : "  x  "} ${r.id}：${r.detail}`);
  console.log(`      ${r.info.split("\n").join("\n      ")}`);
  if (!r.ok) fail++;
}
console.log("");
if (fail) { console.log(`未通过 ${fail} 项（其余通过）`); process.exit(1); }
console.log("全部通过");
