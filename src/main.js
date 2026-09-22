// Vue 壳入口：登录 / 收藏 / 多展馆路由
// 注意：3D 引擎（js/ 下的 window.MuseumXxx 模块）不经过本文件，两者并行运行
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./styles/tokens.css";
import "./styles/vue-shell.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
