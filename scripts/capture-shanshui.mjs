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
await page.keyboard.down("w");
await page.waitForTimeout(700);
await page.keyboard.up("w");
const moved = await page.evaluate(() => window.ShanshuiHall.stats());
if (moved.position.z >= initial.position.z - 0.2) {
  throw new Error(`Keyboard movement did not advance toward the paintings: ${initial.position.z} -> ${moved.position.z}`);
}

await page.keyboard.down("w");
await page.waitForTimeout(4200);
await page.keyboard.up("w");
const bounded = await page.evaluate(() => window.ShanshuiHall.stats());
if (bounded.position.z < -5.001 || bounded.position.z > 5.001) {
  throw new Error(`Player left the hall bounds: z=${bounded.position.z}`);
}
console.log("movement", JSON.stringify({ initial: initial.position, moved: moved.position, bounded: bounded.position }));

const loadedParts = await page.evaluate(() => window.ShanshuiHall.parts);
if (loadedParts.length !== 4) {
  throw new Error(`Expected four loaded parts, received: ${loadedParts.join(", ")}`);
}

await browser.close();

if (errors.length || failedRequests.length) {
  console.error("Console errors:", errors);
  console.error("Failed requests:", failedRequests);
  process.exitCode = 1;
} else {
  console.log("No console errors or failed requests.");
}
