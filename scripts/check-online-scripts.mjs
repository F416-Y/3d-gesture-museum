import { chromium } from "playwright";
const url = process.argv[2] || "https://underlying-cod-d0giu66jjea02ff98-1525670478.tcloudbaseapp.com/?v=script-check";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const bad = [];
page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
if (await page.locator("#submitBtn").count()) {
  await page.waitForTimeout(3500);
  await page.locator("#submitBtn").click({ force: true });
}
await page.waitForTimeout(6000);
console.log(JSON.stringify({ gotoStatus: response && response.status(), gotoUrl: page.url(), title: await page.title(), html: (await page.content()).slice(0, 220), bad, state: await page.evaluate(() => ({ three: typeof window.THREE, config: typeof window.MuseumConfig, ui: typeof window.MuseumUI, main: typeof window.MuseumMain, intro: document.getElementById("intro")?.className })) }, null, 2));
await browser.close();