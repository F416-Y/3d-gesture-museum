#!/usr/bin/env node
/**
 * 零件资产验货：压缩 + 用项目同款 three r147 真实加载 + 出图
 * -------------------------------------------------------------
 * 对 assets/models/parts/<id>.glb：
 *   1. gltf-transform 压缩到 opt/<id>.glb（贴图降采样 + 量化）
 *   2. 用 tools/parts-preview.html（three r147 UMD + GLTFLoader）加载并截图
 * 用法：node scripts/parts-check.mjs [--only id1,id2] [--size 1024]
 * 依赖：gltf-transform 在 %TEMP%\gltf-tools（脚本会自动调用 npx）
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = path.join(ROOT, 'assets', 'models', 'parts');
const OPT = path.join(PARTS, 'opt');
const SHOTS = path.join(ROOT, 'tools', 'visual-check', 'parts');
const GLTF_TOOLS = path.join(os.tmpdir(), 'gltf-tools');

const args = process.argv.slice(2);
const only = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1].split(',').map(s => s.trim()) : null; })();
const texSize = (() => { const i = args.indexOf('--size'); return i >= 0 ? args[i + 1] : '1024'; })();

await fsp.mkdir(OPT, { recursive: true });
await fsp.mkdir(SHOTS, { recursive: true });

const ids = (only || fs.readdirSync(PARTS).filter(n => n.endsWith('.glb')).map(n => n.replace(/\.glb$/, '')));
console.log(`验货 ${ids.length} 件：${ids.join(', ')}\n`);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e.message || e)));

for (const id of ids) {
  const raw = path.join(PARTS, id + '.glb');
  const opt = path.join(OPT, id + '.glb');
  if (!fs.existsSync(raw)) { console.log(`[skip] ${id} 没有原始 glb`); continue; }
  try {
    const cli = path.join(GLTF_TOOLS, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
    execFileSync(process.execPath, [cli, 'optimize', raw, opt, '--compress', 'quantize',
      '--texture-compress', 'webp', '--texture-size', texSize], { stdio: 'pipe' });
  } catch (e) { console.log(`[warn] ${id} 压缩失败，直接用原始文件`); }

  const use = fs.existsSync(opt) ? opt : raw;
  const a = fs.statSync(raw).size, b = fs.statSync(use).size;
  await page.goto(`http://127.0.0.1:${port}/tools/parts-preview.html?m=${encodeURIComponent(path.relative(path.join(ROOT, 'tools'), use))}`,
    { waitUntil: 'load', timeout: 60000 });
  let info = '超时';
  try {
    await page.waitForFunction(() => window.__glbReady, null, { timeout: 60000 });
    const r = await page.evaluate(() => window.__glbReady);
    info = r.ok ? `尺寸 ${r.size.map(v => v.toFixed(2)).join(' × ')} m` : '失败 ' + r.error;
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, id + '.png') });
  } catch { /* 保留超时 */ }
  console.log(`${id.padEnd(14)} ${(a / 1048576).toFixed(2)}MB → ${(b / 1048576).toFixed(2)}MB  加载 ${info}`);
}

console.log('\n截图目录：' + path.relative(ROOT, SHOTS));
if (errs.length) console.log('页面错误：' + errs.slice(0, 3).join(' | '));
await browser.close();
server.close();