/* 临时：无头浏览器打开场景截图自查（用完即删） */
const { chromium } = require('D:/University/2026-2027/semester1/鉴赏类作业/美术鉴赏/3d-gesture-museum/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/exterior-layout.html';
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); }
    else { res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(d); }
  });
});
srv.listen(0, async () => {
  const port = srv.address().port;
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); }
  catch (e1) { browser = await chromium.launch({ channel: 'chrome' }); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', m => { const t = m.text(); if (/接线|错误|error|Error|warn|Warn|404/.test(t)) console.log('[console]', t); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(-60)));
  await page.goto('http://127.0.0.1:' + port + '/exterior-layout.html');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(__dirname, '_shot-default.png') });
  try { await page.click('button[data-v="renwu"]'); } catch (e) { console.log('click fail', e.message); }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(__dirname, '_shot-renwu.png') });
  /* 自由机位：人物馆室内（看将军俑/马踏飞燕/展示架） */
  await page.evaluate(() => window.__flyTo(36.75, 1.8, -15.6, 36.75, 1.1, -20));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '_shot-hall.png') });
  /* 自由机位：花鸟馆室内（看架排长案） */
  await page.evaluate(() => window.__flyTo(0, 1.9, -29, 0, 1.1, -36));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '_shot-hall2.png') });
  try { await page.click('button[data-v="xuting"]'); } catch (e) { console.log('click fail', e.message); }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(__dirname, '_shot-xuting.png') });
  /* 诊断：石狮代码件状态 */
  const diag = await page.evaluate(() => {
    const S = window.MuseumScene;
    if (!S || !S.slots) return 'no slots';
    return S.slots.lion.map(L => ({ x: L.x, y: L.y, z: L.z, codeHidden: !L.group.visible }));
  });
  console.log('[diag]', JSON.stringify(diag));
  /* 绕到序厅院内（北侧）回看大门，看高台上的石狮 */
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(1080, 330, { steps: 20 });
  await page.mouse.up();
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, '_shot-lions.png') });
  await browser.close();
  srv.close();
  console.log('DONE');
});
