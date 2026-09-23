#!/usr/bin/env node
/**
 * 从 js/exterior-layout.js（外观原型布局）提取各建筑的坐标，生成
 *   docs/外观原型-坐标对接表.md    —— 给组员1 登记碰撞体 / 热点 / 区域判定
 *   tools/layout-coords.json       —— 同一批数据的机器可读版
 * 规则（来自原型的 buildCourtComplex / buildHall）：
 *   院落式：院墙矩形 = (cx±w/2, cz±d/2)；门洞开在 entry 边，洞口宽 gateW+1.4；
 *           backdoor 时对边留 1.8m 后门；wallH 为院墙高。
 *   单体式：台基 = (w+2.4) × (d+2.4)，高 0.5；柱网间距 ≈3.1m，墙高 3.25。
 * 用法：node scripts/extract-layout-coords.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'js', 'exterior-layout.js');
const src = fs.readFileSync(SRC, 'utf8');

/* 只取调用点，跳过函数定义 */
function calls(name) {
  const re = new RegExp('(?<!function )\\b' + name + '\\s*\\(([^;]*?)\\)\\s*;', 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const argStr = m[1];
    if (/^\s*(cx|side|px)\b/.test(argStr)) continue;      // 定义体里的内部调用
    out.push(argStr);
  }
  return out;
}
function num(s, i) { const m = s.split(',').map(t => t.trim()); return m[i]; }
function pick(s, key, def) {
  const m = s.match(new RegExp(key + "\\s*:\\s*([0-9.]+|true|false|'[A-Z]')"));
  return m ? m[1] : def;
}

const rows = [];
for (const a of calls('buildCourtComplex')) {
  const cx = parseFloat(num(a, 0)), cz = parseFloat(num(a, 1));
  const w = parseFloat(num(a, 2)), d = parseFloat(num(a, 3));
  if ([cx, cz, w, d].some(v => Number.isNaN(v))) continue;
  const em = a.match(/,\s*'([NSEW])'\s*,\s*'([^']*)'/);
  const entry = em ? em[1] : '?';
  const label = em ? em[2] : '';
  const wallH = pick(a, 'wallH', '2.8');
  const gateW = parseFloat(pick(a, 'gateW', '3.0'));
  const hallD = pick(a, 'hallD', '');
  const backdoor = /backdoor\s*:\s*true/.test(a);
  rows.push({
    kind: '院落式', label, cx, cz, w, d, entry,
    x0: +(cx - w / 2).toFixed(2), x1: +(cx + w / 2).toFixed(2),
    z0: +(cz - d / 2).toFixed(2), z1: +(cz + d / 2).toFixed(2),
    wallH: parseFloat(wallH), gateOpen: +(gateW + 1.4).toFixed(2), hallD, backdoor,
  });
}
for (const a of calls('buildHall')) {
  const cx = parseFloat(num(a, 0)), cz = parseFloat(num(a, 1));
  const w = parseFloat(num(a, 2)), d = parseFloat(num(a, 3));
  if ([cx, cz, w, d].some(v => Number.isNaN(v))) continue;
  const em = a.match(/,\s*'([NSEW])'\s*,\s*'([^']*)'/);
  const entry = em ? em[1] : '?';
  const label = em ? em[2] : '';
  rows.push({
    kind: '单体式', label, cx, cz, w, d, entry,
    x0: +(cx - (w + 2.4) / 2).toFixed(2), x1: +(cx + (w + 2.4) / 2).toFixed(2),
    z0: +(cz - (d + 2.4) / 2).toFixed(2), z1: +(cz + (d + 2.4) / 2).toFixed(2),
    wallH: 3.25, gateOpen: 3.1, hallD: '', backdoor: /backdoor\s*:\s*true/.test(a),
  });
}
rows.sort((a, b) => (a.cz - b.cz) || (a.cx - b.cx));

