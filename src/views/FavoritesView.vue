<template>
  <div class="overlay-page">
    <div class="card card-wide">
      <h2 class="card-title">我的收藏</h2>
      <p v-if="!user.isLoggedIn" class="empty">
        请先 <RouterLink to="/login">登录</RouterLink> 后查看收藏。
      </p>
      <p v-else-if="loading" class="empty">加载中……</p>
      <p v-else-if="items.length === 0" class="empty">还没有收藏，去展厅里逛逛吧。</p>
      <ul v-else class="fav-list">
        <li v-for="item in items" :key="item.id">
          <button type="button" class="fav-item" @click="goTo(item)">
            <b>{{ item.name }}</b>
            <span>{{ item.hallName }} · {{ item.artist || "佚名" }}</span>
          </button>
          <button type="button" class="fav-remove" title="取消收藏" @click="remove(item)">×</button>
        </li>
      </ul>
      <RouterLink class="back-link" to="/">← 返回博物馆</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/user";
import { listFavorites, removeFavorite } from "../services/social";

const user = useUserStore();
const router = useRouter();
const items = ref([]);
const loading = ref(true);

function exhibitMeta(exhibitId) {
  const cfg = window.MuseumConfig || {};
  const ex = (cfg.exhibits || []).find((e) => e.id === exhibitId) || {};
  const hall = (cfg.halls || []).find((h) => h.id === ex.hall) || {};
  return { ...ex, hallName: hall.name || "" };
}

async function load() {
  if (!user.isLoggedIn) { loading.value = false; return; }
  try {
    const ids = await listFavorites(user.current);
    items.value = ids.map((id) => exhibitMeta(id)).filter((e) => e.id);
  } catch (e) {
    console.warn("[云间入墨] 收藏加载失败：", e);
  } finally {
    loading.value = false;
  }
}

function goTo(item) {
  // 跳回博物馆并传送到该展品所在展厅
  router.push("/hall/" + (item.hall || "plaza"));
}

async function remove(item) {
  try {
    await removeFavorite(user.current, item.id);
    items.value = items.value.filter((e) => e.id !== item.id);
  } catch (e) {
    console.warn("[云间入墨] 取消收藏失败：", e);
  }
}

onMounted(load);
</script>
