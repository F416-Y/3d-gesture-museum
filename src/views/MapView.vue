<template>
  <div class="overlay-page map-page">
    <div class="map-card">
      <h2 class="card-title">云墨美术馆 · 园区平面图</h2>
      <p class="map-hint">上 = 北（z 负方向）｜ 园区 100 × 80 m ｜ 红点是当前位置</p>
      <div class="map-canvas">
        <img class="map-base" src="../../assets/images/plan-top.png" alt="园区俯视渲染图" />
        <svg class="map-svg" viewBox="0 0 920 920" xmlns="http://www.w3.org/2000/svg">
        <!-- 围墙围合的园区：世界坐标 x ±50、z ±40 -->
        <rect x="40" y="124" width="840" height="672" fill="none" stroke="rgba(90,74,58,0.5)" stroke-width="2" />

        <!-- 水面：荷池庭院 + 水榭庭院 -->
        <rect x="590" y="510" width="93" height="84" fill="#7a8fa0" opacity="0.85" rx="10" />
        <rect x="401" y="418" width="118" height="101" fill="#7a8fa0" opacity="0.85" rx="8" />

        <!-- 装饰院落（亭轩/小院，只做碰撞体） -->
        <g v-for="c in courts" :key="c.id">
          <rect :x="toSvg(c.x0)" :y="toSvg(c.z0)" :width="(c.x1 - c.x0) * SCALE"
                :height="(c.z1 - c.z0) * SCALE" fill="rgba(222,211,189,0.15)" stroke="rgba(179,165,140,0.6)" stroke-width="1.2" />
        </g>

        <!-- 八个展厅 / 区域（坐标与新布局 hallRegions 一致） -->
        <g v-for="h in halls" :key="h.id">
          <rect :x="toSvg(h.x0)" :y="toSvg(h.z0)" :width="(h.x1 - h.x0) * SCALE"
                :height="(h.z1 - h.z0) * SCALE" :fill="h.color" opacity="0.16" stroke="#5a4a3a" stroke-width="1.5" rx="2" />
          <text :x="toSvg((h.x0 + h.x1) / 2)" :y="toSvg((h.z0 + h.z1) / 2) + 5"
                text-anchor="middle" class="hall-label">{{ h.name }}</text>
        </g>

        <!-- 南入口：六级大台阶 + 门楼 -->
        <rect x="401" y="761" width="118" height="34" fill="rgba(122,59,46,0.35)" rx="3" />
        <text x="460" y="783" text-anchor="middle" class="hall-label" fill="#f5f1e8">南门</text>

        <!-- 当前位置红点 -->
        <circle :cx="playerSvg.x" :cy="playerSvg.y" r="7" fill="#c4342a" />
      </svg>
        </div>
      <RouterLink class="back-link" to="/">← 返回博物馆</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

/* 世界坐标 -> SVG：园区 x ∈ [-50,50]、z ∈ [-40,40]，1m = 8.4px，中心 (460,460)
   （换布局时只需改这份坐标表与 SCALE，画法不用动） */
const SCALE = 8.4;
function toSvg(v) { return 460 + v * SCALE; }

/* 八个展厅 / 区域：与 js/scene.js 里 useProtoLayout 分支的 hallRegions 一致 */
const halls = [
  { id: "hall1", name: "山水", x0: -46, z0: -20, x1: -28.5, z1: -5, color: "#eaddc5" },
  { id: "hall2", name: "花鸟", x0: -11, z0: -37.5, x1: 11, z1: -21, color: "#eaddc5" },
  { id: "hall3", name: "人物", x0: 28, z0: -21, x1: 45.5, z1: -10, color: "#eaddc5" },
  { id: "hall5", name: "文创", x0: -45, z0: 8, x1: -34, z1: 21, color: "#ded3bd" },
  { id: "hall4", name: "书斋", x0: 34, z0: 6, x1: 42, z1: 19, color: "#ded3bd" },
  { id: "hall0", name: "序厅", x0: -11, z0: 24.5, x1: 11, z1: 34.5, color: "#e8dcc4" },
  { id: "courtyard", name: "庭院", x0: -9, z0: -20, x1: 9, z1: 24.5, color: "#cfd8c4" },
  { id: "plaza", name: "前庭", x0: -26, z0: 34, x1: 26, z1: 40, color: "#d6cfb8" },
];

/* 装饰院落（亭轩/小院）：不占展厅 id、不需要展品热点，仅作空间示意 */
const courts = [
  { id: "jingyun", x0: 33, z0: -34.75, x1: 45, z1: -25.25 },
  { id: "yaji", x0: -45.2, z0: -34.2, x1: -30.8, z1: -24.8 },
  { id: "lanzhu", x0: 28.8, z0: 1.7, x1: 37.2, z1: 7.1 },
  { id: "chashi", x0: 34, z0: 20, x1: 42, z1: 33 },
  { id: "linmo", x0: -45, z0: 22, x1: -34, z1: 35 },
];

const playerSvg = ref({ x: toSvg(0), y: toSvg(37) });
let timer = null;

onMounted(() => {
  timer = setInterval(() => {
    const p = window.MuseumPlayer && window.MuseumPlayer.getPosition ? window.MuseumPlayer.getPosition() : null;
    if (p) {
      playerSvg.value = { x: toSvg(p.x), y: toSvg(p.z) };
    }
  }, 300);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.map-page { align-items: flex-start; padding-top: 24px; }
.map-card { width: 820px; max-width: 96vw; background: #fffdf8; border-radius: 12px; padding: 24px 28px; box-shadow: 0 8px 30px rgba(60,40,20,.15); }
.map-hint { color: #8a7a68; font-size: 13px; margin: -10px 0 14px; }
.map-canvas { position: relative; width: 100%; }
.map-base { width: 100%; height: auto; display: block; border-radius: 8px; }
.map-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hall-label { font-size: 12px; fill: #3a2c22; pointer-events: none; }
</style>