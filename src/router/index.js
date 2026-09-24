// 路由：博物馆主页 + 展厅直达 + 登录 + 收藏夹 + 平面图
// hash 模式：GitHub Pages 纯静态托管没有后端路由重写，hash 最稳
import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  { path: "/", name: "museum", component: () => import("../views/MuseumView.vue") },
  { path: "/hall/:hallId", name: "hall", component: () => import("../views/MuseumView.vue") },
  { path: "/login", name: "login", component: () => import("../views/LoginView.vue") },
  { path: "/favorites", name: "favorites", component: () => import("../views/FavoritesView.vue") },
  { path: "/map", name: "map", component: () => import("../views/MapView.vue") },
];

const OVERLAY_ROUTES = ["login", "favorites", "map"];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 全屏覆盖页（登录/收藏/平面图）时隐藏 3D 场景 DOM，避免两层界面叠在一起
router.afterEach((to) => {
  document.body.classList.toggle("vue-overlay", OVERLAY_ROUTES.includes(to.name));
});

export default router;
