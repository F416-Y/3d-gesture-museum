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
 * 默认源：本项目 tools/exterior-prototype.html；导入外部原型时必须显式传路径
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'tools', 'exterior-prototype.html');
const OUT = path.join(ROOT, 'js', 'exterior-layout.js');
const SRC = process.argv[2] || VENDOR;

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


/* 门扇口径：按当前项目定稿同步（正式展厅闭门，入口由弹窗进入）
   · 正式展厅使用 closedDoor + HALL_DOORS 登记；各院后门洞填暗腔
   · 序厅正门面南半开（原型 0.5rad）；挂匾正式院门半开（0.45rad），带抱鼓石
   · 北门楼闭扇（保留暗腔）
   沿革：2026-09-29 曾按"所有门大敞开"删过门扇与北门暗腔，现已全部改回。 */
console.log("门扇口径：正式展厅闭门并登记 HALL_DOORS（正门半开 / 挂匾院门半开 / 北门闭扇）");

/* 格扇窗挂钩：命中"朝院立面"时由我们自己的落地格扇窗接管 */
const WIN_OLD = "function addWindow(x, y, z, ry, parent) {";
const WIN_NEW = "function addWindow(x, y, z, ry, parent) {\n    if (window.MuseumWindows && window.MuseumWindows.replace(x, y, z, ry, (parent || S.scene))) return null;";
if (body.indexOf(WIN_OLD) >= 0) { body = body.replace(WIN_OLD, WIN_NEW); console.log("格扇窗挂钩：已插入 addWindow"); }
else console.log("格扇窗挂钩：未找到 addWindow");


/* 大门修正：只改匾额文案（门扇角度按新原型：正门面南半开，不再折大敞开） */
let gateLog = [];
if (body.indexOf("plaque('江南文人国画博物馆'") >= 0) {
  body = body.replace("plaque('江南文人国画博物馆'", "plaque('云间入墨'");
  gateLog.push("匾额改云间入墨");
}
console.log("大门修正：" + (gateLog.length ? gateLog.join(" / ") : "未匹配到"));


/* 大门美化（按参考图 前大门.png：朱红立柱 + 木门套 + 门槛 + 门环门钉） */
/* 大门美化（已移除）：组长 2026-09-29 反馈"那个门很土"——原来这里给正门加的
   朱红立柱 + 木门套 + 门槛 + 门钉门环 全部撤掉；正门改为敞口门洞（无门扇），
   保留原型自己的抱厦、匾额、抱鼓石与红灯笼。 */
/* 全门敞开（已废弃）：新原型自己已把门做成「展厅敞口 / 后门暗腔 / 北门闭扇 / 挂匾院门半开」，
   这段原来会把北门楼开成 90 度并删暗腔，与新定稿冲突，按 2026-09-29《原型改动清单》删除。 */
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
