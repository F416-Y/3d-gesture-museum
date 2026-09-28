#!/usr/bin/env node
/**
 * 把外观原型同步进项目（可重复执行）
 * ------------------------------------------------------------------
 * 做三件事：
 *   1. 把 <源原型 html> 原样复制到 tools/exterior-prototype.html
 *   2. 从里面切出"构件库 + 布局"那个 IIFE，换名成 MuseumExteriorLayout，
 *      写成 js/exterior-layout.js（浏览器直接可用）
 *   3. 顺带把它主控段里的日光/半球光抓出来，附成 MuseumExteriorLayout.addLights(scene)
 * 用标记定位而不是行号 —— Kimi 改完原型重跑本脚本即可，不需要重新对齐行号。
 *
 * 用法：node scripts/vendor-prototype.mjs [源 html 路径]
 * 默认源：../jiangnan-painting-museum/exterior-layout.html（相对本仓库）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || path.resolve(ROOT, '..', 'jiangnan-painting-museum', 'exterior-layout.html');
const VENDOR = path.join(ROOT, 'tools', 'exterior-prototype.html');
const OUT = path.join(ROOT, 'js', 'exterior-layout.js');

if (!fs.existsSync(SRC)) { console.error('找不到源原型：' + SRC); process.exit(2); }
const html = fs.readFileSync(SRC, 'utf8');

/* ---- 1. 归档原样副本 ---- */
fs.mkdirSync(path.dirname(VENDOR), { recursive: true });
fs.writeFileSync(VENDOR, html.replace(/\r\n/g, '\n'), 'utf8');

/* ---- 2. 切出布局模块 ---- */
const START = 'window.MuseumScene = (function () {';
const s = html.indexOf(START);
if (s < 0) { console.error('原型里找不到 ' + START); process.exit(2); }
const e = html.indexOf('\n})();', s);
if (e < 0) { console.error('找不到模块结束标记 })( );'); process.exit(2); }
let body = html.slice(s, e + '\n})();'.length);
body = body.replace(START, 'window.MuseumExteriorLayout = (function () {');
body = body.replace(/\r\n/g, '\n');   /* 原型可能是 CRLF，先统一成 LF，后面的挂钩才好匹配 */
/* 颜色：本项目设了 ColorManagement.legacyMode=false（构造时已 sRGB→线性），
   原型的 C() 又转了一次会造成双重转换、整体偏暗，这里按模式自适应。 */
body = body.replace(
  'function C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }',
  'function C(hex) {\n' +
  '    if (THREE.ColorManagement && THREE.ColorManagement.legacyMode === false) return new THREE.Color(hex);\n' +
  '    return new THREE.Color(hex).convertSRGBToLinear();\n' +
  '  }');

/* ---- 3. 抓光照 ---- */
const li = html.indexOf('var sun = new THREE.DirectionalLight');
let lj = -1;
if (li >= 0) { lj = html.indexOf('scene.add(hemi)', li); if (lj < 0) lj = html.indexOf('scene.add(new THREE.HemisphereLight', li); }
let lights = '';
if (li >= 0 && lj >= 0) {
  lights = html.slice(li, html.indexOf('\n', lj) + 1).trim();
} else {
  lights = 'scene.add(new THREE.HemisphereLight(0xf2ead9, 0x70795a, 0.5));';
}

const header = `/* ============================================================
 * 外观布局（由 scripts/vendor-prototype.mjs 自动同步自外观原型）
 * 源文件：tools/exterior-prototype.html —— 请勿手改本文件，改原型后重跑脚本
 * ------------------------------------------------------------
 * 原作者：Kimi 的「江南文人国画博物馆 · 建筑外观布局原型」
 * 坐标约定（与原型一致）：1 单位 = 1 米；x 向东为正，z 向南为正
 * 入口：MuseumExteriorLayout.addLights(scene) / .build(scene) / .slots
 * ============================================================ */
`;
const footer = `
/* ---------- 原型的日光与半球光（从原型主控段自动抓取） ---------- */
window.MuseumExteriorLayout.addLights = function (scene) {
${lights}
};
`;

/* 画廊挂画挂钩：在 scrollTex 里插入一行，让我们能用真画顶掉程序化立轴 */
const HOOK_OLD = "function scrollTex(seed) {";
const HOOK_NEW = "function scrollTex(seed) {\n    if (window.MuseumGallery && window.MuseumGallery.tex) {\n      var _real = window.MuseumGallery.tex(seed);\n      if (_real) return _real;\n    }";
if (body.indexOf(HOOK_OLD) >= 0) {
  body = body.replace(HOOK_OLD, HOOK_NEW);
  console.log('画廊挂钩：已插入 scrollTex');
} else {
  console.log('画廊挂钩：未找到 scrollTex（原型结构变了？）');
}


