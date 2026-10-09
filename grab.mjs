import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" });
const pages = [
  { name: "monalisa", url: "https://www.wikiart.org/en/leonardo-da-vinci/mona-lisa" },
  { name: "starrynight", url: "https://www.wikiart.org/en/vincent-van-gogh/the-starry-night-1889" },
];
for (const p of pages) {
  try {
    await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);
    const info = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"))
        .map(i => ({ src: i.src, w: i.naturalWidth, h: i.naturalHeight }))
        .filter(o => o.src.includes("uploads") && o.w > 300);
      return imgs.slice(0, 5);
    });
    console.log("=== " + p.name + " ===");
    info.forEach(o => console.log("  " + o.w + "x" + o.h + "  " + o.src));
    if (!info.length) console.log("  (无大图，尝试截图页面)");
    await page.screenshot({ path: "shots6/" + p.name + "-page.png" });
  } catch (e) {
    console.log("=== " + p.name + " 失败: " + e.message.slice(0, 80));
  }
}
await browser.close();