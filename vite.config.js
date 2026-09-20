import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// base 相对路径：部署到 GitHub Pages 子目录也能正常加载资源
export default defineConfig({
  plugins: [vue()],
  base: "./",
});