/* 门禁修正：原型把后门用暗腔填死、正门只转 66度（看着像半开挡门）。
   这里统一改成"绕门轴大敞开"：删掉后门暗腔、双扇折到墙外，洞口全通透。 */
const DOOR_DEAD = "        if (!isEntry) {   /* 后门保持关闭：门洞填暗腔；正门敞开可直视室内 */\n" +
  "          var dk = sd.ax === 'x'\n" +
  "            ? box(doorW - 0.1, doorH, 0.16, M.ink, ox, wallY0 + doorH / 2, oz, 0, g)\n" +
  "            : box(0.16, doorH, doorW - 0.1, M.ink, ox, wallY0 + doorH / 2, oz, 0, g);\n" +
  "          dk.castShadow = false;\n" +
  "        }\n";
const DOOR_OPEN_X = "          var _op = 1.5708;\n" +
  "          lf1.position.x = ox - doorW / 2 + 0.12 + (leafW / 2) * Math.cos(_op);\n" +
  "          lf1.position.z = oz + sd.nz * (0.1 + (leafW / 2) * Math.sin(_op));\n" +
  "          lf1.rotation.y = -_op;\n" +
  "          lf2.position.x = ox + doorW / 2 - 0.12 - (leafW / 2) * Math.cos(_op);\n" +
  "          lf2.position.z = oz + sd.nz * (0.1 + (leafW / 2) * Math.sin(_op));\n" +
  "          lf2.rotation.y = _op;\n";
const DOOR_OPEN_Z = "          var _op2 = 1.5708;\n" +
  "          lf3.position.z = oz - doorW / 2 + 0.12 + (leafW / 2) * Math.cos(_op2);\n" +
  "          lf3.position.x = ox + sd.nx * (0.1 + (leafW / 2) * Math.sin(_op2));\n" +
  "          lf3.rotation.y = _op2;\n" +
  "          lf4.position.z = oz + doorW / 2 - 0.12 - (leafW / 2) * Math.cos(_op2);\n" +
  "          lf4.position.x = ox + sd.nx * (0.1 + (leafW / 2) * Math.sin(_op2));\n" +
  "          lf4.rotation.y = -_op2;\n";
const OLD_X = "          if (isEntry) { lf1.rotation.y = 1.15; lf2.rotation.y = -1.15; }   /* 正门双扇敞开 */\n";
const OLD_Z = "          if (isEntry) { lf3.rotation.y = 1.15; lf4.rotation.y = -1.15; }   /* 正门双扇敞开 */\n";
let fixLog = [];
if (body.indexOf(DOOR_DEAD) >= 0) { body = body.replace(DOOR_DEAD, ""); fixLog.push("删后门暗腔"); }
if (body.indexOf(OLD_X) >= 0) { body = body.replace(OLD_X, DOOR_OPEN_X); fixLog.push("正/后门 x 向双扇大敞开"); }
if (body.indexOf(OLD_Z) >= 0) { body = body.replace(OLD_Z, DOOR_OPEN_Z); fixLog.push("正/后门 z 向双扇大敞开"); }
console.log("门禁修正：" + (fixLog.length ? fixLog.join(" / ") : "未匹配到（原型结构变了？）"));

/* 格扇窗挂钩：命中"朝院立面"时由我们自己的落地格扇窗接管 */
const WIN_OLD = "function addWindow(x, y, z, ry, parent) {";
const WIN_NEW = "function addWindow(x, y, z, ry, parent) {\n    if (window.MuseumWindows && window.MuseumWindows.replace(x, y, z, ry, (parent || S.scene))) return null;";
if (body.indexOf(WIN_OLD) >= 0) { body = body.replace(WIN_OLD, WIN_NEW); console.log("格扇窗挂钩：已插入 addWindow"); }
else console.log("格扇窗挂钩：未找到 addWindow");