const L = [];
L.push('# 外观原型 · 坐标对接表（给组员1）', '');
L.push('> 数据来源：`js/exterior-layout.js`（外观原型整块移植，原作者 Kimi）');
L.push('> 生成脚本：`node scripts/extract-layout-coords.mjs`（改布局后重跑即可）', '');
L.push('**坐标系**：1 单位 = 1 米；x 向东为正，z 向南为正（北 = −z）；总平面 100 × 80，即 x ∈ [−50, 50]、z ∈ [−40, 40]。');
L.push('**院墙规则**：院落式的院墙矩形就是 `(cx±w/2, cz±d/2)`；门洞开在 `入口` 那一边，洞口宽 = gateW+1.4。', '');
L.push('| 名称 | 形式 | 中心 (x, z) | 面阔 × 进深 | 院墙/台基范围 x | z | 入口 | 洞口宽 | 院墙高 | 后门 |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  L.push(`| ${r.label || '(无匾)'} | ${r.kind} | ${r.cx}, ${r.cz} | ${r.w} × ${r.d} | ${r.x0} ~ ${r.x1} | ${r.z0} ~ ${r.z1} | ${r.entry} | ${r.gateOpen} m | ${r.wallH} m | ${r.backdoor ? '有' : '—'} |`);
}
L.push('', '## 我（外观）暂定的 8 个展厅区域判定', '');
L.push('代码位置：`js/scene.js` 的 `init()` 里 `if (useProtoLayout) { Object.assign(hallRegions, {...}) }`。**这份是暂定值，请组员1 按上表核对/替换。**', '');
L.push('| id | 含义 | 矩形 x | z | 备注 |');
L.push('|---|---|---|---|---|');
const regions = [
  ['plaza', '南入口前庭', '-26 ~ 26', '34 ~ 41', '六级大台阶 + 石狮区'],
  ['hall0', '序厅', '-11 ~ 11', '24.5 ~ 34.5', '高台基 22×10'],
  ['courtyard', '中轴庭院带', '-9 ~ 9', '-20 ~ 24.5', '轴线庭 + 水榭庭 + 中心庭'],
  ['hall1', '山水画展区', '-46 ~ -28.5', '-20 ~ -5', '院落 17.5×15，入口朝东'],
  ['hall2', '花鸟画展区', '-11 ~ 11', '-37.5 ~ -21', '院落 22×16.5，入口朝南，重檐'],
  ['hall3', '人物画展区', '28 ~ 45.5', '-21 ~ -10', '院落 17.5×11，入口朝南'],
  ['hall4', '书斋 · 茶室', '34 ~ 42', '6 ~ 19', '两个 8×13 小院'],
  ['hall5', '文创 · 临摹', '-45 ~ -34', '8 ~ 21', '两个 11×13 小院'],
];
for (const r of regions) L.push(`| \`${r[0]}\` | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`);
L.push('', '## 交给组员1 的三件事', '');
L.push('1. **碰撞体**：新布局 `obstacles` 现在是 **0 个**（原型不提供），玩家能穿过所有院墙和建筑。按上表逐栋登记，门洞处留空。参考写法：旧代码 `buildPartZoneWall()` 里"按门洞把墙切成多段登记"那段。');
L.push('2. **展品热点**：`spotMeshes` 现在也是 **0 个**。原型的场馆还没有展品落位，需要和组员4 的 `config.js` 展品表对齐后逐个登记。');
L.push('3. **区域判定**：核对上面那份 8 个区域，尤其是中轴庭院带（跨越了轴线庭/水榭庭/中心庭三个庭院）。');
L.push('');
L.push('## 还没被覆盖的原型场馆', '');
const extra = ['雅集', '景韵', '兰竹', '临摹', '茶室', '水榭庭院', '荷池庭院', '山石庭院', '兰竹庭院', '景观庭院'];
L.push('原型里这些场馆在建，但 `config.js` 的 8 个展厅里没有对应 id：' + extra.join('、') + '。');
L.push('要么补 id（组员4 改 config），要么把它们并入相邻展厅——**需要组长定**。');
L.push('');
fs.writeFileSync(path.join(ROOT, 'docs', '外观原型-坐标对接表.md'), L.join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'tools', 'layout-coords.json'), JSON.stringify({ note: '外观原型坐标（由 scripts/extract-layout-coords.mjs 生成）', rows, regions }, null, 2) + '\n');
console.log('已写 docs/外观原型-坐标对接表.md 与 tools/layout-coords.json');
console.log('提取到 ' + rows.length + ' 个建筑/院落：' + rows.map(r => r.label).filter(Boolean).join('、'));