<template>
  <!-- 3D 博物馆本体由 js/ 下引擎模块直接渲染到 index.html 的 #stage，
       本组件只负责一件事：路由里的展厅 id -> 调用引擎传送 -->
  <span class="museum-route-anchor" aria-hidden="true"></span>
</template>

<script setup>
import { watch, onMounted } from "vue";
import { useRoute } from "vue-router";

// 各展厅的入场传送点 [x, z, yaw]
// yaw=0 面向 -Z（北，朝建筑）；yaw=Math.PI 面向 +Z（南）
// 坐标依据：docs/江南院落平面-坐标版.md §五（与 config.js 的 player.startPos 必须一致）
const HALL_SPAWNS = {
  plaza:     [0, 38, 0],          // 前庭（门内，避开序厅 z 24~34）
  hall0:     [0, 30, 0],          // 序厅
  courtyard: [0, 20, 0],          // 中央庭院
  hall1:     [-25, -8, 0],        // 山水画展区
  hall2:     [0, -10, 0],         // 花鸟画展区
  hall3:     [25, -8, 0],         // 人物画展区
  hall4:     [24, 16, Math.PI],   // 书斋 · 茶室（朝南看茶席）
  hall5:     [-24, 16, Math.PI],  // 文创区 · 临帖休憩
};

const route = useRoute();

function teleportToHall(hallId) {
  const spawn = HALL_SPAWNS[hallId];
  if (!spawn || !window.MuseumPlayer) return;
  window.MuseumPlayer.teleport(spawn[0], spawn[1], spawn[2]);
  const hall = (window.MuseumConfig && window.MuseumConfig.halls || []).find((h) => h.id === hallId);
  if (hall && window.MuseumUI) window.MuseumUI.toast("已到达 · " + hall.name);
}

onMounted(() => {
  // 等引擎初始化完成（main.js 在 DOMContentLoaded 后 init）
  const timer = setInterval(() => {
    if (window.MuseumPlayer) {
      clearInterval(timer);
      if (route.params.hallId) teleportToHall(route.params.hallId);
    }
  }, 200);
  setTimeout(() => clearInterval(timer), 10000);
});

watch(
  () => route.params.hallId,
  (hallId) => {
    if (hallId) teleportToHall(hallId);
  }
);
</script>