/* 大门修正：匾额文案 + 双扇大敞开（原型写的是"江南文人国画博物馆"、门只开 0.5 弧度） */
let gateLog = [];
if (body.indexOf("plaque('江南文人国画博物馆'") >= 0) {
  body = body.replace("plaque('江南文人国画博物馆'", "plaque('云墨美术馆'");
  gateLog.push("匾额改云墨美术馆");
}
if (body.indexOf("d1.rotation.y = 0.5; d2.rotation.y = -0.5;") >= 0) {
  body = body.replace("d1.rotation.y = 0.5; d2.rotation.y = -0.5;",
    "var _ga = 1.5708;\n" +
    "        d1.position.x = -1.7 + 0.85 * Math.cos(_ga);\n" +
    "        d1.position.z = 34.3 + 0.85 * Math.sin(_ga);\n" +
    "        d1.rotation.y = -_ga;\n" +
    "        d2.position.x = 1.7 - 0.85 * Math.cos(_ga);\n" +
    "        d2.position.z = 34.3 + 0.85 * Math.sin(_ga);\n" +
    "        d2.rotation.y = _ga;");
  gateLog.push("大门双扇大敞开");
}
console.log("大门修正：" + (gateLog.length ? gateLog.join(" / ") : "未匹配到"));


/* 大门美化（按参考图 前大门.png：朱红立柱 + 木门套 + 门槛 + 门环门钉） */
const BEAUTIFY_ANCHOR = "d2.rotation.y = _ga;";
const BEAUTIFY_ADD = "d2.rotation.y = _ga;\n" +
  "        /* ---- 大门细部：朱红立柱 + 门套 + 门槛 + 门环门钉 ---- */\n" +
  "        var _cb = new THREE.MeshLambertMaterial({ color: C(0x8C3B2E) });\n" +
  "        box(1.0, 5, 1.0, _cb, -2.3, 1.2 + 2.5, 34.55, 0, g);\n" +
  "        box(1.0, 5, 1.0, _cb,  2.3, 1.2 + 2.5, 34.55, 0, g);\n" +
  "        box(3.95, 0.3, 0.66, M.wood, 0, 1.2 + 3.45, 34.52, 0, g);\n" +
  "        box(0.28, 3.45, 0.66, M.wood, -1.98, 1.2 + 1.72, 34.52, 0, g);\n" +
  "        box(0.28, 3.45, 0.66, M.wood,  1.98, 1.2 + 1.72, 34.52, 0, g);\n" +
  "        box(3.95, 0.24, 0.95, M.stoneDark, 0, 1.2 + 0.12, 34.35, 0, g);\n" +
  "        var _si = 0;\n" +
  "        for (_si = 0; _si < 6; _si++) {\n" +
  "          box(0.14, 0.14, 0.06, M.tile, -0.45 + (_si % 3) * 0.45, 0.95 + Math.floor(_si / 3) * 1.25, 0.07, 0, d1);\n" +
  "          box(0.14, 0.14, 0.06, M.tile, -0.45 + (_si % 3) * 0.45, 0.95 + Math.floor(_si / 3) * 1.25, 0.07, 0, d2);\n" +
  "        }\n" +
  "        var _ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 8, 18), M.tile);\n" +
  "        _ring.position.set(0.46, 1.7, 0.09); _ring.castShadow = true; d1.add(_ring);\n" +
  "        box(0.3, 0.3, 0.05, M.tile, 0.46, 1.7, 0.06, 0, d1);\n" +
  "        var _ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 8, 18), M.tile);\n" +
  "        _ring2.position.set(-0.46, 1.7, 0.09); _ring2.castShadow = true; d2.add(_ring2);\n" +
  "        box(0.3, 0.3, 0.05, M.tile, -0.46, 1.7, 0.06, 0, d2);";
if (body.indexOf(BEAUTIFY_ANCHOR) >= 0) { body = body.replace(BEAUTIFY_ANCHOR, BEAUTIFY_ADD); console.log("大门美化：朱红柱/门套/门槛/门钉门环 已加"); }
else console.log("大门美化：未找到锚点（原型结构变了？）");
/* 全门敞开：原型里还有三处门是关着 / 虚掩的（廊门 26°、序厅左右小门 31°、北门楼完全关闭），
   而且都在门洞后塞了暗腔。这里统一改成 90° 大敞开，并把暗腔删掉，门洞全通透。 */
let openLog = [];
/* 1) 廊门 / 后门 / 侧门（gateHouse 的朱砂双扇门） */
const GH_OLD =
  "    /* 朱砂双扇门（半开） */\n" +
  "    var d1 = box(gateW / 2 - 0.08, 2.4, 0.08, M.door, -gateW / 4 - 0.02, 1.2, 0.1, 0, g);\n" +
  "    var d2 = box(gateW / 2 - 0.08, 2.4, 0.08, M.door, gateW / 4 + 0.02, 1.2, 0.1, 0, g);\n" +
  "    d1.rotation.y = 0.45; d2.rotation.y = -0.45;";
