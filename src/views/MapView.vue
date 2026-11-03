<template>
  <div class="overlay-page map-page">
    <section class="map-card" aria-labelledby="map-title">
      <header class="map-header">
        <div>
          <p class="eyebrow">CLOUDINK CAMPUS · SITE PLAN</p>
          <h2 id="map-title">云间入墨 · 园区平面图</h2>
          <p class="map-hint">按实际外景坐标绘制 · 上方为北 · 沿小路到门口后点击展厅</p>
        </div>
        <div class="map-status"><span class="status-dot"></span> 实景坐标版</div>
      </header>

      <div class="map-stage">
        <svg class="map-svg" viewBox="0 0 1000 820" role="img" aria-label="云间入墨园区实际坐标平面图">
          <defs>
            <pattern id="paper-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#d9cdbb" stroke-width="0.7" opacity=".28" />
            </pattern>
            <pattern id="courtyard-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#c1cbb4" stroke-width=".8" opacity=".34" />
            </pattern>
            <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#3d3027" flood-opacity=".18" />
            </filter>
          </defs>

          <rect x="0" y="0" width="1000" height="820" rx="18" fill="#f6f0e6" />
          <rect x="18" y="18" width="964" height="784" rx="14" fill="url(#paper-grid)" stroke="#cbbda9" stroke-width="2" />

          <!-- 实际外包络：x ±50、z ±40 -->
          <rect :x="toX(-50)" :y="toY(-40)" :width="toX(50) - toX(-50)" :height="toY(40) - toY(-40)"
                fill="#eee5d7" fill-opacity=".58" stroke="#6d5747" stroke-width="8" />
          <rect :x="toX(-47.5)" :y="toY(-37.5)" :width="toX(47.5) - toX(-47.5)" :height="toY(37.5) - toY(-37.5)"
                fill="none" stroke="#b89b79" stroke-width="2" stroke-dasharray="7 7" opacity=".8" />

          <!-- 实际模型中的铺装道路：对应 exterior-layout.js 的 pave() 调用 -->
          <g class="hardscape" aria-label="实际铺装道路">
            <rect v-for="p in paving" :key="p.id" :x="toX(p.x0)" :y="toY(p.z0)"
                  :width="(p.x1 - p.x0) * SCALE" :height="(p.z1 - p.z0) * SCALE"
                  class="paving-zone" />
          </g>
          <path :d="axisPath" fill="none" stroke="#b59d7b" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 12" opacity=".72" />

          <!-- 按建筑入口方向连接到门口的小路 -->
          <g class="access-routes" aria-label="展厅入口道路">
            <path v-for="r in routes" :key="r.id" :d="routeD(r)" class="route-base" />
            <path v-for="r in routes" :key="`${r.id}-center`" :d="routeD(r)" class="route-center" />
            <g v-for="r in routes" :key="`${r.id}-door`" class="door-marker">
              <circle :cx="toX(r.x1)" :cy="toY(r.z1)" r="5" />
              <text :x="toX(r.x1)" :y="toY(r.z1) - 9" text-anchor="middle">门</text>
            </g>
          </g>

          <!-- 中心湖：中心 (0,-2.2)，约 32×16m -->
          <ellipse :cx="toX(0)" :cy="toY(-2.2)" :rx="16 * SCALE" :ry="8 * SCALE"
                   fill="#638f87" fill-opacity=".94" stroke="#365e59" stroke-width="3" filter="url(#soft-shadow)" />
          <ellipse :cx="toX(0)" :cy="toY(-2.2)" :rx="14.4 * SCALE" :ry="6.7 * SCALE"
                   fill="none" stroke="#b7d4c4" stroke-width="2" stroke-dasharray="5 8" opacity=".72" />
          <text :x="toX(0)" :y="toY(-2.2) + 4" text-anchor="middle" class="water-label">中心湖 · 32 × 16m</text>

          <!-- 中轴拱桥：约 16m × 2.2m，南北向 -->
          <g class="bridge-mark" aria-label="中轴拱桥，长约16米，宽约2.2米">
            <rect :x="toX(-1.1)" :y="toY(-10.2)" :width="2.2 * SCALE" :height="16 * SCALE" rx="8"
                  fill="#d8c29e" stroke="#7e6249" stroke-width="2.5" />
            <path :d="bridgeRailLeft" fill="none" stroke="#a48763" stroke-width="2" />
            <path :d="bridgeRailRight" fill="none" stroke="#a48763" stroke-width="2" />
            <path :d="bridgeSteps" fill="none" stroke="#f2e4c8" stroke-width="1.3" stroke-dasharray="4 5" />
          </g>

          <!-- 展厅热区 -->
          <g v-for="h in halls" :key="h.id" class="hall-zone" :class="{ clickable: h.interior, 'outline-only': h.outlineOnly }"
             :role="h.interior ? 'button' : undefined" :tabindex="h.interior ? 0 : undefined"
             :aria-label="h.interior ? `进入${h.name}展厅` : h.underConstruction ? `${h.name}展厅，云墨修缮中` : h.name"
             @click="h.interior && openInterior(h.id)"
             @keydown.enter="h.interior && openInterior(h.id)">
            <rect :x="toX(h.x0)" :y="toY(h.z0)" :width="(h.x1 - h.x0) * SCALE" :height="(h.z1 - h.z0) * SCALE"
                  :fill="h.outlineOnly ? 'none' : h.fill" :stroke="h.interior ? '#704335' : '#917d68'" :stroke-width="h.interior ? 3 : 2" rx="7" />
            <path :d="roofMark(h)" fill="none" stroke="#8c7157" stroke-width="2" opacity=".75" />
            <text :x="toX((h.x0 + h.x1) / 2)" :y="toY((h.z0 + h.z1) / 2) + 5" text-anchor="middle" class="hall-label">{{ h.name }}</text>
            <text v-if="h.interior" :x="toX((h.x0 + h.x1) / 2)" :y="toY((h.z0 + h.z1) / 2) + 22" text-anchor="middle" class="hall-sub">点击进入</text>
            <text v-else-if="h.underConstruction" :x="toX((h.x0 + h.x1) / 2)" :y="toY((h.z0 + h.z1) / 2) + 22" text-anchor="middle" class="hall-closed">云墨修缮中</text>
          </g>

          <!-- 装饰景观区域 -->
          <g v-for="c in courts" :key="c.id" class="court-zone">
            <rect :x="toX(c.x0)" :y="toY(c.z0)" :width="(c.x1 - c.x0) * SCALE" :height="(c.z1 - c.z0) * SCALE"
                  fill="#cbd4be" fill-opacity=".46" stroke="#9ba58d" stroke-width="1.5" stroke-dasharray="4 5" rx="5" />
          </g>

          <g class="north-arrow" transform="translate(914 76)">
            <text x="0" y="-22" text-anchor="middle">N</text>
            <path d="M0,-12 L8,10 L0,5 L-8,10 Z" fill="#a3362b" />
            <circle cx="0" cy="10" r="2.5" fill="#5e4639" />
          </g>
          <g class="scale-bar" transform="translate(70 756)">
            <path d="M0 0H92 M0 -5V5 M46 -5V5 M92 -5V5" stroke="#604d3c" stroke-width="2" />
            <text x="0" y="22">0</text><text x="42" y="22">5m</text><text x="84" y="22">10m</text>
          </g>
          <text x="500" y="786" text-anchor="middle" class="south-label">南入口 · 前庭</text>
          <circle :cx="playerSvg.x" :cy="playerSvg.y" r="7" class="player-dot" />
          <circle :cx="playerSvg.x" :cy="playerSvg.y" r="13" class="player-ring" />
        </svg>
        <aside class="map-legend" aria-label="图例">
          <div><span class="legend-swatch hall-swatch"></span>可进入展厅</div>
          <div><span class="legend-swatch closed-swatch"></span>云墨修缮中</div>
          <div><span class="legend-swatch court-swatch"></span>庭院 / 景观</div>
          <div><span class="legend-swatch lake-swatch"></span>中心湖</div>
          <div><span class="legend-dot"></span>当前位置</div>
        </aside>
      </div>
      <RouterLink class="back-link" to="/">← 返回博物馆</RouterLink>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const MAP = { minX: -50, minZ: -40, scale: 9.2, offsetX: 40, offsetY: 32 };
