<template>
  <div class="overlay-page map-page">
    <div class="map-card">
      <h2 class="card-title">云墨美术馆 · 园区平面图</h2>
      <p class="map-hint">上 = 北（z 负方向）｜ 每个方格 10m ｜红点是当前位置</p>
      <svg class="map-svg" viewBox="0 0 920 920" xmlns="http://www.w3.org/2000/svg">
        <!-- 背景：围墙内园区 -->
        <rect x="40" y="40" width="840" height="840" fill="#e8e2d6" stroke="#8a7a68" stroke-width="2" />

        <!-- 中央庭院 -->
        <rect x="280" y="300" width="360" height="260" fill="#d9cfb8" />
        <!-- 水池 -->
        <rect x="370" y="380" width="180" height="120" fill="#7a8fa0" opacity="0.8" />

        <!-- 六厅 -->
        <g v-for="h in halls" :key="h.id">
          <rect
            :x="toSvg(h.x0)"
            :y="toSvg(h.z0)"
            :width="(h.x1 - h.x0) * 10"
            :height="(h.z1 - h.z0) * 10"
            :fill="h.color"
            stroke="#5a4a3a"
            stroke-width="1.5"
            rx="2"
          />
          <text
            :x="toSvg((h.x0 + h.x1) / 2)"
            :y="toSvg((h.z0 + h.z1) / 2) + 5"
            text-anchor="middle"
            class="hall-label"
          >{{ h.name }}</text>
        </g>

        <!-- 曲廊 -->
        <rect x="250" y="300" width="30" height="260" fill="#c9bca0" />
        <rect x="640" y="300" width="30" height="260" fill="#c9bca0" />

        <!-- 前庭与道路 -->
        <rect x="395" y="560" width="130" height="120" fill="#d6cfb8" />

        <!-- 南门 / 门楼 -->
        <rect x="395" y="860" width="130" height="20" fill="#7a3b2e" />

        <!-- 当前位置红点 -->
        <circle :cx="playerSvg.x" :cy="playerSvg.y" r="7" fill="#c4342a" />
      </svg>
      <RouterLink class="back-link" to="/">← 返回博物馆</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const halls = [
  { id: "hall1", name: "山水画", x0: -34, z0: -22, x1: -16, z1: -4, color: "#eaddc5" },
  { id: "hall2", name: "花鸟画", x0: -12, z0: -24, x1: 12, z1: -8, color: "#eaddc5" },
  { id: "hall3", name: "人物画", x0: 16, z0: -22, x1: 34, z1: -4, color: "#eaddc5" },
  { id: "hall4", name: "书斋", x0: 16, z0: 6, x1: 32, z1: 20, color: "#ded3bd" },
  { id: "hall5", name: "文创", x0: -32, z0: 6, x1: -16, z1: 20, color: "#ded3bd" },
  { id: "hall0", name: "序厅", x0: -10, z0: 24, x1: 10, z1: 34, color: "#e8dcc4" },
];

function toSvg(v) {
  // 世界坐标 -> SVG：中心 (460,460)，1m = 10px，z 向南为正对应 SVG y 向下
  return 460 + v * 10;
}

const playerSvg = ref({ x: toSvg(0), y: toSvg(38) });
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
.map-svg { width: 100%; height: auto; display: block; border-radius: 8px; }
.hall-label { font-size: 12px; fill: #3a2c22; pointer-events: none; }
</style>
