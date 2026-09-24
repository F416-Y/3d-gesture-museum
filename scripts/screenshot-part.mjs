import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = 'C:\\Users\\29214\\.codex\\visualizations\\2026\\09\\20\\01a0bece-7be4-7ab2-b363-e4ce153a7eed';
const pageFile = path.resolve(__dirname, '..', 'public', 'part-window-wall.html');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.goto('file:///' + pageFile.replace(/\\/g, '/'));

for (var i = 0; i < 3; i++) {
  await page.waitForTimeout(1500);
  const outFile = path.join(outDir, 'part-window-wall-' + i + '.png');
  await page.screenshot({ path: outFile, fullPage: false });
  console.log('saved', outFile);
}

await browser.close();