const GH_NEW =
  "    /* 朱砂双扇门：90 度完全大敞开（绕门轴折到墙外，门洞全通透） */\n" +
  "    var _gw = gateW / 2, _gl = (gateW / 2 - 0.06) / 2, _ga = 1.5708;\n" +
  "    var d1 = box(gateW / 2 - 0.08, 2.4, 0.08, M.door, -_gw + _gl * Math.cos(_ga), 1.2, 0.1 + _gl * Math.sin(_ga), 0, g);\n" +
  "    var d2 = box(gateW / 2 - 0.08, 2.4, 0.08, M.door, _gw - _gl * Math.cos(_ga), 1.2, 0.1 + _gl * Math.sin(_ga), 0, g);\n" +
  "    d1.rotation.y = -_ga; d2.rotation.y = _ga;";
if (body.indexOf(GH_OLD) >= 0) { body = body.replace(GH_OLD, GH_NEW); openLog.push("廊门/后门/侧门双扇 90° 敞开"); }

/* 2) 序厅高台左右小门（原型虚掩 31° + 暗腔挡视线） */
const SM_OLD =
  "    /* 左右小门：暗腔 + 双扇木门（虚掩）+ 石门坎 + 北侧四步踏跺下高台 */\n" +
  "    var dxi, dxx;\n" +
  "    for (dxi = 0; dxi < 2; dxi++) {\n" +
  "      dxx = dxi === 0 ? -4.8 : 4.8;\n" +
  "      var dcc = box(1.5, 2.4, 0.44, M.ink, dxx, 1.2 + 1.2, 25, 0, g);\n" +
  "      dcc.castShadow = false;\n" +
  "      var lf1 = box(0.72, 2.3, 0.08, M.door, dxx - 0.38, 1.2 + 1.15, 25, 0, g);\n" +
  "      var lf2 = box(0.72, 2.3, 0.08, M.door, dxx + 0.38, 1.2 + 1.15, 25, 0, g);\n" +
  "      lf1.rotation.y = 0.55; lf2.rotation.y = -0.55;";
const SM_NEW =
  "    /* 左右小门：删暗腔 + 双扇木门 90 度完全大敞开（向北开进中院）+ 石门坎 + 北侧四步踏跺下高台 */\n" +
  "    var dxi, dxx;\n" +
  "    for (dxi = 0; dxi < 2; dxi++) {\n" +
  "      dxx = dxi === 0 ? -4.8 : 4.8;\n" +
  "      var _sa = 1.5708, _sl = 0.36;\n" +
  "      var lf1 = box(0.72, 2.3, 0.08, M.door, dxx - 0.75 + _sl * Math.cos(_sa), 1.2 + 1.15, 25 - _sl * Math.sin(_sa), 0, g);\n" +
  "      var lf2 = box(0.72, 2.3, 0.08, M.door, dxx + 0.75 - _sl * Math.cos(_sa), 1.2 + 1.15, 25 - _sl * Math.sin(_sa), 0, g);\n" +
  "      lf1.rotation.y = _sa; lf2.rotation.y = -_sa;";
if (body.indexOf(SM_OLD) >= 0) { body = body.replace(SM_OLD, SM_NEW); openLog.push("序厅侧门双扇 90° 敞开 + 删暗腔"); }

/* 3) 北门楼（原型整扇关死，门洞被 6.4m 暗腔填满） */
const NG_OLD =
  "    box(6.4, 2.6, 0.3, M.ink, 0, 1.3, z, 0, g);\n" +
  "    var d1 = box(1.5, 2.5, 0.1, M.door, -0.78, 1.25, z + 0.35, 0, g);\n" +
  "    var d2 = box(1.5, 2.5, 0.1, M.door, 0.78, 1.25, z + 0.35, 0, g);";
const NG_NEW =
  "    /* 北门楼：删暗腔 + 双扇 90 度完全大敞开 */\n" +
  "    var _na = 1.5708, _nl = 0.72;\n" +
  "    var d1 = box(1.5, 2.5, 0.1, M.door, -1.53 + _nl * Math.cos(_na), 1.25, z + 0.35 + _nl * Math.sin(_na), 0, g);\n" +
  "    var d2 = box(1.5, 2.5, 0.1, M.door, 1.53 - _nl * Math.cos(_na), 1.25, z + 0.35 + _nl * Math.sin(_na), 0, g);\n" +
  "    d1.rotation.y = -_na; d2.rotation.y = _na;";
