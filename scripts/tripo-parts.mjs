#!/usr/bin/env node
/**
 * 小零件独立建模资产流水线 · Tripo3D
 * ------------------------------------------------------------------
 * 与 aholo-parts.mjs 共用同一份清单，产出同一批文件，可互为备份：
 *   assets/models/parts/parts-manifest.json  →  assets/models/parts/<id>.glb
 *
 * 用法：
 *   node scripts/tripo-parts.mjs --balance              查余额
 *   node scripts/tripo-parts.mjs --list                 看清单与进度
 *   node scripts/tripo-parts.mjs --only camphor,bush    只做指定几件
 *   node scripts/tripo-parts.mjs --all                  做还没做的（已存在则跳过）
 *   node scripts/tripo-parts.mjs --all --force          已存在的也重做
 *
 * 环境变量：
 *   TRIPO_API_KEY   必填（platform.tripo3d.com → API Keys）
 *   TRIPO_BASE      可选，默认 https://api.tripo3d.com/v2/openapi
 *                   （注意：api.tripo3d.ai 在国内网络解析被劫持，用 .com 域名）
 *   TRIPO_MODEL     可选，默认 v2.5-20250123
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = path.join(ROOT, 'assets', 'models', 'parts');
const LEDGER = path.join(PARTS, '_tripo-ledger.json');
const MANIFEST = path.join(PARTS, 'parts-manifest.json');

const BASE = process.env.TRIPO_BASE || 'https://api.tripo3d.com/v2/openapi';
const MODEL = process.env.TRIPO_MODEL || 'v2.5-20250123';
const KEY = process.env.TRIPO_API_KEY;

const args = process.argv.slice(2);
const has = n => args.includes(n);
const valOf = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const manifest = JSON.parse(await fsp.readFile(MANIFEST, 'utf8'));

function api(pathname, opt) {
  if (!KEY) { console.error('缺少 TRIPO_API_KEY（platform.tripo3d.com → API Keys）'); process.exit(2); }
  return fetch(BASE + pathname, Object.assign({ headers: { Authorization: 'Bearer ' + KEY } }, opt || {}));
}
async function apiJson(pathname, opt) {
  const r = await api(pathname, opt);
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* 非 JSON */ }
  if (!r.ok || (j && j.code !== 0)) {
    const msg = (j && (j.message || j.suggestion)) || text.slice(0, 200);
    throw new Error(`HTTP ${r.status} · ${msg}`);
  }
  return j.data;
}

if (has('--balance')) {
  const d = await apiJson('/user/balance');
  console.log('Tripo 余额：', JSON.stringify(d));
  process.exit(0);
}

const have = new Set(fs.readdirSync(PARTS).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)));
let picked;
if (valOf('--only')) { const ids = valOf('--only').split(',').map(s => s.trim()); picked = manifest.parts.filter(p => ids.includes(p.id)); }
else picked = manifest.parts;

if (has('--list') || args.length === 0) {
  const todo = picked.filter(p => !have.has(p.id));
  console.log(`清单 ${manifest.parts.length} 件，已有模型 ${have.size} 件，待做 ${todo.length} 件`);
  picked.forEach(p => console.log(`  ${have.has(p.id) ? '✔' : ' '} ${p.id.padEnd(16)} ${p.name.padEnd(8)} ${p.refImage ? '参考图直出' : '文生3D  '} 面数 ${String(p.faceCount).padStart(6)}`));
  console.log('\n先查余额：node scripts/tripo-parts.mjs --balance');
  console.log('再批量做：node scripts/tripo-parts.mjs --all');
  process.exit(0);
}

const ledger = (() => { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { parts: {} }; } })();

