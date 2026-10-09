<template>
  <!-- 3D 博物馆本体由 js/ 下引擎模块直接渲染到 index.html 的 #stage，
       本组件只负责一件事：路由里的展厅 id -> 调用引擎传送 -->
  <span class="museum-route-anchor" aria-hidden="true"></span>
</template>

<script setup>
import { watch, onMounted } from "vue";
import { useRoute } from "vue-router";

// 各展厅的入场传送点 [x, z, yaw]
// yaw=0 面向 -Z（北，朝建筑）；Math.PI 面向 +Z（南）；±Math.PI/2 面向东西
// 坐标依据：外观原型布局（docs/外观原型-坐标对接表.md）——
//   落点必须落在 scene.js 的 hallRegions 之内、且不与碰撞体重叠。
//   校验：node check-proto-seams.mjs（仓库外工具）会逐个丢给 getHallAt() 复判。
const HALL_SPAWNS = {
  plaza:     [0, 38, 0],                   // 前庭（南大门外台阶脚下）
  hall0:     [0, 32.5, 0],                 // 序厅（大门内、铜鼎之前，面向鼎）
  courtyard: [0, 20, 0],                   // 中轴庭院（观澜亭南侧）
  hall1:     [-25, -13, Math.PI / 2],       // 山水内饰（直接落在正房内部）
  hall2:     [0, -16, 0],                   // 花鸟内饰（直接落在正房内部）
  hall3:     [25, -13, 0],                  // 人物内饰（直接落在正房内部）
  hall4:     [24, 13, -Math.PI / 2],        // 书斋内饰（直接落在正房内部）
  hall5:     [-24, 13, Math.PI / 2],        // 文创内饰（直接落在正房内部）
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