if (body.indexOf(NG_OLD) >= 0) { body = body.replace(NG_OLD, NG_NEW); openLog.push("北门楼双扇 90° 敞开 + 删暗腔"); }
console.log("全门敞开：" + (openLog.length ? openLog.join(" / ") : "未匹配到（原型结构变了？）"));
/* 书斋/茶室/文创/临摹 背墙立轴（组长补：把组员4 新增的 8 件展品落地成实画位）
   贴墙坐标按 buildHall 的实际墙体算：正房背墙中心 = x1-0.9-0.12（entry=W）/ x0+0.9+0.12（entry=E），
   立轴再向外让 0.14m，与画廊墙同一做法。seed 601~608 对应 8 件新展品。 */
const BC_ANCHOR = "      buildHall(hcx, cz, hh, d - 2.2, entry, null, opts);\n    }";
const BC_ADD = "      buildHall(hcx, cz, hh, d - 2.2, entry, null, opts);\n" +
  "    }\n" +
  "    /* 背墙立轴：书斋/茶室/文创/临摹 各 2 幅（面朝院内，画心中心 y=1.5） */\n" +
  "    var _sc = { '书斋': [601, 602], '茶室': [603, 604], '文创': [605, 606], '临摹': [607, 608] }[opts.tag];\n" +
  "    if (_sc) {\n" +
  "      var _fd = (entry === 'W') ? -1 : 1;\n" +
  "      var _bw = (entry === 'W') ? (x1 - 0.9 - 0.12) : (x0 + 0.9 + 0.12);\n" +
  "      var _si;\n" +
  "      for (_si = 0; _si < 2; _si++) hangingScroll(_bw + _fd * 0.14, cz + (_si ? 2.5 : -2.5), _fd, _sc[_si]);\n" +
  "    }";
if (body.indexOf(BC_ANCHOR) >= 0) { body = body.replace(BC_ANCHOR, BC_ADD); console.log("背墙立轴：书斋/茶室/文创/临摹 各 2 幅已挂"); }
else console.log("背墙立轴：未匹配到锚点（原型结构变了？）");

fs.writeFileSync(OUT, header + body + footer, 'utf8');
/* ---- 4. 抓 GLB 真模型替换逻辑（原型主控段的 upgradeParts）-> js/slots.js ---- */
const SLOTS_OUT = path.join(ROOT, 'js', 'slots.js');
const ui2 = html.indexOf('(function upgradeParts() {');
const uj2 = ui2 >= 0 ? html.indexOf('\n  })();', ui2) : -1;
let slotsNote = '未找到 upgradeParts';
if (ui2 >= 0 && uj2 > ui2) {
  let up = html.slice(ui2, uj2 + '\n  })();'.length);
  up = up.split('window.MuseumScene.slots').join('window.MuseumExteriorLayout.slots');
  up = up.replace("'assets/models/parts/' + id + '.glb'", "'assets/models/parts/opt/' + id + '.glb'");
  up = up.split('\n').map(l => '  ' + l).join('\n');
  const sHead = `/* ============================================================
 * GLB 真模型替换（由 scripts/vendor-prototype.mjs 自动同步自外观原型主控段）
 * 源文件：tools/exterior-prototype.html —— 请勿手改本文件
 * 作用：读 MuseumExteriorLayout.slots 登记表，把代码件替换成 assets/models/parts/opt/ 里的真模型；
 *       任何一件加载失败就保留代码件（渐进替换、失败回退）。原作者：Kimi
 * ============================================================ */
window.MuseumExteriorSlots = {
  install: function (scene) {
`;
  const sTail = `  }
};
`;
  fs.writeFileSync(SLOTS_OUT, sHead + up + '\n' + sTail, 'utf8');
  slotsNote = '已生成 js/slots.js（' + (sHead + up).split('\n').length + ' 行）';
} else {
  fs.writeFileSync(SLOTS_OUT, 'window.MuseumExteriorSlots = { install: function () {} };\n', 'utf8');
}
console.log(slotsNote);

const fnCount = (body.match(/^\s*function [A-Za-z0-9_]+\(/gm) || []).length;
console.log('已同步：' + VENDOR);
console.log('已生成：' + OUT + '  （' + (header + body + footer).split('\n').length + ' 行，' + fnCount + ' 个函数）');
console.log('光照块：' + (lights.indexOf('DirectionalLight') >= 0 ? '抓到（含太阳光 ' + lights.split('\n').length + ' 行）' : '⚠ 没抓到太阳光，退回兜底'));