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

/* ---- 3. 抓光照 ---- */
const li = html.indexOf('var sun = new THREE.DirectionalLight');
const lj = li >= 0 ? html.indexOf('scene.add(new THREE.HemisphereLight', li) : -1;
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

fs.writeFileSync(OUT, header + body + footer, 'utf8');
const fnCount = (body.match(/^\s*function [A-Za-z0-9_]+\(/gm) || []).length;
console.log('已同步：' + VENDOR);
console.log('已生成：' + OUT + '  （' + (header + body + footer).split('\n').length + ' 行，' + fnCount + ' 个函数）');
console.log('光照块：' + (li >= 0 ? '抓到' : '未找到，已用兜底'));