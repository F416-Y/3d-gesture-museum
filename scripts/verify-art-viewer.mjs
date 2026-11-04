#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(os.tmpdir(), "cloudink-art-viewer");
const HALLS = [
  { file: "shanshui.html", api: "ShanshuiHall", initial: "qianlijiangshan" },
  { file: "huaniao.html", api: "HuaniaoGallery", initial: "wuniutu" },
];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".task": "application/octet-stream",
  ".wasm": "application/wasm",
};

function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(DIST, pathname.replace(/^\/+/, "") || "index.html");
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

async function waitForHall(page) {
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, { timeout: 60000 });
  await page.waitForTimeout(700);
}

async function verifyHall(page, hall, baseUrl) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/${hall.file}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForHall(page);

  const sceneBox = await page.locator("#gallery").boundingBox();
  if (!sceneBox) throw new Error(`${hall.file} 三维画布不可见`);
  await page.mouse.click(sceneBox.x + sceneBox.width * 0.5, sceneBox.y + sceneBox.height * 0.4);
  await page.waitForFunction(
    () => document.querySelector("#art-viewer").classList.contains("open"),
    null,
    { timeout: 5000 },
  );
  const directTitle = await page.locator("#viewer-title").textContent();
  if (!directTitle) throw new Error(`${hall.file} 点击墙上画作没有打开放大查看器`);
  await page.click("#viewer-close");
  await page.waitForFunction(() => !document.querySelector("#art-viewer").classList.contains("open"));

  await page.evaluate(({ api, initial }) => window[api].openPainting(initial), hall);
  await page.click("#panel-preview");
  await page.waitForFunction(() => {
    const view = document.querySelector("#art-viewer");
    const image = document.querySelector("#viewer-image");
    return view.classList.contains("open") && image.complete && image.naturalWidth > 0;
  }, null, { timeout: 15000 });

  const opened = await page.evaluate(() => ({
    title: document.querySelector("#viewer-title").textContent,
    zoom: document.querySelector("#viewer-zoom-value").textContent,
    imageWidth: document.querySelector("#viewer-image").naturalWidth,
  }));
  if (!opened.title || opened.zoom !== "100%" || opened.imageWidth < 600) {
    throw new Error(`${hall.file} 放大查看器未正确初始化：${JSON.stringify(opened)}`);
  }
  await page.screenshot({
    path: path.join(OUT, `${hall.file.replace(".html", "")}-desktop.png`),
    animations: "disabled",
  });

  await page.click("#viewer-zoom-in");
  await page.waitForTimeout(220);
  const buttonZoom = await page.locator("#viewer-zoom-value").textContent();
  if (buttonZoom === "100%") throw new Error(`${hall.file} 放大按钮无效`);

  const stage = page.locator("#viewer-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error(`${hall.file} 放大画布不可见`);
  const transformBefore = await page.locator("#viewer-image").evaluate((image) => image.style.transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 36, { steps: 5 });
  await page.mouse.up();
  const transformAfter = await page.locator("#viewer-image").evaluate((image) => image.style.transform);
  if (transformAfter === transformBefore) throw new Error(`${hall.file} 放大后拖拽查看无效`);

  await page.mouse.wheel(0, -360);
  await page.waitForTimeout(120);
  const wheelZoom = await page.locator("#viewer-zoom-value").textContent();
  if (wheelZoom === buttonZoom) throw new Error(`${hall.file} 滚轮缩放无效`);

  const titleBefore = await page.locator("#viewer-title").textContent();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(180);
  const titleAfter = await page.locator("#viewer-title").textContent();
  if (titleBefore === titleAfter) throw new Error(`${hall.file} 放大状态下不能切换画作`);

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#art-viewer").classList.contains("open"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForHall(page);
  await page.evaluate(({ api, initial }) => window[api].openPainting(initial), hall);
  await page.click("#panel-preview");
  await page.waitForFunction(() => document.querySelector("#art-viewer").classList.contains("open"));
  const mobile = await page.evaluate(() => {
    const view = document.querySelector("#art-viewer").getBoundingClientRect();
    const image = document.querySelector("#viewer-image").getBoundingClientRect();
    return {
      view: { width: view.width, height: view.height },
      image: { width: image.width, height: image.height },
    };
  });
  if (mobile.view.width < 380 || mobile.image.width <= 0 || mobile.image.height <= 0) {
    throw new Error(`${hall.file} 移动端放大查看器布局异常：${JSON.stringify(mobile)}`);
  }
  await page.screenshot({
    path: path.join(OUT, `${hall.file.replace(".html", "")}-mobile.png`),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  console.log(`  ${hall.file.padEnd(14)} 放大 · 拖拽 · 滚轮 · 切换 · 移动端通过`);
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "shanshui.html")) || !fs.existsSync(path.join(DIST, "huaniao.html"))) {
    throw new Error("dist 内缺少展厅页面，请先运行 npm run build");
  }
  fs.mkdirSync(OUT, { recursive: true });
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-dev-shm-usage"],
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const hall of HALLS) {
      await verifyHall(page, hall, `http://127.0.0.1:${port}`);
    }
    if (errors.length) throw new Error(`浏览器运行错误：\n${errors.join("\n")}`);
    console.log(`OK 山水厅、花鸟厅画作放大查看器完整可用`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
