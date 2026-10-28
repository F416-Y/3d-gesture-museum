#!/usr/bin/env node
/**
 * 在真实 Chromium 中打开构建后的花鸟厅，补拍三张运行态验收图。
 * 用于 GitHub Actions 的 Ubuntu 浏览器环境；本地 macOS 沙箱可能无法启动 Chromium。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "docs", "current", "组员5-截图"));

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
};

function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
    const relative = pathname.replace(/^\/+/, "") || "index.html";
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

async function main() {
  if (!fs.existsSync(path.join(DIST, "huaniao.html"))) {
    throw new Error("dist/huaniao.html 不存在，请先运行 npm run build");
  }
  await fsp.mkdir(OUT, { recursive: true });
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    args: [
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    page.on("console", (message) => {
      if (message.type() === "error") console.error(`BROWSER_CONSOLE: ${message.text()}`);
    });
    page.on("response", (response) => {
      const url = response.url();
      if (response.status() >= 400 && !url.endsWith("/favicon.ico")) {
        pageErrors.push(`HTTP ${response.status()}: ${url}`);
      }
    });

    await page.goto(`http://127.0.0.1:${port}/huaniao.html`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForFunction(
      () => document.body.dataset.ready === "true" && window.HuaniaoGallery?.ready,
      null,
      { timeout: 60000 },
    );
    await page.waitForTimeout(1500);

    const state = await page.evaluate(() => ({
      ready: document.body.dataset.ready,
      assetCount: Number(document.body.dataset.assetCount),
      errors: window.HuaniaoGallery.errors,
      loadedParts: window.HuaniaoGallery.loadedParts,
      exhibitCount: window.HuaniaoGallery.exhibits.length,
      workButtons: document.querySelectorAll("[data-exhibit]").length,
      paintingMeshes: window.HuaniaoGallery.paintingCount,
    }));
    if (state.assetCount !== 4 || state.loadedParts.length !== 4 || state.exhibitCount !== 3 || state.workButtons !== 3 || state.paintingMeshes !== 3 || state.errors.length) {
      throw new Error(`花鸟厅资源未全部加载：${JSON.stringify(state)}`);
    }

    const initial = await page.evaluate(() => window.HuaniaoGallery.getState());
    await page.mouse.move(800, 430);
    await page.mouse.down();
    await page.mouse.move(1040, 360, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.down("w");
    await page.keyboard.down("a");
    await page.waitForTimeout(400);
    await page.keyboard.up("w");
    await page.keyboard.up("a");
    const fixed = await page.evaluate(() => window.HuaniaoGallery.getState());
    if (
      initial.camera.join(",") !== fixed.camera.join(",") ||
      initial.yaw !== fixed.yaw ||
      initial.pitch !== fixed.pitch
    ) {
      throw new Error(`花鸟厅固定机位失效：${JSON.stringify({ initial, fixed })}`);
    }
    await page.keyboard.press("ArrowRight");
    const switched = await page.evaluate(() => window.HuaniaoGallery.getState());
    if (switched.activeExhibit === initial.activeExhibit) throw new Error("方向键未切换花鸟画");
    await page.keyboard.press("e");
    if (!(await page.evaluate(() => window.HuaniaoGallery.getState().detailOpen))) {
      throw new Error("E 未打开花鸟画说明");
    }
    await page.keyboard.press("q");
    if (await page.evaluate(() => window.HuaniaoGallery.getState().detailOpen)) {
      throw new Error("Q 未关闭花鸟画说明");
    }
    const gestureState = await page.evaluate(() => {
      const before = window.HuaniaoGallery.getState().activeExhibit;
      window.HuaniaoGallery.handleGestureState({ turn: 0.8, pinchPressed: false }, performance.now() + 1000);
      const afterTurn = window.HuaniaoGallery.getState();
      window.HuaniaoGallery.handleGestureState({ turn: 0, pinchPressed: true }, performance.now() + 2000);
      const afterPinch = window.HuaniaoGallery.getState();
      window.HuaniaoGallery.handleGestureState({ turn: 0, pinchPressed: true }, performance.now() + 3000);
      const afterClose = window.HuaniaoGallery.getState();
      return { before, afterTurn, afterPinch, afterClose };
    });
    if (gestureState.before === gestureState.afterTurn.activeExhibit ||
        !gestureState.afterPinch.detailOpen ||
        gestureState.afterClose.detailOpen) {
      throw new Error("花鸟厅手势映射未达预期");
    }

    const shots = [
      {
        file: "组员5-08-花鸟厅入口机位.png",
        prepare: () => window.HuaniaoGallery.resetView(),
      },
      {
        file: "组员5-09-花鸟厅画作无遮挡.png",
        prepare: () => window.HuaniaoGallery.focusGalleryWall(),
      },
    ];

    for (const shot of shots) {
      await page.evaluate(shot.prepare);
      await page.waitForTimeout(1300);
      const target = path.join(OUT, shot.file);
      await page.screenshot({
        path: target,
        type: "png",
        animations: "disabled",
        fullPage: false,
      });
      const size = (await fsp.stat(target)).size;
      if (size < 20000) throw new Error(`${shot.file} 截图内容异常，仅 ${size} bytes`);
      console.log(`captured ${shot.file} (${size} bytes)`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.HuaniaoGallery.resetView());
    await page.waitForTimeout(1300);
    const mobileTarget = path.join(OUT, "组员5-11-花鸟厅移动端.png");
    await page.screenshot({
      path: mobileTarget,
      type: "png",
      animations: "disabled",
      fullPage: false,
    });
    const mobileSize = (await fsp.stat(mobileTarget)).size;
    if (mobileSize < 15000) throw new Error(`移动端截图内容异常，仅 ${mobileSize} bytes`);
    console.log(`captured 组员5-11-花鸟厅移动端.png (${mobileSize} bytes)`);

    if (pageErrors.length) {
      throw new Error(`浏览器运行错误：\n${pageErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
