/* Runtime stability probe for CloudBase / local builds.
 * Usage:
 *   node scripts/diagnose-runtime.mjs [url] [seconds]
 */
import { chromium } from "playwright";

const url = process.argv[2] || "https://underlying-cod-d0giu66jjea02ff98-1525670478.tcloudbaseapp.com/?diag=1";
const duration = Math.max(10, Number(process.argv[3]) || 45);
const errors = [];
const warnings = [];
const failed = [];
const crashes = [];
const fpsLogs = [];

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--enable-precise-memory-info",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const T = window.THREE;
    if (!T || !T.WebGLRenderer || T.WebGLRenderer.__runtimeProbePatched) return;
    const originalRender = T.WebGLRenderer.prototype.render;
    T.WebGLRenderer.prototype.render = function (scene, camera) {
      window.__runtimeRenderer = this;
      window.__runtimeScene = scene;
      window.__runtimeCamera = camera;
      return originalRender.apply(this, arguments);
    };
    T.WebGLRenderer.__runtimeProbePatched = true;
  }, true);
});
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error") errors.push(text);
  else if (msg.type() === "warning") warnings.push(text);
  else if (text.includes("[帧率]")) fpsLogs.push(text);
});
page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message));
page.on("requestfailed", (req) => failed.push(req.url() + " :: " + (req.failure()?.errorText || "failed")));
page.on("crash", () => crashes.push("PAGE CRASH"));

function nowStamp() { return new Date().toISOString().slice(11, 19); }
async function snapshot(tag) {
  const perf = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(perf.metrics.map((x) => [x.name, x.value]));
  const memoryPromise = page.evaluate(() => {
    const scene = window.__runtimeScene;
    const renderer = window.__runtimeRenderer;
    const counts = { objects: 0, meshes: 0, instanced: 0, lights: 0, shadowCasters: 0, geometries: 0, materials: 0, textures: 0 };
    const geoms = new Set(), mats = new Set(), texs = new Set();
    if (scene) scene.traverse((node) => {
      counts.objects++;
      if (node.isMesh) {
        counts.meshes++;
        if (node.isInstancedMesh) counts.instanced++;
        if (node.castShadow) counts.shadowCasters++;
        if (node.geometry) geoms.add(node.geometry.uuid);
        if (node.material) {
          const list = Array.isArray(node.material) ? node.material : [node.material];
          list.forEach((mat) => {
            mats.add(mat.uuid);
            ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "emissiveMap"].forEach((key) => {
              if (mat[key]) texs.add(mat[key].uuid);
            });
          });
        }
      }
      if (node.isLight) counts.lights++;
    });
    counts.geometries = geoms.size; counts.materials = mats.size; counts.textures = texs.size;
    return {
      heap: performance.memory ? performance.memory.usedJSHeapSize : null,
      dom: document.getElementsByTagName("*").length,
      canvases: document.querySelectorAll("canvas").length,
      videos: document.querySelectorAll("video").length,
      title: document.title,
      visibility: document.visibilityState,
      bodyText: document.body.innerText.slice(0, 180),
      runtime: window.MuseumMain && window.MuseumMain.getRuntimeStats ? window.MuseumMain.getRuntimeStats() : null,
      renderer: renderer ? {
        size: [renderer.domElement.width, renderer.domElement.height],
        cssSize: [renderer.domElement.clientWidth, renderer.domElement.clientHeight],
        pixelRatio: renderer.getPixelRatio(),
        calls: renderer.info?.render?.calls,
        triangles: renderer.info?.render?.triangles,
        points: renderer.info?.render?.points,
        geometries: renderer.info?.memory?.geometries,
        textures: renderer.info?.memory?.textures,
        shadowMap: renderer.shadowMap?.enabled,
      } : null,
      scene: counts,
    };
  });
  const memory = await Promise.race([
    memoryPromise,
    new Promise((resolve) => setTimeout(() => resolve({ error: "page.evaluate timeout" }), 6000)),
  ]).catch((e) => ({ error: e.message }));
  console.log(JSON.stringify({
    at: nowStamp(), tag,
    jsHeapMB: m.JSHeapUsedSize == null ? null : +(m.JSHeapUsedSize / 1048576).toFixed(1),
    nodes: m.Nodes,
    layouts: m.LayoutCount,
    taskMs: +(m.TaskDuration * 1000).toFixed(0),
    memory,
    fpsTail: fpsLogs.slice(-2),
    errorsTail: errors.slice(-3),
    crashCount: crashes.length,
    failedTail: failed.slice(-3),
  }));
}

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(800);
  const confirm = page.locator("#submitBtn");
  if (await confirm.count()) {
    await page.waitForTimeout(3500);
    await confirm.click({ force: true }).catch(() => {});
  }
  await page.evaluate(() => {
    const T = window.THREE;
    if (!T || !T.WebGLRenderer || T.WebGLRenderer.__runtimeProbePatched) return;
    const originalRender = T.WebGLRenderer.prototype.render;
    T.WebGLRenderer.prototype.render = function (scene, camera) {
      window.__runtimeRenderer = this;
      window.__runtimeScene = scene;
      window.__runtimeCamera = camera;
      return originalRender.apply(this, arguments);
    };
    T.WebGLRenderer.__runtimeProbePatched = true;
  }).catch(() => {});  const enter = page.locator("#introEnter");
  try {
    await enter.waitFor({ state: "visible", timeout: 15000 });
    await enter.click({ force: true });
  } catch (_) {
    await page.evaluate(() => {
      const intro = document.getElementById("intro");
      if (intro) { intro.classList.add("bye"); intro.style.display = "none"; }
      if (window.MuseumMain && MuseumMain.setSceneActive) MuseumMain.setSceneActive(true);
    });
  }
  await page.evaluate(() => {
    window.__runtimeProbe = { frames: 0, longTasks: 0, glLost: 0 };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((ts) => { window.__runtimeProbe.frames++; return cb(ts); });
    document.addEventListener("webglcontextlost", () => { window.__runtimeProbe.glLost++; }, true);
    if (window.PerformanceObserver) {
      try { new PerformanceObserver((list) => { window.__runtimeProbe.longTasks += list.getEntries().length; }).observe({ type: "longtask", buffered: true }); } catch (_) {}
    }
  });
  await page.waitForTimeout(8000);
  await snapshot("entered");
  await page.keyboard.down("w");
  const steps = Math.ceil(duration / 5);
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(5000);
    await snapshot("walk-" + i);
  }
  await page.keyboard.up("w");
  const probe = await page.evaluate(() => ({ ...window.__runtimeProbe, heap: performance.memory?.usedJSHeapSize ?? null }));
  console.log("RUNTIME_PROBE " + JSON.stringify(probe));
} catch (error) {
  console.error("DIAGNOSTIC_ERROR " + error.stack);
} finally {
  console.log("SUMMARY " + JSON.stringify({
    errors, warnings: warnings.slice(-10), failed: failed.slice(-10), crashes, fpsLogs: fpsLogs.slice(-6)
  }, null, 2));
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}