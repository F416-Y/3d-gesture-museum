#!/usr/bin/env node
/**
 * 从 Tripo3D Studio 链接抓模型（不需要 API Key）
 * ------------------------------------------------------------------
 * 用法：node scripts/tripo-fetch.mjs <studio链接> [目标id]
 * 做什么：
 *   1. 打开 studio 页面，从 HTML 里提取该资源目录下的模型文件
 *   2. 优先取 GLB；只有 FBX 时明确报出来（我们这边没有 FBX 转换器）
 *   3. GLB 若是 meshopt 压缩，自动转成 r147 可加载的格式（quantize + WebP）
 *   4. 落盘到 assets/models/parts/opt/<id>.glb，并打印三角面/体积
 * 说明：auth_key 是按路径签的，所以只能用它页面里给出的那几个链接。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = path.join(ROOT, 'assets', 'models', 'parts');
const OUT = path.join(PARTS, 'opt');
const DL = path.join(PARTS, '_tripo');
const CLI = path.join(os.tmpdir(), 'gltf-tools', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

const url = process.argv[2];
const id = process.argv[3] || 'tripo-model';
if (!url) { console.error('用法：node scripts/tripo-fetch.mjs <studio链接> [目标id]'); process.exit(2); }

const page = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const all = [...new Set([...page.matchAll(/https:\/\/[^"'\s<>\\]+/gi)].map(m => m[0]))];
const models = all.filter(u => /\.(glb|gltf|fbx|obj|usdz)(\?|$)/i.test(u));
console.log('页面里找到的模型文件：');
models.forEach(u => console.log('  ' + u.split('?')[0].split('/').pop()));
let glb = models.find(u => /\.glb(\?|$)/i.test(u) && !/point_cloud/i.test(u));
const fbx = models.find(u => /\.fbx(\?|$)/i.test(u));
let rawPath;
await fsp.mkdir(DL, { recursive: true });
if (glb) {
  console.log('\n✅ 取 GLB：' + glb.split('/').pop().slice(0, 70));
  const buf = Buffer.from(await (await fetch(glb)).arrayBuffer());
  rawPath = path.join(DL, id + '-src.glb');
  await fsp.writeFile(rawPath, buf);
} else if (fbx) {
  /* 只有 FBX（Tripo 未导出 GLB 时就是这样）：用本机 FBX2glTF 现场转 */
  const exe = path.join(os.tmpdir(), 'fbx-tools', 'node_modules', 'fbx2gltf', 'bin', 'Windows_NT', 'FBX2glTF.exe');
  if (!fs.existsSync(exe)) {
    console.log('\n❌ 只有 FBX，且本机没有 FBX2glTF。装一个：npm i fbx2gltf（装到 %TEMP%\\fbx-tools）');
    process.exit(1);
  }
  console.log('\n⚠️  只有 FBX，用本机 FBX2glTF 现场转 GLB…');
  const buf = Buffer.from(await (await fetch(fbx)).arrayBuffer());
  const fbxPath = path.join(DL, id + '.fbx');
  await fsp.writeFile(fbxPath, buf);
  rawPath = path.join(DL, id + '.glb');
  execFileSync(exe, ['--binary', '-i', fbxPath, '-o', path.join(DL, id)], { stdio: 'inherit' });
  if (!fs.existsSync(rawPath)) { console.log('❌ FBX 转换失败'); process.exit(1); }
} else {
  console.log('\n❌ 该页面没有模型文件。');
  process.exit(1);
}
const buf = await fsp.readFile(rawPath);
const j = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
let tris = 0; (j.meshes || []).forEach(m => m.primitives.forEach(p => { if (p.indices != null) tris += j.accessors[p.indices].count / 3; }));
console.log(`源文件 ${(buf.length/1048576).toFixed(2)} MB | 三角面 ${Math.round(tris)} | 扩展 ${(j.extensionsUsed||[]).join(', ') || '无'}`);

await fsp.mkdir(OUT, { recursive: true });
const outGlb = path.join(OUT, id + '.glb');
const ext = (j.extensionsUsed || []);
const needSimplify = tris > 120000;
const tmp = path.join(DL, id + '-tmp.glb');
let src = rawPath;
if (needSimplify) {
  console.log('面数偏高，先 weld + simplify…');
  execFileSync(process.execPath, [CLI, 'weld', src, tmp], { stdio: 'inherit' });
  execFileSync(process.execPath, [CLI, 'simplify', tmp, tmp + '.2.glb', '--ratio', '0.2', '--error', '0.01'], { stdio: 'inherit' });
  src = tmp + '.2.glb';
}
execFileSync(process.execPath, [CLI, 'optimize', src, outGlb,
  '--compress', 'quantize', '--texture-compress', 'webp', '--texture-size', '1024'], { stdio: 'inherit' });
const ob = await fsp.readFile(outGlb);
const oj = JSON.parse(ob.toString('utf8', 20, 20 + ob.readUInt32LE(12)));
let ot = 0; (oj.meshes || []).forEach(m => m.primitives.forEach(p => { if (p.indices != null) ot += oj.accessors[p.indices].count / 3; }));
console.log(`\n成品 opt/${id}.glb  ${(ob.length/1048576).toFixed(2)} MB | 三角面 ${Math.round(ot)} | 扩展 ${(oj.extensionsUsed||[]).join(', ')}`);