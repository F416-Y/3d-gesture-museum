<template>
  <!-- 3D 博物馆本体由 js/ 下引擎模块直接渲染到 index.html 的 #stage，
       本组件只负责一件事：路由里的展厅 id -> 调用引擎传送 -->
  <span class="museum-route-anchor" aria-hidden="true"></span>
</template>

<script setup>
import { watch, onMounted } from "vue";
import { useRoute } from "vue-router";

// 各展厅的入场传送点 [x, z, yaw]（yaw=0 面向 -Z 即建筑方向；坐标可由组员2 微调）
const HALL_SPAWNS = {
  plaza: [0, 26, 0],      // 前庭中轴（出生点同位置）
  hall1: [0, 4, 0],       // 一楼 · 中国绘画厅 门内
  hall2: [-14.3, 4, 0],   // 二楼 · 文明对话厅（西侧连廊）
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
