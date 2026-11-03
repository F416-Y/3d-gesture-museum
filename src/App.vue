<template>
  <!-- 顶部右侧导航：展厅直达 + 用户入口（叠在 3D 场景之上，不影响原有顶栏） -->
  <nav class="vue-nav">
    <div class="nav-halls">
          <a :href="exteriorHref('map')">平面图</a>
          <a :href="exteriorHref('hall/hall0')">序厅</a>
          <a href="./shanshui.html" @click="saveExteriorReturnState">山水</a>
          <a href="./huaniao.html" @click="saveExteriorReturnState">花鸟</a>
          <a href="./renwu.html" @click="saveExteriorReturnState">人物</a>
          <span class="nav-hall-closed" title="云墨修缮中，敬请期待">书斋 · 修缮中</span>
          <span class="nav-hall-closed" title="云墨修缮中，敬请期待">文创 · 修缮中</span>
    </div>
    <div class="nav-user">
      <template v-if="user.isLoggedIn">
        <RouterLink to="/favorites" class="nav-fav">我的收藏</RouterLink>
        <span class="nav-name">{{ user.username }}</span>
        <button type="button" class="nav-btn" @click="onLogout">退出</button>
      </template>
          <a v-else :href="exteriorHref('login')" class="nav-btn">登录 / 注册</a>
    </div>
  </nav>
  <RouterView />
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "./stores/user";

const user = useUserStore();
const router = useRouter();

onMounted(() => user.restoreSession());

function exteriorHref(route) {
  return `./index.html#/${route}`;
}

function saveExteriorReturnState() {
  if (window.MuseumMain && window.MuseumMain.saveExteriorReturnState) {
    window.MuseumMain.saveExteriorReturnState();
  }
}

function onLogout() {
  user.logout();
  router.push("/");
}
</script>
