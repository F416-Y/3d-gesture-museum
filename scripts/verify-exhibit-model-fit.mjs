#!/usr/bin/env node
/**
 * 在真实 Chromium 中验收展品 3D 模型的自动取景。
 * 重点检查后母戊鼎完整入镜、窗口缩放后重新取景，以及旋转/缩放交互仍可用。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "docs", "current", "组员5-截图");

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
  ".task": "application/octet-stream",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
};

const TEST_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>展品模型自动取景验收</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div id="panel" class="panel" role="dialog" aria-modal="true" aria-hidden="true">
    <button id="panel-close" type="button" class="panel-close" aria-label="关闭">×</button>
    <div id="panel-body" class="panel-body"></div>
  </div>
  <script src="/js/vendor/three.min.js"><\/script>
  <script src="/js/vendor/GLTFLoader.js"><\/script>
  <script src="/js/config.js"><\/script>
  <script src="/js/ui.js"><\/script>
  <script>
    window.MuseumUI.init();
    const exhibit = window.MuseumConfig.exhibits.find((item) => item.id === "houmuwuding");
    if (!exhibit) throw new Error("找不到后母戊鼎展品数据");
    window.MuseumUI.showExhibit(exhibit);
  <\/script>
</body>
</html>`;

function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
    const relative = pathname.replace(/^\/+/, "") || "index.html";
    if (relative === "__model-viewer-test.html") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(TEST_PAGE);
      return;
    }
    const file = path.join(DIST, relative);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readViewerState(page) {
  return page.evaluate(() => {
    const host = document.querySelector(".p-model-viewer");
    const canvas = document.querySelector(".p-model-canvas");
    if (!host || !canvas) return null;
    const rect = host.getBoundingClientRect();
    return {
      modelReady: host.dataset.modelReady,
      fitDistance: Number(host.dataset.fitDistance),
      fitRadius: Number(host.dataset.fitRadius),
      cameraFov: Number(host.dataset.cameraFov),
      cameraAspect: Number(host.dataset.cameraAspect),
      zoom: Number(host.dataset.zoom),
      isError: host.classList.contains("is-error"),
      hostWidth: rect.width,
      hostHeight: rect.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      hint: document.querySelector(".p-model-hint")?.textContent || "",
    };
  });
}

async function main() {
  assert(fs.existsSync(path.join(DIST, "index.html")), "dist/index.html 不存在，请先运行 npm run build");
  assert(
    fs.existsSync(path.join(DIST, "assets/models/parts/opt/bronze-ding.glb")),
    "生产构建中缺少后母戊鼎模型",
  );
  await fsp.mkdir(OUT, { recursive: true });

  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    args: [
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 1,
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

    await page.goto(`http://127.0.0.1:${port}/__model-viewer-test.html`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(
      () => document.querySelector(".p-model-viewer")?.dataset.modelReady === "true",
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(800);

    const initial = await readViewerState(page);
    assert(initial && !initial.isError, "后母戊鼎模型加载失败");
    assert(initial.canvasWidth > 0 && initial.canvasHeight > 0, "模型画布尺寸无效");
    assert(initial.fitRadius > 0 && initial.fitDistance > 0, "模型包围球或取景距离无效");
    assert(initial.hint.includes("拖动旋转") && initial.hint.includes("滚轮缩放"), "模型交互提示缺失");

    const verticalHalfFov = (initial.cameraFov * Math.PI) / 180 / 2;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * initial.cameraAspect);
    const expectedDistance =
      (initial.fitRadius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov))) * 1.18;
    assert(
      Math.abs(initial.fitDistance - expectedDistance) < 0.02,
      `自动取景距离不正确：${JSON.stringify({ expectedDistance, actual: initial.fitDistance })}`,
    );

    const screenshot = path.join(OUT, "组员5-12-展品模型完整取景.png");
    const panelBox = await page.locator(".panel-card").boundingBox();
    assert(panelBox && panelBox.width > 0 && panelBox.height > 0, "模型弹窗尺寸无效");
    await page.screenshot({
      path: screenshot,
      type: "png",
      animations: "disabled",
      clip: panelBox,
    });
    assert((await fsp.stat(screenshot)).size > 30000, "模型完整取景截图内容异常");

    const previousAspect = initial.cameraAspect;
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.waitForFunction(
      (aspect) => Number(document.querySelector(".p-model-viewer")?.dataset.cameraAspect) !== aspect,
      previousAspect,
      { timeout: 10000 },
    );
    const resized = await readViewerState(page);
    assert(resized && resized.fitDistance > 0, "画布尺寸变化后未重新取景");

    const canvas = page.locator(".p-model-canvas");
    await canvas.hover();
    await page.mouse.wheel(0, 420);
    await page.waitForFunction(
      () => Number(document.querySelector(".p-model-viewer")?.dataset.zoom) > 1,
      null,
      { timeout: 5000 },
    );
    await canvas.dblclick();
    await page.waitForFunction(
      () => Number(document.querySelector(".p-model-viewer")?.dataset.zoom) === 1,
      null,
      { timeout: 5000 },
    );

    assert(pageErrors.length === 0, `浏览器运行错误：\n${pageErrors.join("\n")}`);
    console.log("OK 展品模型自动取景、窗口重算、滚轮缩放与双击复位全部通过");
    console.log(`截图：${screenshot}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