const SCALE = MAP.scale;
function toX(v) { return MAP.offsetX + (v - MAP.minX) * SCALE; }
function toY(v) { return MAP.offsetY + (v - MAP.minZ) * SCALE; }

const halls = [
  // 以下占地直接对应 exterior-layout.js 中 buildCourtComplex(cx, cz, w, d)。
  { id: "hall1", name: "山水", x0: -50, z0: -20, x1: -28.5, z1: -5, fill: "#e7d4b5", interior: true },
  { id: "hall2", name: "花鸟", x0: -11, z0: -37.5, x1: 11, z1: -21, fill: "#e7d4b5", interior: true },
  { id: "hall3", name: "人物", x0: 28, z0: -21, x1: 49.5, z1: -10, fill: "#e7d4b5", interior: true },
  { id: "hall5", name: "文创雅集馆", x0: -49, z0: 8, x1: -34, z1: 35, fill: "#d8c7b2", interior: false, underConstruction: true },
  { id: "hall4", name: "书斋", x0: 34, z0: 6, x1: 46, z1: 33, fill: "#d8c7b2", interior: false, underConstruction: true },
  { id: "hall0", name: "序厅", x0: -11.25, z0: 24.5, x1: 11.25, z1: 34.5, fill: "#d6c19f", interior: false },
  { id: "courtyard", name: "中心庭院", x0: -18, z0: -20, x1: 18, z1: 24.5, fill: "#dce4d2", interior: false, outlineOnly: true },
  { id: "plaza", name: "前庭", x0: -16, z0: 34.5, x1: 16, z1: 36.8, fill: "#d9d0bd", interior: false },
];

