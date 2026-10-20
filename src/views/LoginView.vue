<template>
  <div class="overlay-page">
    <div class="card">
      <h2 class="card-title">云间入墨 · {{ mode === "login" ? "登录" : "注册" }}</h2>
      <div class="tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>
      <form @submit.prevent="onSubmit">
        <label>
          用户名
          <input v-model.trim="username" type="text" required autocomplete="username" placeholder="请输入用户名" />
        </label>
        <label>
          密码
          <input v-model="password" type="password" required minlength="6"
                 :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                 placeholder="至少 6 位" />
        </label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="submit" type="submit" :disabled="loading">
          {{ loading ? "请稍候……" : mode === "login" ? "登录" : "注册并登录" }}
        </button>
      </form>
      <RouterLink class="back-link" to="/">← 返回博物馆</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/user";

const mode = ref("login");
const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);
const user = useUserStore();
const router = useRouter();

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    if (mode.value === "login") {
      await user.login(username.value, password.value);
    } else {
      await user.register(username.value, password.value);
    }
    router.push("/");
  } catch (e) {
    error.value = e && e.message ? e.message : "操作失败，请重试";
  } finally {
    loading.value = false;
  }
}
</script>
