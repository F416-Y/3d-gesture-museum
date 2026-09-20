// 构建后处理：vite 只打包 src/ 与 index.html，
// 博物馆的引擎脚本 js/、样式 css/、素材 assets/ 是「不进构建」的静态资源，这里复制进 dist/
import { cpSync, existsSync } from "node:fs";

for (const dir of ["js", "css", "assets"]) {
  if (existsSync(dir)) {
    cpSync(dir, `dist/${dir}`, { recursive: true });
  }
}
console.log("[postbuild] 已复制 js/ css/ assets/ -> dist/");
