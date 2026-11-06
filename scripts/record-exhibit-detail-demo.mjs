/* ============================================================
 * record-exhibit-detail-demo.mjs —— 展品分层弹窗与五牛图热点验收 / Demo 录制
 * 运行：
 *   node scripts/record-exhibit-detail-demo.mjs
 *   node scripts/record-exhibit-detail-demo.mjs "D:\\AI\\识图\\云间入墨-展品交互Demo.webm"
 * 输出默认：docs/current/demo/云间入墨-展品交互Demo.webm
 * ============================================================ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4177;
const defaultOutput = path.join(ROOT, "docs", "current", "demo", "云间入墨-展品交互Demo.webm");
const requestedOutput = path.resolve(process.argv[2] || defaultOutput);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const DEMO_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>云间入墨 · 展品分层与五牛图热点验收</title>
  <link rel="stylesheet" href="/css/tokens.css" />
  <link rel="stylesheet" href="/css/style.css" />
  <style>
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% 20%, #38332b, #151411 72%); }
    #stage { position: fixed; inset: 0; pointer-events: none; }
    .demo-label { position: fixed; left: 28px; top: 24px; z-index: 3; color: #f2eadb; letter-spacing: .1em; }
    .demo-label b { display: block; font: 500 24px/1.3 "Kaiti SC", "STKaiti", serif; }
    .demo-label span { color: rgba(242,234,219,.62); font: 11px/1.8 "Microsoft YaHei", sans-serif; }
    #toast { display: none; }
  </style>
</head>
<body>
  <div id="stage"></div>
  <div class="demo-label"><b>展品分层与五牛图热点</b><span>云间入墨 · 答辩 Demo · 基础信息 / 作品特点 / 细节赏析</span></div>
  <div id="panel" class="panel" aria-hidden="true">
    <button id="panel-close" class="panel-close" type="button" aria-label="关闭">×</button>
    <div id="panel-body" class="panel-body"></div>
  </div>
  <div id="toast" class="toast"></div>
  <script src="/js/config.js"></script>
  <script src="/js/ui.js"></script>
  <script>
    window.MuseumUI.init();
    window.MuseumUI.hideLoading();
    var exhibit = window.MuseumConfig.exhibits.find(function (item) { return item.id === "wuniutu"; });
    window.MuseumUI.showExhibit(exhibit);
  </script>
</body>
</html>`;
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (urlPath === "/exhibit-demo.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(DEMO_PAGE);
      return;
    }
    const relative = urlPath.replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

function uniqueOutput(file) {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  let candidate = file;
  let index = 2;
  while (fs.existsSync(candidate)) candidate = base + "-" + index++ + ext;
  return candidate;
}

fs.mkdirSync(path.join(ROOT, "docs", "current", "demo"), { recursive: true });
const server = await startServer();
const videoDir = path.join(ROOT, ".tmp", "exhibit-demo-" + Date.now());
fs.mkdirSync(videoDir, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const problems = [];
const logs = [];
page.on("console", (msg) => { if (msg.type() === "error") logs.push(msg.text()); });
page.on("pageerror", (error) => logs.push(error.message));

try {
  await page.goto(`http://127.0.0.1:${PORT}/exhibit-demo.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator(".panel.open").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(1200);

  const tabs = page.locator("[data-exhibit-tab]");
  if (await tabs.count() !== 3) problems.push("弹窗没有三个信息层级标签");
  if (!(await page.locator('[data-exhibit-panel="basic"]').isVisible())) problems.push("基础信息默认未显示");
  await page.screenshot({ path: path.join(ROOT, "docs", "current", "demo", "五牛图-基础信息.png") });

  await page.locator('[data-exhibit-tab="features"]').click({ force: true });
  await page.waitForTimeout(900);
  if (!(await page.locator('[data-exhibit-panel="features"]').isVisible())) problems.push("作品特点标签无法切换");
  await page.screenshot({ path: path.join(ROOT, "docs", "current", "demo", "五牛图-作品特点.png") });

  await page.locator('[data-exhibit-tab="details"]').click({ force: true });
  await page.waitForTimeout(900);
  if (!(await page.locator('[data-exhibit-panel="details"]').isVisible())) problems.push("细节赏析标签无法切换");
  await page.screenshot({ path: path.join(ROOT, "docs", "current", "demo", "五牛图-细节赏析.png") });

  const hotspots = page.locator("[data-hotspot-index]");
  if (await hotspots.count() !== 6) problems.push("五牛图热点数量不是 6 个");
  await hotspots.nth(0).click({ force: true });
  await page.waitForTimeout(1000);
  if (!(await page.locator("#p-hotspot-detail").isVisible())) problems.push("点击牛身热点后局部说明未显示");
  if (!(await page.locator("#p-hotspot-title").innerText()).includes("第一牛")) problems.push("首个牛身热点内容不匹配");

  await hotspots.nth(4).click({ force: true });
  await page.waitForTimeout(1200);
  if (!(await page.locator("#p-hotspot-copy").innerText()).includes("老牛")) problems.push("末头牛热点内容不匹配");

  await hotspots.nth(5).click({ force: true });
  await page.waitForTimeout(1500);
  if (!(await page.locator("#p-hotspot-copy").innerText()).includes("收藏")) problems.push("收藏印热点内容不匹配");

  await page.screenshot({ path: path.join(ROOT, "docs", "current", "demo", "五牛图热点验收.png"), fullPage: false });
  if (logs.length) problems.push("页面控制台报错：" + logs.join(" | "));
} finally {
  await context.close();
  await browser.close();
  server.close();
}

const recorded = fs.readdirSync(videoDir).filter((file) => file.endsWith(".webm")).sort()[0];
if (!recorded) throw new Error("没有生成 Demo 视频");
fs.mkdirSync(path.dirname(requestedOutput), { recursive: true });
const output = requestedOutput;
fs.copyFileSync(path.join(videoDir, recorded), output);
fs.rmSync(videoDir, { recursive: true, force: true });

console.log("Demo 视频：" + output);
if (problems.length) {
  console.error("验收失败：");
  problems.forEach((item) => console.error("  · " + item));
  process.exit(1);
}
console.log("OK 三层弹窗、五个牛身热点和收藏印热点均已通过实际点击验收");