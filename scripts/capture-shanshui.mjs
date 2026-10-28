import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = process.env.SHANSHUI_URL || "http://127.0.0.1:4173/shanshui.html";
const OUT_DIR = "docs/shanshui-interior";
const parts = [
  ["column", "组员3-01-室内柱网-360度.png"],
  ["lattice-window", "组员3-02-室内窗棂-360度.png"],
  ["skylight", "组员3-03-室内天花开口-360度.png"],
  ["painting-frame", "组员3-04-室内画框-360度.png"],
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const failedRequests = [];

page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => {
  errors.push(error.message);
});
page.on("response", (response) => {
  if (response.status() >= 400) {
    failedRequests.push(`${response.status()} ${response.url()}`);
  }
});

async function waitForHall() {
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, {
    timeout: 25000,
  });
  await page.waitForTimeout(800);
}

for (const [part, fileName] of parts) {
  await page.goto(`${BASE_URL}?part=${part}`, { waitUntil: "networkidle" });
  await waitForHall();
  await page.screenshot({ path: `${OUT_DIR}/${fileName}` });
  console.log(`captured ${fileName}`);
}

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await waitForHall();
await page.screenshot({
  path: `${OUT_DIR}/组员3-05-山水厅整体内饰.png`,
});
console.log("captured 组员3-05-山水厅整体内饰.png");

await page.click('[data-exhibit="qianlijiangshan"]');
await page.waitForTimeout(950);
await page.screenshot({
  path: `${OUT_DIR}/组员3-08-画作说明面板.png`,
});
console.log("captured 组员3-08-画作说明面板.png");
await page.click("#panel-close");
await page.waitForTimeout(420);
await page.screenshot({
  path: `${OUT_DIR}/组员3-06-山水厅画作无遮挡.png`,
});
console.log("captured 组员3-06-山水厅画作无遮挡.png");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE_URL, { waitUntil: "networkidle" });
await waitForHall();
await page.screenshot({
  path: `${OUT_DIR}/组员3-07-山水厅移动端.png`,
});
console.log("captured 组员3-07-山水厅移动端.png");

const stats = await page.evaluate(() => window.ShanshuiHall.stats());
console.log("render stats", JSON.stringify(stats));

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await waitForHall();
const initial = await page.evaluate(() => window.ShanshuiHall.stats());

await page.mouse.move(720, 440);
await page.mouse.down();
await page.mouse.move(990, 350, { steps: 8 });
await page.mouse.up();
await page.keyboard.down("w");
await page.keyboard.down("a");
await page.waitForTimeout(450);
await page.keyboard.up("w");
await page.keyboard.up("a");

const fixed = await page.evaluate(() => window.ShanshuiHall.stats());
if (
  fixed.camera.join(",") !== initial.camera.join(",") ||
  fixed.yaw !== initial.yaw ||
  fixed.pitch !== initial.pitch
) {
  throw new Error(`Camera moved despite fixed-orientation mode: ${JSON.stringify({ initial, fixed })}`);
}

await page.keyboard.press("ArrowRight");
const afterArrow = await page.evaluate(() => window.ShanshuiHall.stats());
if (afterArrow.activeExhibit === initial.activeExhibit) {
  throw new Error("ArrowRight did not switch to the next painting");
}

await page.keyboard.press("e");
const afterOpen = await page.evaluate(() => window.ShanshuiHall.stats());
if (!afterOpen.panelOpen) throw new Error("E did not open the active painting");
await page.keyboard.press("q");
const afterClose = await page.evaluate(() => window.ShanshuiHall.stats());
if (afterClose.panelOpen) throw new Error("Q did not close the painting panel");

const gestureTurn = await page.evaluate(() => {
  window.ShanshuiHall.handleGestureState({ turn: 0.8, pinchPressed: false }, performance.now() + 1000);
  return window.ShanshuiHall.stats();
});
if (gestureTurn.activeExhibit === afterClose.activeExhibit) {
  throw new Error("Gesture turn did not switch paintings");
}

const gesturePinch = await page.evaluate(() => {
  window.ShanshuiHall.handleGestureState({ turn: 0, pinchPressed: true }, performance.now() + 2000);
  return window.ShanshuiHall.stats();
});
if (!gesturePinch.panelOpen) throw new Error("Gesture pinch did not open the painting panel");

const gesturePinchClose = await page.evaluate(() => {
  window.ShanshuiHall.handleGestureState({ turn: 0, pinchPressed: true }, performance.now() + 3000);
  return window.ShanshuiHall.stats();
});
if (gesturePinchClose.panelOpen) throw new Error("Gesture pinch did not close the painting panel");

console.log("fixed-camera", JSON.stringify({
  initial: initial.camera,
  afterDragAndWasd: fixed.camera,
  afterArrow: afterArrow.activeExhibit,
  gestureTurn: gestureTurn.activeExhibit,
  gesturePinchOpened: gesturePinch.panelOpen,
  gesturePinchClosed: !gesturePinchClose.panelOpen,
}));

const loadedParts = await page.evaluate(() => window.ShanshuiHall.parts);
if (loadedParts.length !== 4) {
  throw new Error(`Expected four loaded parts, received: ${loadedParts.join(", ")}`);
}

await page.goto(`${BASE_URL}?part=column`, { waitUntil: "networkidle" });
await waitForHall();
const partStart = await page.evaluate(() => window.ShanshuiHall.stats());
await page.waitForTimeout(800);
const partEnd = await page.evaluate(() => window.ShanshuiHall.stats());
if (partStart.camera.join(",") === partEnd.camera.join(",")) {
  throw new Error("Part preview is not auto-rotating");
}

await browser.close();

if (errors.length || failedRequests.length) {
  console.error("Console errors:", errors);
  console.error("Failed requests:", failedRequests);
  process.exitCode = 1;
} else {
  console.log("No console errors or failed requests.");
}
