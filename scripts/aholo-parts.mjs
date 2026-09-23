#!/usr/bin/env node
/**
 * 小零件独立建模资产流水线 · Aholo Lux3D
 * ------------------------------------------------------------------
 * 每个小零件走同一条链：文生图 → 图生 3D（GLB）→ 落盘到 assets/models/parts/
 * 清单：assets/models/parts/parts-manifest.json（id / 名字 / 生图提示词 / 面数 / 真实尺寸）
 *
 * 用法：
 *   node scripts/aholo-parts.mjs --list                 只看清单
 *   node scripts/aholo-parts.mjs --pilot                跑清单里的 pilot 三个（先验证再放量）
 *   node scripts/aholo-parts.mjs --only lantern,bamboo  指定若干个
 *   node scripts/aholo-parts.mjs --all                  全跑
 *   node scripts/aholo-parts.mjs --all --force          已存在的也重做
 *   node scripts/aholo-parts.mjs --inspect <taskId>     打印某个任务的原始返回（查字段用）
 *
 * 前置：AHOLO_API_KEY（https://labs.aholo3d.cn/api-keys）
 * 产物：assets/models/parts/<id>.png、<id>.glb、_generated.json（任务台账，含 taskId 与原始返回）
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS_DIR = path.join(ROOT, 'assets', 'models', 'parts');
const RAW_DIR = path.join(PARTS_DIR, 'raw');
const LEDGER = path.join(PARTS_DIR, '_generated.json');
const MANIFEST = path.join(PARTS_DIR, 'parts-manifest.json');

const args = process.argv.slice(2);
const has = n => args.includes(n);
const valOf = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

async function loadSdk() {
  const candidates = [
    process.env.AHOLO_SDK_DIR,
    path.join(os.tmpdir(), 'aholo-mcp', 'node_modules', '@manycore', 'aholo-sdk-lux3d', 'dist', 'index.js'),
    path.join(ROOT, 'node_modules', '@manycore', 'aholo-sdk-lux3d', 'dist', 'index.js'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return { mod: await import(pathToFileURL(c).href), from: c };
  }
  throw new Error('找不到 @manycore/aholo-sdk-lux3d。装到临时目录再跑：\n' +
    '  mkdir %TEMP%\\aholo-mcp && cd /d %TEMP%\\aholo-mcp && npm i @manycore/aholo-sdk-lux3d');
}

/** 递归收集返回体里的 URL（不同任务返回结构不完全一致，按后缀挑） */
function collectUrls(node, out = []) {
  if (!node) return out;
  if (typeof node === 'string') { if (/^https?:\/\//.test(node)) out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach(n => collectUrls(n, out)); return out; }
  if (typeof node === 'object') { Object.values(node).forEach(n => collectUrls(n, out)); }
  return out;
}
function pickUrl(result, exts) {
  const urls = [...new Set(collectUrls(result))];
  return urls.find(u => exts.some(e => u.split('?')[0].toLowerCase().endsWith(e))) || null;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(dest, buf);
  return buf.length;
}

function ledgerRead() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { note: 'Aholo Lux3D 小零件生成台账', parts: {} }; }
}
async function ledgerWrite(l) { await fsp.writeFile(LEDGER, JSON.stringify(l, null, 2) + '\n'); }

const manifest = JSON.parse(await fsp.readFile(MANIFEST, 'utf8'));
await fsp.mkdir(RAW_DIR, { recursive: true });

let picked;
if (has('--pilot')) picked = manifest.parts.filter(p => manifest.pilot.includes(p.id));
else if (valOf('--only')) { const ids = valOf('--only').split(',').map(s => s.trim()); picked = manifest.parts.filter(p => ids.includes(p.id)); }
else picked = manifest.parts;