const paving = [
  { id: "front-plaza", x0: -16, z0: 34.5, x1: 16, z1: 36.8 },
  { id: "hall0-apron", x0: -13.5, z0: 22.5, x1: 13.5, z1: 34.5 },
  { id: "south-axis", x0: -9.5, z0: 7.5, x1: 9.5, z1: 22.4 },
  { id: "east-garden-path", x0: 12.2, z0: 23.5, x1: 36, z1: 29 },
  { id: "west-garden-path", x0: -36, z0: 26, x1: -12.2, z1: 30.5 },
  { id: "north-axis", x0: -9.5, z0: -21, x1: 9.5, z1: -5.5 },
  { id: "west-gallery-path", x0: -29, z0: -15, x1: -9.5, z1: -10 },
  { id: "east-gallery-path", x0: 9.5, z0: -18.5, x1: 29, z1: -13.5 },
];

const courts = [
  { id: "jingyun", x0: 33, z0: -34.75, x1: 45, z1: -25.25 },
  { id: "yaji", x0: -44, z0: -33, x1: -32, z1: -26 },
  { id: "lanzhu", x0: 30, z0: 2.9, x1: 36, z1: 5.9 },
];

// 门口坐标取各建筑朝向庭院/主路的一侧；每条路都以门口为终点。
const routes = [
  { id: "hall1-route", x0: -9.5, z0: -12.5, x1: -28.5, z1: -12.5 },
  { id: "hall2-route", x0: 0, z0: -5.5, x1: 0, z1: -21 },
  { id: "hall3-route", x0: 9.5, z0: -16, x1: 28, z1: -16 },
  { id: "hall0-route", x0: 0, z0: 22.4, x1: 0, z1: 22.5 },
  { id: "plaza-route", x0: 0, z0: 36.8, x1: 0, z1: 40 },
];

const axisPath = `M ${toX(0)} ${toY(40)} L ${toX(0)} ${toY(24.5)} M ${toX(0)} ${toY(24.5)} L ${toX(0)} ${toY(8)} M ${toX(0)} ${toY(-10.2)} L ${toX(0)} ${toY(-20)}`;
const bridgeRailLeft = `M ${toX(-0.95)} ${toY(-9.7)} L ${toX(-0.95)} ${toY(5.3)}`;
const bridgeRailRight = `M ${toX(0.95)} ${toY(-9.7)} L ${toX(0.95)} ${toY(5.3)}`;
const bridgeSteps = `M ${toX(-1.1)} ${toY(-7.8)} H ${toX(1.1)} M ${toX(-1.1)} ${toY(-4.8)} H ${toX(1.1)} M ${toX(-1.1)} ${toY(-1.8)} H ${toX(1.1)} M ${toX(-1.1)} ${toY(1.2)} H ${toX(1.1)} M ${toX(-1.1)} ${toY(4.2)} H ${toX(1.1)}`;
function roofMark(h) {
  const x0 = toX(h.x0 + 1.2); const x1 = toX(h.x1 - 1.2); const y = toY((h.z0 + h.z1) / 2);
  return `M ${x0} ${y} L ${(x0 + x1) / 2} ${y - 7} L ${x1} ${y}`;
}
function routeD(r) {
  return `M ${toX(r.x0)} ${toY(r.z0)} L ${toX(r.x1)} ${toY(r.z1)}`;
}

const playerSvg = ref({ x: toX(0), y: toY(37) });
let timer = null;

function openInterior(hallId) {
  if (hallId === "hall0" || hallId === "courtyard" || hallId === "plaza") {
    window.location.href = "./index.html#/hall/plaza";
    return;
  }
  const pages = { hall1: "shanshui.html", hall2: "huaniao.html", hall3: "renwu.html", hall4: "shuzhai.html", hall5: "wenchuang.html" };
  if (window.MuseumMain && window.MuseumMain.saveExteriorReturnState) {
    window.MuseumMain.saveExteriorReturnState();
  }
  window.location.href = `./${pages[hallId] || "index.html#/hall/plaza"}`;
}

