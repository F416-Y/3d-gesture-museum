// Vue 壳入口：登录 / 收藏 / 多展馆路由
// 注意：3D 引擎（js/ 下的 window.MuseumXxx 模块）不经过本文件，两者并行运行
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "../css/tokens.css";
import "./styles/vue-shell.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");

/* ============================================================
 * CloudInkBridge —— 让原生 3D 鉴赏弹窗（js/ui.js）调用 Vue 侧的
 * user store 与 Supabase 社交层（收藏 / 评论）。
 * 归属：组员5（UI）。引擎弹窗经 window 读取，不写引擎状态。
 * ============================================================ */
import { useUserStore } from "./stores/user";
import {
  isFavorited,
  addFavorite,
  removeFavorite,
  listComments,
  addComment,
} from "./services/social";
import { ready as supabaseReady } from "./services/lc";

const bridgeUser = useUserStore();

function currentUser() {
  return bridgeUser.current; // supabase user（含 id）或 null
}

window.CloudInkBridge = {
  ready: !!supabaseReady,
  isLoggedIn: function () {
    return !!(supabaseReady && currentUser() && currentUser().id);
  },
  isFavorited: function (exhibitId) {
    const u = currentUser();
    if (!u) return Promise.resolve(false);
    return isFavorited(u, exhibitId);
  },
  addFavorite: function (exhibitId) {
    return addFavorite(currentUser(), exhibitId);
  },
  removeFavorite: function (exhibitId) {
    return removeFavorite(currentUser(), exhibitId);
  },
  listComments: function (exhibitId) {
    // 未配置 / 拉取失败时降级为空列表，弹窗评论区仍可正常渲染
    return listComments(exhibitId).catch(function () {
      return [];
    });
  },
  addComment: function (exhibitId, content) {
    return addComment(currentUser(), exhibitId, content);
  },
  toast: function (msg) {
    if (window.MuseumUI && window.MuseumUI.toast) window.MuseumUI.toast(msg);
  },
};