if (has('--list') || args.length === 0) {
  console.log(`清单共 ${manifest.parts.length} 个零件（pilot：${manifest.pilot.join(', ')}）`);
  manifest.parts.forEach(p => console.log(`  ${manifest.pilot.includes(p.id) ? '★' : ' '} ${p.id.padEnd(16)} ${p.name.padEnd(8)} 面数 ${String(p.faceCount).padStart(6)}  → ${p.replaces}`));
  console.log('\n先跑试点：node scripts/aholo-parts.mjs --pilot');
  process.exit(0);
}

const apiKey = process.env.AHOLO_API_KEY;
if (!apiKey) {
  console.error('缺少 AHOLO_API_KEY。到 https://labs.aholo3d.cn/api-keys 申请后：\n' +
    '  $env:AHOLO_API_KEY="你的key"; node scripts/aholo-parts.mjs --pilot');
  process.exit(2);
}

const { mod: sdk, from } = await loadSdk();
console.log('SDK：' + from);
const lux = sdk.createLux3dClient({ apiKey, region: 'cn' });

if (valOf('--inspect')) {
  const r = await lux.tasks.retrieve(valOf('--inspect'));
  console.log(JSON.stringify(r, null, 2));
  console.log('URL 候选：', [...new Set(collectUrls(r))]);
  process.exit(0);
}

const ledger = ledgerRead();
const force = has('--force');
const style = manifest.style;
let done = 0, failed = [];

for (const part of picked) {
  const glbPath = path.join(PARTS_DIR, part.id + '.glb');
  if (fs.existsSync(glbPath) && !force) {
    console.log(`[skip] ${part.id} 已有模型（--force 可重做）`);
    continue;
  }
  const tag = `[${++done}/${picked.length}] ${part.id} · ${part.name}`;
  try {
    console.log(`${tag} → 文生图…`);
    const imgTask = await lux.multimodalToImage.create({ prompt: `${part.prompt}${style}` });
    const imgRes = await lux.tasks.waitFor(imgTask);
    const imgUrl = pickUrl(imgRes, ['.png', '.jpg', '.jpeg', '.webp']);
    if (!imgUrl) throw new Error('生图任务返回里找不到图片 URL：' + JSON.stringify(imgRes).slice(0, 300));
    const rawPath = path.join(RAW_DIR, part.id + '.png');
    const imgBytes = await download(imgUrl, rawPath);
    console.log(`${tag} → 图生 3D（G1-Turbo · ${part.faceCount} 面 · GLB+PBR）…`);

    const meshTask = await lux.imgTo3d.createFromFile(rawPath, {
      version: 'G1-Turbo', outputFormat: ['glb'], faceCount: part.faceCount,
      aiPredictSize: true, enablePbr: true,
    });
    const meshRes = await lux.tasks.waitFor(meshTask);
    const glbUrl = pickUrl(meshRes, ['.glb']);
    if (!glbUrl) throw new Error('图生3D 返回里找不到 GLB URL：' + JSON.stringify(meshRes).slice(0, 300));
    const glbBytes = await download(glbUrl, glbPath);

    ledger.parts[part.id] = {
      name: part.name, replaces: part.replaces, sizeM: part.sizeM, faceCount: part.faceCount,
      imageTaskId: imgTask, meshTaskId: meshTask, imageBytes: imgBytes, glbBytes,
      imageUrl: imgUrl, glbUrl, at: new Date().toISOString(), raw: { image: imgRes, mesh: meshRes },
    };
    await ledgerWrite(ledger);
    console.log(`${tag} ✔ 生图 ${(imgBytes / 1024).toFixed(0)}KB → 模型 ${(glbBytes / 1024 / 1024).toFixed(2)}MB`);
  } catch (e) {
    failed.push(part.id);
    console.error(`${tag} ✘ ${e && e.message ? e.message : e}`);
  }
}

console.log(`\n完成 ${done - failed.length}/${done}，产物在 ${path.relative(ROOT, PARTS_DIR)}`);
if (failed.length) { console.log('失败：' + failed.join(', ')); process.exitCode = 1; }