onMounted(() => {
  timer = setInterval(() => {
    const p = window.MuseumPlayer && window.MuseumPlayer.getPosition ? window.MuseumPlayer.getPosition() : null;
    if (p) playerSvg.value = { x: toX(p.x), y: toY(p.z) };
  }, 300);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<style scoped>
.map-page { align-items: flex-start; padding: 28px 18px 34px; background: radial-gradient(circle at 50% 0%, rgba(255,255,255,.8), transparent 55%); }
.map-card { width: min(1080px, 96vw); background: rgba(255,252,246,.94); border: 1px solid rgba(120,88,57,.22); border-radius: 22px; padding: 28px 30px 24px; box-shadow: 0 24px 70px rgba(62,45,30,.2); }
.map-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
.eyebrow { margin: 0 0 8px; color: #a3362b; font-size: 10px; letter-spacing: .2em; font-weight: 700; }
.card-title, h2 { margin: 0; color: #38291f; font-family: "Noto Serif SC", "Songti SC", serif; font-size: clamp(22px, 3vw, 32px); letter-spacing: .08em; }
.map-hint { margin: 9px 0 0; color: #8a7662; font-size: 13px; }
.map-status { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; padding: 9px 12px; color: #6c5442; background: #f2e8d9; border: 1px solid #dbc7ad; border-radius: 999px; font-size: 12px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #628c70; box-shadow: 0 0 0 4px rgba(98,140,112,.15); }
.map-stage { position: relative; padding: 10px; background: #efe5d6; border: 1px solid #d9c8b2; border-radius: 16px; overflow: hidden; }
.map-svg { width: 100%; height: auto; display: block; border-radius: 11px; }
.hall-zone { outline: none; }
.hall-zone.clickable { cursor: pointer; }
.hall-zone.clickable rect { transition: filter .18s, stroke-width .18s, fill-opacity .18s; }
.hall-zone.clickable:hover rect, .hall-zone.clickable:focus rect { filter: drop-shadow(0 4px 5px rgba(95,54,36,.28)); stroke-width: 4; fill-opacity: .92; }
.hall-label { fill: #3d2c22; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 17px; font-weight: 700; letter-spacing: .12em; pointer-events: none; }
.hall-sub { fill: #9b3c31; font-size: 10px; letter-spacing: .08em; pointer-events: none; }
.hall-closed { fill: #8b7663; font-size: 10px; letter-spacing: .08em; pointer-events: none; }
.route-base { fill: none; stroke: #d6c5a9; stroke-width: 7; stroke-linecap: round; opacity: .96; }
.route-center { fill: none; stroke: #a78d6e; stroke-width: 1.4; stroke-dasharray: 3 5; stroke-linecap: round; opacity: .9; }
.paving-zone { fill: #d8d0c0; fill-opacity: .78; stroke: #b7a994; stroke-width: 1.2; }
.outline-only rect { stroke: #aab99e; stroke-width: 2; stroke-dasharray: 7 7; }
.door-marker circle { fill: #a3362b; stroke: #fff8ed; stroke-width: 2; }
.door-marker text { fill: #8f3329; font-size: 9px; font-weight: 700; }
.water-label { fill: #eaf5ed; font-size: 13px; letter-spacing: .12em; }
.bridge-mark { pointer-events: none; }
.north-arrow text, .scale-bar text { fill: #604d3c; font-size: 12px; font-weight: 700; }
.south-label { fill: #765b45; font-size: 13px; letter-spacing: .12em; }
.player-dot { fill: #b43a2f; stroke: #fff8ed; stroke-width: 3; }
.player-ring { fill: none; stroke: #b43a2f; stroke-width: 2; stroke-dasharray: 3 4; opacity: .7; }
.map-legend { display: flex; flex-wrap: wrap; gap: 13px 22px; padding: 12px 4px 2px; color: #715d4b; font-size: 12px; }
.map-legend > div { display: inline-flex; align-items: center; gap: 7px; }
.legend-swatch { width: 18px; height: 12px; display: inline-block; border-radius: 3px; border: 1px solid #80604a; }
.hall-swatch { background: #e7d4b5; }
.closed-swatch { background: #d8c7b2; border-color: #9b8978; }
.court-swatch { background: #dce4d2; border-style: dashed; }
.lake-swatch { background: #638f87; border-color: #365e59; }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; background: #b43a2f; box-shadow: 0 0 0 3px rgba(180,58,47,.16); }
.back-link { display: inline-flex; margin-top: 18px; color: #8c3b2e; font-size: 13px; text-decoration: none; }
.back-link:hover { text-decoration: underline; }
@media (max-width: 640px) { .map-card { padding: 20px 14px 18px; border-radius: 16px; } .map-header { display: block; } .map-status { margin-top: 14px; } .hall-label { font-size: 13px; } }
</style>