/* 上传本地图片 → 拿 file_token（image/multiview 都要先上传） */
async function uploadImage(file) {
  const buf = await fsp.readFile(file);
  const ext = path.extname(file).slice(1).toLowerCase();
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png' }),
    'ref.' + (ext === 'jpg' ? 'jpg' : 'png'));
  const d = await apiJson('/upload', { method: 'POST', body: fd });
  const token = d.image_token || d.file_token;
  if (!token) throw new Error('上传返回里没有 image_token：' + JSON.stringify(d).slice(0, 200));
  return { token, type: (ext === 'jpg' || ext === 'jpeg') ? 'jpg' : 'png' };
}

async function createTask(part) {
  const body = { texture: true, pbr: true, model_version: MODEL };
  if (part.refImage) {
    /* 优先用四视图（正/左/背/右）做多视角重建；没有就用单张参考图 */
    const views = [1, 2, 3, 4].map(i => path.join(PARTS, 'raw', `${part.id}-view${i}.png`)).filter(p => fs.existsSync(p));
    if (views.length >= 4) {
      const files = [];
      for (const v of views) { const u = await uploadImage(v); files.push({ type: u.type, file_token: u.token }); }
      body.type = 'multiview_to_model';
      body.files = files;
      body.quad = false;
      return { taskId: (await apiJson('/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).task_id, mode: '多视角(4 视图)' };
    }
    const img = path.join(ROOT, part.refImage);
    if (!fs.existsSync(img)) throw new Error('参考图不存在：' + part.refImage);
    const u = await uploadImage(img);
    body.type = 'image_to_model';
    body.file = { type: u.type, file_token: u.token };
    return { taskId: (await apiJson('/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).task_id, mode: '单图参考' };
  }
  body.type = 'text_to_model';
  body.prompt = (part.prompt || part.name) + (manifest.style || '');
  return { taskId: (await apiJson('/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).task_id, mode: '文生3D' };
}

async function waitFor(taskId, onTick) {
  for (let i = 0; i < 240; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const d = await apiJson('/task/' + taskId);
    if (onTick) onTick(d);
    if (d.status === 'success') return d;
    if (d.status === 'failed' || d.status === 'banned' || d.status === 'cancelled' || d.status === 'expired') {
      throw new Error('任务终止：' + d.status + ' ' + JSON.stringify(d).slice(0, 200));
    }
  }
  throw new Error('轮询超时');
}

const force = has('--force');
let done = 0, ok = 0; const failed = [];
for (const part of picked) {
  const dest = path.join(PARTS, part.id + '.glb');
  if (have.has(part.id) && !force) { console.log(`[skip] ${part.id} 已有模型`); continue; }
  done++;
  const tag = `[${done}/${picked.length}] ${part.id} · ${part.name}`;
  try {
    const { taskId, mode } = await createTask(part);
    console.log(`${tag} → 提交 ${mode}（model_version=${MODEL}）`);
    const res = await waitFor(taskId, d => { if (d.progress !== undefined && d.progress % 25 === 0) process.stdout.write(`  ${d.progress}% `); });
    const out = res.output || {};
    const url = out.pbr_model || out.model || out.base_model;
    if (!url) throw new Error('返回里没有模型 URL：' + JSON.stringify(res).slice(0, 200));
    const r = await fetch(url);
    if (!r.ok) throw new Error('模型下载失败 ' + r.status);
    await fsp.writeFile(dest, Buffer.from(await r.arrayBuffer()));
    ledger.parts[part.id] = { taskId, mode, modelVersion: MODEL, bytes: fs.statSync(dest).size, at: new Date().toISOString(), raw: res };
    await fsp.writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    ok++;
    console.log(`${tag} ✔ ${(fs.statSync(dest).size / 1048576).toFixed(2)}MB`);
  } catch (e) {
    failed.push(part.id + ': ' + (e.message || e));
    console.error(`${tag} ✘ ${e.message || e}`);
  }
}

console.log(`\n完成 ${ok}/${done}，产物在 ${path.relative(ROOT, PARTS)}`);
if (failed.length) { console.log('失败：'); failed.forEach(f => console.log('  - ' + f)); process.exitCode = 1; }