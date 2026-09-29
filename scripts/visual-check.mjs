#!/usr/bin/env node
/**
 * 外观工作流 · 第 4 步：无头渲染出图 + 像素自检
 * ---------------------------------------------------------------
 * 做什么：把园区从指定机位渲染成 PNG，并对每张图算像素指标，
 *         在没有人工验收时快速抓出黑屏、平板墙、空场这类硬伤。
 * 不做评审：像素指标只能否掉明显错误，好不好看仍要拿参考图对照。
 *
 * 机位用自由相机（pos → target + fov），通过给 WebGLRenderer.render 打补丁实现，
 * 不改任何产品代码。
 *
 * 用法：node scripts/visual-check.mjs [输出目录]
 * 默认输出：tools/visual-check/  （每次覆盖）
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tools', 'visual-check'));
const ONLY = (process.argv[3] || '').trim();   /* 只渲染名字含该串的机位，调试用 */

/* 机位：立面机位走"中距 + 45° 视场"，保证石基(0~0.46) / 墙身 / 瓦压顶 /
 * 马头墙(至 5.7) 同时入画；人眼机位看真实尺度；鸟瞰看群体关系。 */
const SHOTS = [
  { name: '01-hall0-elevation', x: 0, y: 2.2, z: 43, tx: 0, ty: 2.4, tz: 34, fov: 45, note: '序厅正立面（前庭望北）' },
  { name: '01b-hall0-three-quarter', x: -12, y: 3.4, z: 41, tx: 0, ty: 2.6, tz: 29, fov: 45, note: '序厅 3/4 视角（含屋顶与山墙）' },
  { name: '02-gate-elevation', x: 0, y: 2.4, z: 36.5, tx: 0, ty: 2.6, tz: 42.2, fov: 50, note: '南门门楼正面' },
  { name: '03-hall1-elevation', x: -25, y: 2.2, z: 3, tx: -25, ty: 2.4, tz: -4, fov: 45, note: '山水厅 hall1 朝院立面' },
  { name: '04-hall2-elevation', x: 0, y: 2.2, z: 0, tx: 0, ty: 2.4, tz: -8, fov: 45, note: '花鸟厅 hall2 朝院立面' },
  { name: '05-hall3-elevation', x: 25, y: 2.2, z: 3, tx: 25, ty: 2.4, tz: -4, fov: 45, note: '人物厅 hall3 朝院立面' },
  { name: '06-hall4-court', x: 30, y: 3.2, z: 12.5, tx: 40.84, ty: 2.2, tz: 12.5, fov: 50, note: '书斋院朝东看正房（背墙两幅立轴）' },
  { name: '15-plan-top', x: 0, y: 115, z: 0.05, tx: 0, ty: 0, tz: 0, fov: 45, plan: true, scale: 1.5, note: '正上方俯视：全园区布局（开发过程图）' },
  { name: '16-plan-tilt', x: 0, y: 92, z: 58, tx: 0, ty: 0, tz: -2, fov: 45, plan: true, scale: 1.5, note: '高位斜俯视：全园区布局（带屋顶立体感）' },
  { name: '17-gate-front', x: 0, y: 2.0, z: 39.6, tx: 0, ty: 3.1, tz: 34.5, fov: 55, note: '序厅正门正面（看敞开效果与匾额）' },
  { name: '11-hall4-shuzhai-wall', x: 37.6, y: 1.9, z: 12.5, tx: 40.84, ty: 1.55, tz: 12.5, fov: 78, note: '书斋背墙两幅立轴（近景）' },
  { name: '12-hall4-chashi-wall', x: 37.6, y: 1.9, z: 26.5, tx: 40.84, ty: 1.55, tz: 26.5, fov: 78, note: '茶室背墙两幅立轴（近景）' },
  { name: '13-hall5-wenchuang-wall', x: -39.0, y: 1.9, z: 14.5, tx: -43.84, ty: 1.55, tz: 14.5, fov: 78, note: '文创背墙两幅立轴（近景）' },
  { name: '14-hall5-linmo-wall', x: -39.0, y: 1.9, z: 28.5, tx: -43.84, ty: 1.55, tz: 28.5, fov: 78, note: '临摹背墙两幅立轴（近景）' },
  { name: '07-hall5-court', x: -31, y: 3.2, z: 14.5, tx: -43.84, ty: 2.2, tz: 14.5, fov: 50, note: '文创院朝西看正房（背墙两幅立轴）' },
  { name: '08-courtyard-axis', x: 0, y: 1.62, z: 20.5, tx: 0, ty: 1.5, tz: -8, fov: 55, note: '人眼高度：庭院望花鸟厅' },
  { name: '09-outer-wall', x: -24, y: 1.62, z: 34, tx: -44, ty: 1.7, tz: 30, fov: 55, note: '人眼高度：西院墙' },
  { name: '10-aerial', x: 0, y: 46, z: 62, tx: 0, ty: 0, tz: 4, fov: 40, note: '鸟瞰：六厅与庭院总关系' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

/* 像素自检：把截图送回页面用 2D canvas 读像素（WebGL canvas 不能直接读回） */
async function measure(page, png, name) {
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  return page.evaluate(async ({ url, name }) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, dark = 0, mid = 0, light = 0, n = 0;
    const colors = new Set();
    const third = Math.floor(c.height / 3);
    let topWhite = 0, topN = 0, botWhite = 0, botN = 0;
    for (let i = 0; i < d.length; i += 28) {
      const p = i / 4, y = Math.floor(p / c.width);
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      sum += lum; n++;
      if (lum < 60) dark++; else if (lum > 195) light++; else mid++;
      colors.add(((r >> 4) << 8) | ((gg >> 4) << 4) | (b >> 4));
      if (y < third) { topN++; if (lum > 195) topWhite++; }
      if (y >= third * 2) { botN++; if (lum > 195) botWhite++; }
    }
    const pct = (a, b2) => Math.round((a / Math.max(1, b2)) * 1000) / 10;
    const meanLum = Math.round(sum / n);
    const flags = [];
    if (meanLum < 12 || colors.size < 10) flags.push('BLACK-SCREEN');
    if (colors.size < 40) flags.push('FLAT-IMAGE');
    if (pct(light, n) < 2) flags.push('NO-LIGHT-SURFACE');
    if (pct(dark, n) < 1) flags.push('NO-DARK-SURFACE');
    return {
      image: name, meanLum, colors: colors.size,
      darkPct: pct(dark, n), midPct: pct(mid, n), lightPct: pct(light, n),
      whiteTopPct: pct(topWhite, topN), whiteBottomPct: pct(botWhite, botN),
      flags,
    };
  }, { url: dataUrl, name });
}

async function launch() {
  const opts = [{ channel: 'msedge' }, { channel: 'chrome' }, {}];
  let lastErr;
  for (const o of opts) {
    try {
      return await chromium.launch({ ...o, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'] });
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const { server, port } = await startServer();
await fsp.mkdir(OUT, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const client = await page.context().newCDPSession(page);   /* 持续重绘下 page.screenshot 会超时，用 CDP 直捕 */
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });

console.log('外观自检：打开页面…');
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.MuseumPlayer && window.MuseumScene, null, { timeout: 240000 });
/* 等 GLB 零件模型加载替换完成（models.js 是异步的；等它彻底静下来再拍，否则截图会卡在"等画面稳定"） */
await page.waitForFunction(() => {
  const M = window.MuseumModels;
  if (!M) return true;
  const s = M.stats();
  return s.requested === s.ready + s.failed.length;
}, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);

/* 自由相机：只改工具，不动产品代码。
 * three 的 WebGLRenderer.render 是"实例方法"，原型补丁对它无效；
 * 改为给 PerspectiveCamera.prototype.updateMatrixWorld 打补丁——
 * 渲染前 three 必定调用它，在这里把相机摆到 __vizView 的位置/朝向/视场。 */
const hook = await page.evaluate(() => {
  const T = window.THREE;
  if (!T || !T.PerspectiveCamera) return 'no-three';
  const PC = T.PerspectiveCamera;
  if (PC.__vizPatched) return 'already';
  PC.__vizPatched = true;
  const orig = PC.prototype.updateMatrixWorld;
  PC.prototype.updateMatrixWorld = function (force) {
    const s = window.__vizView;
    if (s) {
      window.__vizCam = this;
      this.position.set(s.x, s.y, s.z);
      if (s.fov && this.fov !== s.fov) { this.fov = s.fov; this.updateProjectionMatrix(); }
      this.lookAt(s.tx, s.ty, s.tz);
    }
    return orig.call(this, force);
  };
  return 'patched';
});
console.log('相机钩子：' + hook);
/* 俯视图要提亮/关雾：three 的 render 是实例属性，原型打补丁无效；
   改为从相机沿 parent 往上找 Scene（渲染前 three 必定调用相机的 updateMatrixWorld，__vizCam 一定在） */
await page.waitForTimeout(400);
const sceneHook = await page.evaluate(() => {
  const c = window.__vizCam;
  if (!c) return 'no-cam';
  let s = c, hops = 0;
  while (s && !s.isScene && hops < 8) { s = s.parent; hops++; }
  if (s && s.isScene) { window.__vizScene = s; return 'ok（从相机上溯 ' + hops + ' 层）'; }
  return '未找到 scene（parent=' + (c.parent && c.parent.type) + '，上溯 ' + hops + ' 层）';
});
console.log('场景钩子：' + sceneHook);
if (hook !== 'patched' && hook !== 'already') { console.log('无法接管相机，机位不会生效'); process.exitCode = 1; }/* 只留 3D 画布：Vue 外壳与 HUD 全部隐藏，出图就是场景本身 */
await page.addStyleTag({ content: '*{visibility:hidden !important} canvas,canvas *{visibility:visible !important} html,body{background:#0b0a09 !important}' });
const canvasInfo = await page.evaluate(() => {
  const c = window.__vizCam || document.querySelector('canvas');
  const all = [...document.querySelectorAll('canvas')].map(el => { const r = el.getBoundingClientRect(); return { id: el.id, cls: el.className, w: Math.round(r.width), h: Math.round(r.height), disp: getComputedStyle(el).display }; });
  if (!c) return { found: false, all };
  const r = c.getBoundingClientRect();
  return { found: true, inDom: document.contains(c), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    attr: [c.width, c.height], parent: c.parentElement ? (c.parentElement.id || c.parentElement.className) : null,
    display: getComputedStyle(c).display, opacity: getComputedStyle(c).opacity, all };
});
console.log('画布诊断：' + JSON.stringify(canvasInfo));console.log('画布数：' + await page.evaluate(() => document.querySelectorAll('canvas').length) + ' 个 canvas');

const results = [];
const shots = ONLY ? SHOTS.filter(s => s.name.indexOf(ONLY) >= 0) : SHOTS;
for (const shot of shots) {
  /* 俯视机位临时关雾，保证平面看得清 */
  await page.evaluate(p => {
    const s = window.__vizScene; if (!s) return;
    if (p) { const T = window.THREE; if (!window.__vizState) { const L = []; s.traverse(o => { if (o.isLight) L.push([o, o.intensity]); }); window.__vizState = { lights: L, bg: s.background, fog: s.fog }; } const st = window.__vizState; st.lights.forEach(x => { x[0].intensity = x[1] * (x[0].isHemisphereLight ? 1.25 : 1.55); }); s.fog = null; s.background = new T.Color(0xf3f0ea); }
    else if (window.__vizState) { const st = window.__vizState; st.lights.forEach(x => { x[0].intensity = x[1]; }); s.fog = st.fog; s.background = st.bg; }
  }, !!shot.plan);
  await page.evaluate(s => { window.__vizView = s; }, shot);
  await page.waitForTimeout(280);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  /* 页面一直在重绘（rAF 循环 + 帧率自检），page.screenshot 会卡在“等待稳定”并超时，
     所以走 CDP 的 Page.captureScreenshot 直接抓一帧 */
  const clip = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  });
  const shotRes = await client.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: shot.scale || 1 },
  });
  const png = Buffer.from(shotRes.data, 'base64');
  await fsp.writeFile(path.join(OUT, shot.name + '.png'), png);
  const stat = await measure(page, png, shot.name);
  stat.note = shot.note;
  if (shot.plan) stat.flags = [];   /* 俯视图的明暗启发式不适用（画面以深色屋面+灰铺地为主） */
  stat.bytes = png.length;
  results.push(stat);
  const flag = stat.flags.length ? '  << ' + stat.flags.join(' ') : '';
  console.log(`[${results.length}/${shots.length}] ${shot.name}  亮度 ${stat.meanLum}  色数 ${stat.colors}  白 ${stat.lightPct}%  黑 ${stat.darkPct}%${flag}`);
}

await browser.close();
server.close();
await fsp.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), shots: results, pageErrors }, null, 2));

const bad = results.filter(r => r.flags.length);
console.log(`\n共 ${results.length} 张 → ${path.relative(ROOT, OUT)}`);
if (pageErrors.length) console.log(`页面错误 ${pageErrors.length} 条：\n  ` + pageErrors.slice(0, 5).join('\n  '));
if (bad.length) { console.log(`自检未过 ${bad.length} 张：` + bad.map(b => b.image).join(', ')); process.exitCode = 1; }
else console.log('像素自检通过：无黑屏、无平板墙、明暗面都有。');