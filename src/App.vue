<template>
  <!-- 顶部右侧导航：展厅直达 + 用户入口（叠在 3D 场景之上，不影响原有顶栏） -->
  <nav class="vue-nav">
    <div class="nav-halls">
      <RouterLink to="/map">平面图</RouterLink>
      <RouterLink to="/hall/plaza">前庭</RouterLink>
      <RouterLink to="/hall/hall0">序厅</RouterLink>
      <RouterLink to="/hall/courtyard">庭院</RouterLink>
      <RouterLink to="/hall/hall1">山水</RouterLink>
      <RouterLink to="/hall/hall2">花鸟</RouterLink>
      <RouterLink to="/hall/hall3">人物</RouterLink>
      <RouterLink to="/hall/hall4">书斋</RouterLink>
      <RouterLink to="/hall/hall5">文创</RouterLink>
    </div>
    <div class="nav-user">
      <template v-if="user.isLoggedIn">
        <RouterLink to="/favorites" class="nav-fav">我的收藏</RouterLink>
        <span class="nav-name">{{ user.username }}</span>
        <button type="button" class="nav-btn" @click="onLogout">退出</button>
      </template>
      <RouterLink v-else to="/login" class="nav-btn">登录 / 注册</RouterLink>
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

function onLogout() {
  user.logout();
  router.push("/");
}
</script>
