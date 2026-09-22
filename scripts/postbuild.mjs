// 构建后处理：vite 只打包 src/ 与 index.html，
// 博物馆的引擎脚本 js/、样式 css/、素材 assets/ 是「不进构建」的静态资源，这里复制进 dist/
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

for (const dir of ["js", "css", "assets"]) {
  if (existsSync(dir)) {
    cpSync(dir, `dist/${dir}`, { recursive: true });
  }
}
console.log("[postbuild] 已复制 js/ css/ assets/ -> dist/");

/* ---------- 设计令牌 tokens.css 同步到 dist/css/ ----------
 * 背景：CSS 变量的单一来源是 src/styles/tokens.css（组员5 定义）。
 *   · Vue 壳经 src/main.js 引入 → vite 会打包进 dist/assets/*.css ✓
 *   · 但 3D 场景的 css/style.css 是「不进构建」的原样复制文件；它在生产环境里
 *     写 @import "../src/styles/tokens.css" 时，dist 下并没有 src/ 目录 → 404。
 * 处理：把 tokens.css 复制到 dist/css/tokens.css，并在复制后的 style.css 里把
 *     引用路径改写成 ./tokens.css（幂等：若已写成 ./tokens.css 则不改动）。
 * 说明：这是给「不经过构建」的那份 CSS 兜底；下次组员5 改路径后此处自动无操作。
 */
const srcTokens = "src/styles/tokens.css";
const distTokens = "dist/css/tokens.css";
const distStyle = "dist/css/style.css";
if (existsSync(srcTokens)) {
  mkdirSync("dist/css", { recursive: true });
  cpSync(srcTokens, distTokens);
  if (existsSync(distStyle)) {
    const before = readFileSync(distStyle, "utf8");
    const after = before.replace(/url\((['"]?)\.\.\/src\/styles\/tokens\.css\1\)/g, 'url("./tokens.css")');
    if (after !== before) {
      writeFileSync(distStyle, after);
      console.log("[postbuild] 已把 dist/css/style.css 的 tokens 引用改写为 ./tokens.css（避免生产 404）");
    }
  }
  console.log("[postbuild] 已同步 tokens.css -> dist/css/tokens.css");
}