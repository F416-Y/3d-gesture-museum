/* ============================================================
 * intro.js —— 开场水墨加载页：呼吸墨团 + 宣纸肌理 + 以笔引墨
 * 来源：外观原型 tools/exterior-prototype.html（Kimi 原作），2026-10-04 由组长原样迁入。
 *  - 4 个预设：青铜鼎 / 石狮 / 马踏飞燕 / 外观整体（现采主场景）
 *  - 加载阶段不显示 3D 模型，只保留一团有湿边、飞白与渗化的水墨
 *  - 手势：原型用老版 MediaPipe Hands（window.Hands），主项目不分发该库，
 *          2026-10-09 已删除残留的 CDN 加载代码 → 序章固定走鼠标 / 触摸模式
 *  - 唯一改动：压轴采样主场景的句柄改为本项目（MuseumExteriorLayout.ctx.scene）
 * ============================================================ */

/* =====================================================================
 * 开场粒子序章：Three.js 粒子云（鼠标 / 触摸交互）
 *  - 拖动鼠标 → 模型旋转，按住 → 粒子扩散；手势漫游留给进馆后的主场景
 *  - 预设模型取自本馆零件库 glb（表面均匀采样为粒子），加载失败回退程序化造型
 *  - 辉光 = 径向渐变精灵 + 双层叠加（核心亮点 + 外圈光晕），加法混合
 *  - 色相随旋转角连续偏移；基色 / 密度可调；深空星尘背景
 * ===================================================================== */
(function () {
  if (window.MuseumInteriorOnly) {
    var interiorIntro = document.getElementById('intro');
    if (interiorIntro) interiorIntro.style.display = 'none';
    return;
  }
  var overlay = document.getElementById('intro');
  if (!overlay || !window.THREE) return;
  var canvas = document.getElementById('introCanvas');
  var inkFx = document.getElementById('introInkFx');
  var fx = inkFx ? inkFx.getContext('2d') : null;
  var statusEl = document.getElementById('introStatus');
  var inkCursor = document.getElementById('inkCursor');
  var inkRevealBrush = document.getElementById('inkRevealBrush');
  var enterBtn = document.getElementById('introEnter');
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reducedMotion = motionQuery.matches;
  var trailPoints = [];
  var lastTrail = 0;
  var inkHover = 0;
  var inkPress = 0;
  var revealStarted = false;
  var revealStartedAt = 0;
  var orbitActive = false;
  var orbitClock = 0;
  var unfoldStarted = false;
  var unfoldClock = 0;
  var unfoldMix = 0;
  var modelReady = false;
  var pointer = { x: -100, y: -100, inside: false, pressed: false, ui: true };
  var cursorMotion = { x: 0, y: 0, tilt: 0 };
  function setStatus(s) { statusEl.textContent = s; }

  function onMotionPreferenceChange(event) {
    reducedMotion = event.matches;
    if (reducedMotion) {
      trailPoints = [];
      cursorMotion.tilt = 0;
    }
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionPreferenceChange);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionPreferenceChange);

  function isUiTarget(target) {
    return !!(target && target.closest && target.closest('button,a,input,label'));
  }

  function isBrandArea(x, y) {
    var mark = document.getElementById('introMark');
    if (!mark) return false;
    var r = mark.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function brushCoversControls() {
    if (!inkCursor) return false;
    var brushRect = inkCursor.getBoundingClientRect();
    var controls = overlay.querySelectorAll('button,a,input');
    for (var ci = 0; ci < controls.length; ci++) {
      var controlRect = controls[ci].getBoundingClientRect();
      if (
        brushRect.right > controlRect.left - 4 &&
        brushRect.left < controlRect.right + 4 &&
        brushRect.bottom > controlRect.top - 4 &&
        brushRect.top < controlRect.bottom + 4
      ) return true;
    }
    return false;
  }

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);   /* 透明底，露出 CSS 宣纸渐变 */
  renderer.outputEncoding = THREE.sRGBEncoding;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 160);
  camera.position.set(0, 0.3, 6.5);

  /* ---------- 辉光精灵贴图 ---------- */
  function makeGlow() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = makeGlow();
  function makeInkDot() {
    var c = document.createElement('canvas'); c.width = c.height = 96;
    var x = c.getContext('2d'), i, a, rr, ang;
    x.clearRect(0, 0, 96, 96);
    for (i = 0; i < 13; i++) {
      a = Math.random() * Math.PI * 2; rr = 20 + Math.random() * 22;
      x.beginPath();
      x.arc(48 + Math.cos(a) * (Math.random() * 7), 48 + Math.sin(a) * (Math.random() * 7), rr, 0, Math.PI * 2);
      x.fillStyle = 'rgba(35, 43, 48, ' + (0.025 + Math.random() * 0.055) + ')'; x.fill();
    }
    var g = x.createRadialGradient(48, 48, 3, 48, 48, 42);
    g.addColorStop(0, 'rgba(30, 37, 42, 0.92)');
    g.addColorStop(0.46, 'rgba(43, 52, 58, 0.62)');
    g.addColorStop(0.78, 'rgba(75, 82, 82, 0.2)');
    g.addColorStop(1, 'rgba(75, 82, 82, 0)');
    x.fillStyle = g; x.fillRect(4, 4, 88, 88);
    return new THREE.CanvasTexture(c);
  }
  var inkDotTex = makeInkDot();

  function makeInkWashTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 1024;
    var x = c.getContext('2d');
    var random = (function (seed) {
      var state = seed >>> 0;
      return function () {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    })(1037);
    var centerX = 512;
    var centerY = 520;

    function blobPath(ctx) {
      var points = [];
      for (var p = 0; p < 26; p++) {
        var angle = p / 26 * Math.PI * 2;
        var wobble =
          1 +
          Math.sin(angle * 3 + 0.7) * 0.095 +
          Math.sin(angle * 7 - 1.2) * 0.045 +
          (random() - 0.5) * 0.035;
        points.push({
          x: centerX + Math.cos(angle) * 326 * wobble,
          y: centerY + Math.sin(angle) * 235 * wobble
        });
      }
      ctx.beginPath();
      ctx.moveTo((points[0].x + points[1].x) * 0.5, (points[0].y + points[1].y) * 0.5);
      for (var i = 1; i <= points.length; i++) {
        var current = points[i % points.length];
        var next = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
      }
      ctx.closePath();
    }

    /* 外围淡墨先洇开，形成不规则湿边。 */
    x.save();
    x.filter = 'blur(18px)';
    blobPath(x);
    x.fillStyle = 'rgba(42, 53, 49, 0.24)';
    x.fill();
    x.restore();

    for (var h = 0; h < 9; h++) {
      var ha = h / 9 * Math.PI * 2 + random() * 0.4;
      var hx = centerX + Math.cos(ha) * (190 + random() * 130);
      var hy = centerY + Math.sin(ha) * (120 + random() * 85);
      var hr = 70 + random() * 105;
      var halo = x.createRadialGradient(hx, hy, 0, hx, hy, hr);
      halo.addColorStop(0, 'rgba(43, 54, 50, ' + (0.055 + random() * 0.05).toFixed(3) + ')');
      halo.addColorStop(0.7, 'rgba(43, 54, 50, ' + (0.028 + random() * 0.025).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(43, 54, 50, 0)');
      x.fillStyle = halo;
      x.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    }

    /* 墨团主体由多层灰青墨积成，中心浓、边缘薄。 */
    x.save();
    blobPath(x);
    x.clip();
    x.fillStyle = 'rgba(36, 45, 41, 0.58)';
    x.fillRect(0, 0, 1024, 1024);
    var core = x.createRadialGradient(centerX - 18, centerY - 22, 24, centerX, centerY, 350);
    core.addColorStop(0, 'rgba(16, 23, 21, 0.34)');
    core.addColorStop(0.5, 'rgba(20, 28, 25, 0.18)');
    core.addColorStop(1, 'rgba(25, 33, 30, 0)');
    x.fillStyle = core;
    x.fillRect(0, 0, 1024, 1024);
    for (var i = 0; i < 72; i++) {
      var angle = random() * Math.PI * 2;
      var distance = Math.pow(random(), 0.56) * 290;
      var px = centerX + Math.cos(angle) * distance;
      var py = centerY + Math.sin(angle) * distance * 0.64;
      var radius = 36 + random() * 112;
      var shade = 25 + Math.floor(random() * 34);
      var wash = x.createRadialGradient(px, py, radius * 0.03, px, py, radius);
      wash.addColorStop(0, 'rgba(' + shade + ',' + (shade + 8) + ',' + (shade + 5) + ',' + (0.075 + random() * 0.16).toFixed(3) + ')');
      wash.addColorStop(0.48, 'rgba(' + shade + ',' + (shade + 8) + ',' + (shade + 5) + ',' + (0.035 + random() * 0.065).toFixed(3) + ')');
      wash.addColorStop(1, 'rgba(43, 53, 49, 0)');
      x.fillStyle = wash;
      x.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }

    /* 干笔擦出纤维与飞白，保留宣纸底色，不做均匀透明。 */
    x.globalCompositeOperation = 'destination-out';
    for (var s = 0; s < 58; s++) {
      var sx = 220 + random() * 590;
      var sy = 300 + random() * 430;
      var sx2 = sx + 26 + random() * 118;
      var sy2 = sy - 12 + random() * 24;
      x.strokeStyle = 'rgba(0, 0, 0, ' + (0.08 + random() * 0.18).toFixed(3) + ')';
      x.lineWidth = 0.7 + random() * 4.2;
      x.beginPath();
      x.moveTo(sx, sy);
      x.bezierCurveTo(sx + 22, sy - 8, sx2 - 28, sy2 + 7, sx2, sy2);
      x.stroke();
    }
    for (var f = 0; f < 90; f++) {
      var fx = 235 + random() * 555;
      var fy = 320 + random() * 380;
      x.strokeStyle = 'rgba(0, 0, 0, ' + (0.035 + random() * 0.075).toFixed(3) + ')';
      x.lineWidth = 0.45 + random() * 0.7;
      x.beginPath();
      x.moveTo(fx, fy);
      x.lineTo(fx + 14 + random() * 44, fy - 2 + random() * 4);
      x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
    x.restore();

    /* 湿边积墨：深边、断续重笔和极细的渗化毛边。 */
    x.save();
    blobPath(x);
    x.strokeStyle = 'rgba(24, 32, 29, 0.28)';
    x.lineWidth = 25;
    x.stroke();
    x.strokeStyle = 'rgba(18, 25, 22, 0.42)';
    x.lineWidth = 7;
    x.stroke();
    x.setLineDash([2, 11, 34, 8]);
    x.strokeStyle = 'rgba(12, 18, 16, 0.48)';
    x.lineWidth = 2.2;
    x.stroke();
    x.setLineDash([]);
    x.restore();

    /* 少量飞溅墨点，大小与浓淡错落。 */
    for (var d = 0; d < 42; d++) {
      var da = random() * Math.PI * 2;
      var dr = 245 + random() * 145;
      var dotX = centerX + Math.cos(da) * dr;
      var dotY = centerY + Math.sin(da) * dr * 0.68;
      var dotR = 0.6 + Math.pow(random(), 2.4) * 4.5;
      x.fillStyle = 'rgba(22, 30, 27, ' + (0.14 + random() * 0.3).toFixed(3) + ')';
      x.beginPath();
      x.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      x.fill();
      if (dotR > 2.6 && random() > 0.64) {
        x.fillStyle = 'rgba(22, 30, 27, 0.2)';
        x.beginPath();
        x.arc(dotX + 6 + random() * 10, dotY - 4 + random() * 8, 0.7 + random() * 1.2, 0, Math.PI * 2);
        x.fill();
      }
    }
    return c;
  }

  var inkWashTexture = makeInkWashTexture();

  function resizeFx() {
    if (!fx || !inkFx) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    var width = Math.round(window.innerWidth * ratio);
    var height = Math.round(window.innerHeight * ratio);
    if (inkFx.width !== width || inkFx.height !== height) {
      inkFx.width = width;
      inkFx.height = height;
      fx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }

  function smoothStep(value) {
    value = Math.max(0, Math.min(1, value));
    return value * value * (3 - 2 * value);
  }

  function getInkBaseSize() {
    return window.innerWidth < 760
      ? Math.min(window.innerWidth * 0.72, window.innerHeight * 0.36, 284)
      : Math.min(window.innerWidth * 0.44, window.innerHeight * 0.58, 440);
  }

  function beginReveal() {
    if (revealStarted || !enterBtn) return;
    revealStarted = true;
    revealStartedAt = performance.now();
    orbitActive = true;
    orbitClock = 0;
    unfoldStarted = false;
    unfoldClock = 0;
    unfoldMix = 0;
    trailPoints = [];
    introPresetIndex = 0;
    introPresetClock = 0;
    introPresetSequenceStarted = false;
    introPresetSequenceDone = false;
    cur = 0;
    pointer.ui = true;
    if (inkCursor) inkCursor.classList.remove('visible');
    overlay.classList.add('revealing');
    if (!store[PRESETS[cur].id]) modelReady = false;
    /* 首个预设决定开场能否启动，其余三个并行预加载，避免轮播时出现空帧。 */
    for (var presetIndex = 0; presetIndex < introPresetCount; presetIndex++) {
      loadPreset(PRESETS[presetIndex]);
    }
    setStatus(reducedMotion ? '墨色化形' : '引笔绕墨 · 静候成形');
  }

  /* 淡墨远山三叠：大幅柔边墨团，缓慢漂移，衬出水墨纵深 */
  function makeBlob() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(96,92,84,0.5)');
    g.addColorStop(0.55, 'rgba(96,92,84,0.18)');
    g.addColorStop(1, 'rgba(96,92,84,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  var blobTex = makeBlob(), blobs = [], bi;
  for (bi = 0; bi < 3; bi++) {
    var bm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: blobTex, transparent: true, opacity: 0.05 + bi * 0.018, depthWrite: false
    }));
    bm.position.set((bi - 1) * 7.5, 1.6 - bi * 1.3, -8 - bi * 3);
    bm.scale.set(10 + bi * 4, 6 + bi * 3, 1);
    bm.userData.bx = bm.position.x;
    scene.add(bm); blobs.push(bm);
  }

  /* ---------- 墨形粒子云（只在墨团显形后启用） ---------- */
  var tmpC = new THREE.Color(), i, r;
  var MAXN = 30000;
  var pos = new Float32Array(MAXN * 3);
  var col = new Float32Array(MAXN * 3);
  var base = new Float32Array(MAXN * 3);
  var hueOff = new Float32Array(MAXN);
  var phase = new Float32Array(MAXN);
  for (i = 0; i < MAXN; i++) {
    hueOff[i] = (Math.random() - 0.5) * 0.3;   /* 兼作墨分五色的浓淡偏移 */
    phase[i] = Math.random() * Math.PI * 2;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  var cloud = new THREE.Group();
  /* 墨点核心：普通混合，叠处更浓，正是积墨效果 */
  cloud.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.075, map: inkDotTex, vertexColors: true, transparent: true, opacity: 0.82,
    depthWrite: false, blending: THREE.NormalBlending
  })));
  /* 晕墨层：大一号淡墨，作洇开的边缘 */
  cloud.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.2, map: glowTex, vertexColors: true, transparent: true, opacity: 0.1,
    depthWrite: false, blending: THREE.NormalBlending
  })));
  cloud.visible = false;
  scene.add(cloud);

  /* ---------- 程序化回退造型（glb 加载失败时用） ---------- */
  function mkPts() { return { a: new Float32Array(MAXN * 3), i: 0 }; }
  function pBox(o, cx, cy, cz, w, h, d, n) {
    var k, f, u, v, x, y, z;
    for (k = 0; k < n && o.i < MAXN; k++, o.i++) {
      f = Math.floor(Math.random() * 6); u = Math.random() - 0.5; v = Math.random() - 0.5;
      if (f === 0) { x = w / 2; y = v * h; z = u * d; } else if (f === 1) { x = -w / 2; y = v * h; z = u * d; }
      else if (f === 2) { y = h / 2; x = u * w; z = v * d; } else if (f === 3) { y = -h / 2; x = u * w; z = v * d; }
      else if (f === 4) { z = d / 2; x = u * w; y = v * h; } else { z = -d / 2; x = u * w; y = v * h; }
      o.a[o.i * 3] = cx + x; o.a[o.i * 3 + 1] = cy + y; o.a[o.i * 3 + 2] = cz + z;
    }
  }
  function pCyl(o, cx, cy, cz, r, h, n) {
    var k, t, rr, x, y, z;
    for (k = 0; k < n && o.i < MAXN; k++, o.i++) {
      t = Math.random() * Math.PI * 2;
      if (Math.random() < 0.82) { x = r * Math.cos(t); z = r * Math.sin(t); y = (Math.random() - 0.5) * h; }
      else { rr = r * Math.sqrt(Math.random()); x = rr * Math.cos(t); z = rr * Math.sin(t); y = (Math.random() < 0.5 ? -1 : 1) * h / 2; }
      o.a[o.i * 3] = cx + x; o.a[o.i * 3 + 1] = cy + y; o.a[o.i * 3 + 2] = cz + z;
    }
  }
  function pSph(o, cx, cy, cz, rx, ry, rz, n) {
    var k, t, p2, nx, ny, nz;
    for (k = 0; k < n && o.i < MAXN; k++, o.i++) {
      t = Math.random() * Math.PI * 2; p2 = Math.acos(2 * Math.random() - 1);
      nx = Math.sin(p2) * Math.cos(t); ny = Math.cos(p2); nz = Math.sin(p2) * Math.sin(t);
      o.a[o.i * 3] = cx + nx * rx; o.a[o.i * 3 + 1] = cy + ny * ry; o.a[o.i * 3 + 2] = cz + nz * rz;
    }
  }
  function finPts(o) {
    var i;
    if (o.i < 10) return null;
    for (i = o.i; i < MAXN; i++) {
      var s = (i % o.i) * 3;
      o.a[i * 3] = o.a[s]; o.a[i * 3 + 1] = o.a[s + 1]; o.a[i * 3 + 2] = o.a[s + 2];
    }
    return normalizePts(o.a);
  }
  function normalizePts(a, target, count) {
    count = count || MAXN;
    var i, mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    for (i = 0; i < count; i++) {
      var x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
      if (z < mnz) mnz = z; if (z > mxz) mxz = z;
    }
    var cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2, cz = (mnz + mxz) / 2;
    var d = Math.max(mxx - mnx, mxy - mny, mxz - mnz), s = d > 1e-6 ? (target || 3.4) / d : 1;
    for (i = 0; i < count; i++) {
      a[i * 3] = (a[i * 3] - cx) * s;
      a[i * 3 + 1] = (a[i * 3 + 1] - cy) * s;
      a[i * 3 + 2] = (a[i * 3 + 2] - cz) * s;
    }
    return a;
  }
  function fbGate() {
    var o = mkPts();
    pBox(o, 0, 0.15, 0, 3.2, 0.3, 1.7, 2400);
    pCyl(o, -1.15, 1.55, 0, 0.22, 2.6, 2100);
    pCyl(o, 1.15, 1.55, 0, 0.22, 2.6, 2100);
    pBox(o, 0, 2.35, 0, 2.9, 0.42, 0.4, 1900);
    pBox(o, 0, 3.0, 0, 3.7, 0.55, 2.0, 5400);
    pBox(o, 0, 3.45, 0, 2.4, 0.32, 1.1, 2100);
    pCyl(o, -1.15, 3.05, 0, 0.3, 0.5, 400);
    pCyl(o, 1.15, 3.05, 0, 0.3, 0.5, 400);
    return finPts(o);
  }
  function fbDing() {
    var o = mkPts();
    pBox(o, 0, 1.65, 0, 1.9, 1.25, 1.35, 6800);
    pBox(o, 0, 1.65, 0, 2.02, 0.34, 1.47, 2400);
    pBox(o, 0, 2.35, 0, 2.1, 0.2, 1.55, 1700);
    pCyl(o, -0.68, 0.5, -0.5, 0.15, 1.0, 900); pCyl(o, 0.68, 0.5, -0.5, 0.15, 1.0, 900);
    pCyl(o, -0.68, 0.5, 0.5, 0.15, 1.0, 900); pCyl(o, 0.68, 0.5, 0.5, 0.15, 1.0, 900);
    pBox(o, -0.62, 2.78, 0, 0.2, 0.62, 0.28, 800);
    pBox(o, 0.62, 2.78, 0, 0.2, 0.62, 0.28, 800);
    return finPts(o);
  }
  function fbLion() {
    var o = mkPts();
    pBox(o, 0, 0.3, 0, 1.3, 0.6, 1.7, 2400);
    pSph(o, 0, 1.35, -0.1, 0.72, 0.85, 0.95, 6600);
    pSph(o, 0, 2.15, 0.45, 0.5, 0.48, 0.5, 4300);
    pSph(o, 0, 1.95, 0.85, 0.22, 0.18, 0.25, 1100);
    pCyl(o, -0.4, 0.9, 0.55, 0.16, 0.9, 900);
    pCyl(o, 0.4, 0.9, 0.55, 0.16, 0.9, 900);
    pSph(o, 0, 1.25, -0.95, 0.18, 0.5, 0.18, 700);
    return finPts(o);
  }
  function fbHorse() {
    var o = mkPts();
    pSph(o, 0, 1.5, 0, 0.5, 0.55, 1.05, 6100);
    pSph(o, 0, 2.25, 1.0, 0.2, 0.55, 0.3, 1700);
    pSph(o, 0, 2.72, 1.32, 0.16, 0.2, 0.42, 1300);
    pCyl(o, -0.28, 0.7, 0.6, 0.09, 1.3, 900); pCyl(o, 0.28, 0.7, 0.6, 0.09, 1.3, 900);
    pCyl(o, -0.28, 0.7, -0.6, 0.09, 1.3, 900); pCyl(o, 0.28, 0.7, -0.6, 0.09, 1.3, 900);
    pSph(o, 0, 1.6, -1.15, 0.12, 0.4, 0.3, 800);
    pBox(o, 0, 0.08, 0, 1.2, 0.16, 1.6, 800);
    pSph(o, 0, 0.26, 0.42, 0.16, 0.1, 0.26, 500);
    return finPts(o);
  }
  function fbRock() {
    var o = mkPts(), guard = 0;
    while (o.i < MAXN && guard++ < MAXN * 5) {
      var t = Math.random() * Math.PI * 2, p2 = Math.acos(2 * Math.random() - 1);
      var nx = Math.sin(p2) * Math.cos(t), ny = Math.cos(p2), nz = Math.sin(p2) * Math.sin(t);
      var w = Math.sin(nx * 3.1 + 1.7) * Math.sin(ny * 2.3 + 0.6) * Math.sin(nz * 2.7 + 2.9);
      if (w < -0.12) continue;
      var rr = 1.35 * (1 + 0.3 * w);
      o.a[o.i * 3] = nx * rr; o.a[o.i * 3 + 1] = ny * rr * 1.3 + 1.6; o.a[o.i * 3 + 2] = nz * rr;
      o.i++;
    }
    return finPts(o);
  }

  /* ---------- glb 表面均匀采样 ---------- */
  function sampleObject(root, count) {
    root.updateMatrixWorld(true);
    var tris = [], cum = [], total = 0;
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    var ab = new THREE.Vector3(), ac = new THREE.Vector3();
    root.traverse(function (n) {
      if (!n.isMesh) return;
      var p = n.geometry.attributes.position; if (!p) return;
      var idx = n.geometry.index, m = n.matrixWorld;
      var nt = idx ? idx.count / 3 : p.count / 3, t, i0, i1, i2, ar;
      for (t = 0; t < nt; t++) {
        i0 = idx ? idx.getX(t * 3) : t * 3;
        i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(p, i0).applyMatrix4(m);
        b.fromBufferAttribute(p, i1).applyMatrix4(m);
        c.fromBufferAttribute(p, i2).applyMatrix4(m);
        ab.subVectors(b, a); ac.subVectors(c, a);
        ar = ab.cross(ac).length() / 2;
        if (ar < 1e-8) continue;
        tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        total += ar; cum.push(total);
      }
    });
    if (!cum.length) return null;
    var out = new Float32Array(count * 3), k, lo, hi, mid, o, u, v, w;
    for (k = 0; k < count; k++) {
      r = Math.random() * total; lo = 0; hi = cum.length - 1;
      while (lo < hi) { mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      o = lo * 9;
      u = Math.random(); v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      w = 1 - u - v;
      out[k * 3] = tris[o] * w + tris[o + 3] * u + tris[o + 6] * v;
      out[k * 3 + 1] = tris[o + 1] * w + tris[o + 4] * u + tris[o + 7] * v;
      out[k * 3 + 2] = tris[o + 2] * w + tris[o + 5] * u + tris[o + 8] * v;
    }
    return normalizePts(out, 3.4, count);
  }

  /* ---------- 压轴：整馆场景表面采样（两遍法，不占大内存） ----------
     直接对主场景 window.MuseumScene.ctx.scene 做可见网格遍历，
     跳过 220m 外草坪，只留馆区（100×80），按各网格表面积配额采样 */
  function sampleMuseum(count) {
    var root = (window.MuseumScene && window.MuseumScene.ctx && window.MuseumScene.ctx.scene) || (window.MuseumExteriorLayout && window.MuseumExteriorLayout.ctx && window.MuseumExteriorLayout.ctx.scene) || null;
    if (!root) return null;
    root.updateMatrixWorld(true);
    var meshes = [];
    var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
    var e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    var bbs = new THREE.Vector3(), ws = new THREE.Vector3();
    function walk(n) {
      if (!n.visible) return;
      if (n.isMesh && n.geometry && n.geometry.attributes.position) {
        var geo = n.geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        geo.boundingBox.getSize(bbs);
        n.getWorldScale(ws);
        if (Math.max(bbs.x * ws.x, bbs.z * ws.z) <= 120) {
          meshes.push({ p: geo.attributes.position, idx: geo.index, m: n.matrixWorld });
        }
      }
      for (var ci = 0; ci < n.children.length; ci++) walk(n.children[ci]);
    }
    walk(root);
    if (!meshes.length) return null;
    function triArea(p, idx, m, t) {
      v1.fromBufferAttribute(p, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(m);
      v2.fromBufferAttribute(p, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(m);
      v3.fromBufferAttribute(p, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(m);
      e1.subVectors(v2, v1); e2.subVectors(v3, v1);
      return e1.cross(e2).length() / 2;
    }
    /* 第一遍：各网格总面积 */
    var areas = new Float64Array(meshes.length), total = 0, mi, t, nt, p, idx, m;
    for (mi = 0; mi < meshes.length; mi++) {
      p = meshes[mi].p; idx = meshes[mi].idx; m = meshes[mi].m;
      nt = idx ? idx.count / 3 : p.count / 3;
      var a2 = 0;
      for (t = 0; t < nt; t++) a2 += triArea(p, idx, m, t);
      areas[mi] = a2; total += a2;
    }
    if (total <= 0) return null;
    /* 第二遍：按面积配额逐网格采样，直接写进输出数组 */
    var out = new Float32Array(count * 3), off = 0;
    for (mi = 0; mi < meshes.length; mi++) {
      var quota = Math.floor(count * areas[mi] / total);
      if (quota < 1) continue;
      p = meshes[mi].p; idx = meshes[mi].idx; m = meshes[mi].m;
      nt = idx ? idx.count / 3 : p.count / 3;
      var cum = new Float64Array(nt), run = 0;
      for (t = 0; t < nt; t++) { run += triArea(p, idx, m, t); cum[t] = run; }
      if (run <= 0) continue;
      for (var k = 0; k < quota && off < count; k++, off++) {
        var r = Math.random() * run, lo = 0, hi = nt - 1;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        v1.fromBufferAttribute(p, idx ? idx.getX(lo * 3) : lo * 3).applyMatrix4(m);
        v2.fromBufferAttribute(p, idx ? idx.getX(lo * 3 + 1) : lo * 3 + 1).applyMatrix4(m);
        v3.fromBufferAttribute(p, idx ? idx.getX(lo * 3 + 2) : lo * 3 + 2).applyMatrix4(m);
        var u = Math.random(), v = Math.random();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        var w = 1 - u - v;
        out[off * 3] = v1.x * w + v2.x * u + v3.x * v;
        out[off * 3 + 1] = v1.y * w + v2.y * u + v3.y * v;
        out[off * 3 + 2] = v1.z * w + v2.z * u + v3.z * v;
      }
    }
    var filled = off;
    if (filled < 10) return null;
    for (; off < count; off++) {   /* 配额取整余下的回绕补齐 */
      var s0 = (off % filled) * 3;
      out[off * 3] = out[s0]; out[off * 3 + 1] = out[s0 + 1]; out[off * 3 + 2] = out[s0 + 2];
    }
    return normalizePts(out, 4.4);
  }

  function makeInkBlob() {
    var out = new Float32Array(MAXN * 3), j, a, b, c, rr, wobble;
    for (j = 0; j < MAXN; j++) {
      a = Math.random() * Math.PI * 2; b = Math.acos(2 * Math.random() - 1); c = Math.random();
      rr = Math.pow(c, 0.42) * (1.15 + Math.sin(j * 0.071) * 0.12);
      wobble = 1 + 0.1 * Math.sin(a * 5 + b * 3 + j * 0.013);
      out[j * 3] = Math.sin(b) * Math.cos(a) * rr * wobble;
      out[j * 3 + 1] = Math.cos(b) * rr * 0.76;
      out[j * 3 + 2] = Math.sin(b) * Math.sin(a) * rr * wobble;
    }
    return out;
  }

  /* ---------- 预设模型：三件馆藏零件 + 实际园区外观 ---------- */
  var PRESETS = [
    { id: 'bronze-ding', fb: fbDing },
    { id: 'stone-lion', fb: fbLion },
    { id: 'horse', fb: fbHorse },
    { id: '__museum', fb: null }        /* 第四段显示外观整体：从实际主场景采样 */
  ];
  var store = {}, cur = 0;
  var introPresetCount = 4; /* 青铜鼎、石狮、铜奔马、外观整体；不再单独展示树/石头 */
  var introPresetLabels = ['青铜方鼎', '石狮', '铜奔马', '园区外观'];
  var introPresetIndex = 0;
  var introPresetClock = 0;
  var introPresetSequenceStarted = false;
  var introPresetSequenceDone = false;
  var loader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
  function applyPreset(P) {
    if (!store[P.id]) return;
    base.set(store[P.id]);
    spread = 0.35; spreadT = 1;   /* 换模型时先聚后散，有重塑感 */
    if (P.id === '__museum') {
      rotXT = 0.55;               /* 三分俯视，呈现沙盘感 */
      if (density < 24000) {      /* 全园粒子多，自动提密度 */
        density = 24000;
        if (dEl) dEl.value = 24000;
        if (dVal) dVal.textContent = '24000 粒';
      }
    }
  }
  function finishPreset(P) {
    if (PRESETS[cur] !== P) return;
    modelReady = true;
    applyPreset(P);
    if (unfoldStarted) setStatus('墨色化形 · 轮廓渐显');
  }
  function loadPreset(P) {
    if (store[P.id]) { finishPreset(P); return; }
    if (P.id === '__museum') {
      setStatus('正在生成园区外观粒子…');
      var museumTries = 0;
      function captureMuseumWhenReady() {
        /* 中心桥是异步 GLB；必须等桥挂入主场景后再采样，避免外观模型缺桥。 */
        var root = (window.MuseumScene && window.MuseumScene.ctx && window.MuseumScene.ctx.scene) ||
          (window.MuseumExteriorLayout && window.MuseumExteriorLayout.ctx && window.MuseumExteriorLayout.ctx.scene);
        var bridgeReady = root && (root.getObjectByName('central-arch-bridge-glb') || root.getObjectByName('central-arch-bridge'));
        if ((!root || !bridgeReady) && museumTries++ < 75) {
          setTimeout(captureMuseumWhenReady, 80);
          return;
        }
        var pts = null;
        try { pts = sampleMuseum(MAXN); } catch (e) { pts = null; }
        store[P.id] = pts || fbGate();
        finishPreset(P);
        setStatus(handSeen ? '手势追踪中 · 张开手掌让粒子散开' : '园区外观就绪 · 移动鼠标旋转');
      }
      setTimeout(captureMuseumWhenReady, 30);
      return;
    }
    if (!loader) { store[P.id] = P.fb(); finishPreset(P); return; }
    loader.load('assets/models/parts/opt/' + P.id + '.glb', function (g) {
      var pts = null;
      try { pts = sampleObject(g.scene, 12000); } catch (e) { pts = null; }
      store[P.id] = pts || P.fb();
      finishPreset(P);
    }, undefined, function () {
      store[P.id] = P.fb();
      finishPreset(P);
    });
  }
  var revealDone = false;
  base.set(makeInkBlob());

  /* ---------- 交互状态 ---------- */
  var spread = 0.72, spreadT = 0.72;
  var rotX = 0, rotY = 0, rotXT = 0, rotYT = 0, spin = 0;
  var handSeen = false;
  var density = 9000;

  /* ---------- 交互模式：鼠标 / 触摸 ----------
   * 原型里另有一段老版 MediaPipe Hands（window.Hands / Camera）手势控制，
   * 但主项目不分发该库，这段代码从未执行，只留下一条 jsdelivr CDN 地址。
   * 2026-10-09 连同 onHand() 一并删除；手势漫游由进馆后的 js/gesture.js
   * （本地 MediaPipe Tasks Vision）提供，序章固定走鼠标 / 触摸。 */
  setStatus('引笔近墨 · 园境将开');

  /* ---------- 鼠标 / 触摸回退 ---------- */
  overlay.addEventListener('pointermove', function (e) {
    var overUi = isUiTarget(e.target);
    var dx = e.clientX - cursorMotion.x;
    var dy = e.clientY - cursorMotion.y;
    cursorMotion.x = e.clientX;
    cursorMotion.y = e.clientY;
    if (!reducedMotion && Math.hypot(dx, dy) > 1) {
      cursorMotion.tilt = Math.max(-7, Math.min(7, cursorMotion.tilt * 0.72 + dx * 0.42));
    } else {
      cursorMotion.tilt *= 0.8;
    }
    if (inkCursor) {
      inkCursor.style.left = e.clientX + 'px';
      inkCursor.style.top = e.clientY + 'px';
      inkCursor.style.setProperty('--brush-tilt', cursorMotion.tilt.toFixed(2) + 'deg');
    }
    var brushBlocked = brushCoversControls();
    var baseSize = getInkBaseSize();
    var distanceToInk = Math.hypot(e.clientX - window.innerWidth * 0.5, e.clientY - window.innerHeight * 0.55);
    if (!revealStarted && !overUi && !brushBlocked && distanceToInk < baseSize * 0.48) {
      beginReveal();
    }
    var cursorVisible = !overUi && !brushBlocked && !orbitActive;
    if (inkCursor) inkCursor.classList.toggle('visible', cursorVisible);
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    pointer.ui = !cursorVisible;
    if (cursorVisible && !reducedMotion && e.timeStamp - lastTrail > 34) {
      trailPoints.push({ x: e.clientX, y: e.clientY, time: performance.now(), size: 1.6 + Math.random() * 2.6 });
      if (trailPoints.length > 16) trailPoints.shift();
      lastTrail = e.timeStamp;
    }
    if (handSeen || overUi) return;
    rotYT = (0.5 - e.clientX / window.innerWidth) * Math.PI * 2.2;
    rotXT = (e.clientY / window.innerHeight - 0.5) * Math.PI * 1.1;
  });
  overlay.addEventListener('pointerleave', function () {
    pointer.inside = false;
    pointer.pressed = false;
    pointer.ui = true;
    if (inkCursor) inkCursor.classList.remove('visible');
  });
  overlay.addEventListener('pointerdown', function (e) {
    if (isUiTarget(e.target) || isBrandArea(e.clientX, e.clientY) || brushCoversControls()) return;
    pointer.pressed = true;
    spreadT = 1.8;
    beginReveal();
  });
  window.addEventListener('pointerup', function () {
    pointer.pressed = false;
    if (!handSeen) spreadT = 1;
  });
  window.addEventListener('pointercancel', function () {
    pointer.pressed = false;
    pointer.inside = false;
    if (inkCursor) inkCursor.classList.remove('visible');
  });
  window.addEventListener('blur', function () {
    pointer.pressed = false;
    pointer.inside = false;
    if (inkCursor) inkCursor.classList.remove('visible');
  });

  /* ---------- UI 控件 ---------- */
  var dEl = null, dVal = null;
  var fullBtn = document.getElementById('introFull');
  fullBtn.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', function () {
    fullBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
  });

  /* ---------- 进入博物馆：收场并释放资源 ---------- */
  var running = true;
  enterBtn.addEventListener('click', function () {
    if (enterBtn.disabled) return;
    overlay.classList.add('bye');
    running = false;
    pointer.inside = false;
    pointer.ui = true;
    if (inkCursor) inkCursor.classList.remove('visible');
    setTimeout(function () {
      overlay.style.display = 'none';
      renderer.dispose();
    }, 850);
  });

  window.addEventListener('resize', function () {
    if (!running) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeFx();
  });

  function drawInkFx(t) {
    if (!fx) return;
    var width = window.innerWidth;
    var height = window.innerHeight;
    var cx = width * 0.5;
    var cy = height * 0.55;
    var now = performance.now();

    fx.clearRect(0, 0, width, height);
    if (unfoldMix >= 0.999) return;
    var baseSize = getInkBaseSize();
    var pointerDistance = Math.hypot(pointer.x - cx, pointer.y - cy);
    var hoverTarget = pointer.inside && !pointer.ui
      ? Math.max(0, 1 - pointerDistance / (baseSize * 0.62))
      : 0;
    hoverTarget *= hoverTarget;
    inkHover += (hoverTarget - inkHover) * (reducedMotion ? 1 : 0.12);
    var pressTarget = pointer.pressed && !pointer.ui && hoverTarget > 0.01 ? 1 : 0;
    inkPress += (pressTarget - inkPress) * (reducedMotion ? 1 : 0.16);

    var breath = reducedMotion ? 0 : Math.sin(t * 0.82);
    var revealPulse = revealStarted && !reducedMotion ? Math.sin(orbitClock * 0.72) * 0.035 : 0;
    var brushSpread = inkHover * 0.022 + inkPress * 0.04;
    var size = baseSize * (1 + breath * 0.035 + revealPulse + brushSpread + unfoldMix * 0.06);
    var driftX = pointer.inside ? (pointer.x - cx) * 0.012 : 0;
    var driftY = pointer.inside ? (pointer.y - cy) * 0.01 : 0;
    var inkAlpha = (0.9 + breath * 0.035) * (1 - unfoldMix);
    fx.save();
    fx.translate(cx + driftX, cy + driftY + (reducedMotion ? 0 : Math.sin(t * 0.55) * 3));
    fx.rotate((reducedMotion ? 0 : Math.sin(t * 0.14) * 0.018) + brushSpread * 0.16 + unfoldMix * 0.045);

    /* 外晕与主体错开呼吸相位，边缘像纸纤维一样缓缓吸墨。 */
    fx.save();
    fx.filter = 'blur(' + Math.round(size * 0.025) + 'px)';
    fx.globalAlpha = inkAlpha * 0.22;
    fx.scale(1.035 + breath * 0.018, 1.025 - breath * 0.012);
    fx.drawImage(inkWashTexture, -size * 0.5, -size * 0.5, size, size);
    fx.restore();

    fx.globalAlpha = reducedMotion ? inkAlpha : inkAlpha * (0.96 + Math.sin(t * 1.17 + 0.8) * 0.025);
    fx.drawImage(inkWashTexture, -size * 0.5, -size * 0.5, size, size);

    /* 笔锋靠近或按下时，墨边朝笔尖方向轻轻推开。 */
    if (inkHover > 0.015 || inkPress > 0.015) {
      fx.save();
      fx.translate((pointer.x - cx) * 0.015 * inkHover, (pointer.y - cy) * 0.012 * inkHover);
      fx.scale(1 + inkHover * 0.012 + inkPress * 0.018, 1 + inkHover * 0.008 + inkPress * 0.014);
      fx.globalAlpha = inkAlpha * (0.035 * inkHover + 0.045 * inkPress);
      fx.drawImage(inkWashTexture, -size * 0.5, -size * 0.5, size, size);
      fx.restore();
    }

    /* 数枚极淡墨点缓慢吞吐，给静止墨团一点生气。 */
    var dotPhase = reducedMotion ? 0 : t;
    var dots = [
      [0.56, -0.3, 4.8, 0.13],
      [0.41, -0.15, 2.6, 0.09],
      [0.61, 0.18, 3.6, 0.11],
      [-0.37, 0.31, 2.2, 0.08]
    ];
    for (var di = 0; di < dots.length; di++) {
      var dot = dots[di];
      fx.globalAlpha = (dot[3] + Math.sin(dotPhase * 0.7 + di) * 0.025) * (1 - unfoldMix);
      fx.fillStyle = '#26302c';
      fx.beginPath();
      fx.arc(size * dot[0], size * dot[1], dot[2] + Math.sin(dotPhase * 0.5 + di) * 0.5, 0, Math.PI * 2);
      fx.fill();
    }
    fx.restore();

    if (!reducedMotion && trailPoints.length) {
      trailPoints = trailPoints.filter(function (point) {
        return now - point.time < 620;
      });
      for (var p = 1; p < trailPoints.length; p++) {
        var from = trailPoints[p - 1];
        var to = trailPoints[p];
        var age = Math.max(0, 1 - (now - to.time) / 620);
        fx.save();
        fx.lineCap = 'round';
        fx.strokeStyle = 'rgba(39,47,43,' + (0.12 * age * (1 - unfoldMix)).toFixed(3) + ')';
        fx.lineWidth = Math.max(0.6, to.size * age);
        fx.beginPath();
        fx.moveTo(from.x, from.y);
        fx.lineTo(to.x, to.y);
        fx.stroke();
        fx.fillStyle = 'rgba(38,45,41,' + (0.1 * age * (1 - unfoldMix)).toFixed(3) + ')';
        fx.beginPath();
        fx.arc(to.x + 2, to.y + 2, Math.max(0.6, to.size * 0.58), 0, Math.PI * 2);
        fx.fill();
        fx.restore();
      }
    }
  }

  resizeFx();

  /* ---------- 主循环（无逐帧新对象） ---------- */
  var clock = new THREE.Clock();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    var rdt = clock.getDelta();
    var dt = Math.min(rdt, 0.05), t = clock.elapsedTime;
    if (revealStarted && !revealDone) {
      var orbitDuration = reducedMotion ? 0.35 : 4.6;
      var unfoldDuration = reducedMotion ? 0.3 : 1.8;
      if (orbitActive && !unfoldStarted) {
        orbitClock += rdt;
        var orbitProgress = Math.min(1, orbitClock / orbitDuration);
        var orbitAngle = -Math.PI * 0.5 + orbitProgress * Math.PI * 4;
        var orbitBase = getInkBaseSize();
        var revealCX = window.innerWidth * 0.5, revealCY = window.innerHeight * 0.55;
        inkRevealBrush.style.opacity = reducedMotion ? '0' : '1';
        inkRevealBrush.style.left = (revealCX + Math.cos(orbitAngle) * orbitBase * 0.52) + 'px';
        inkRevealBrush.style.top = (revealCY + Math.sin(orbitAngle) * orbitBase * 0.34) + 'px';
        inkRevealBrush.style.transform = 'translate(-50%, -50%) rotate(' + (orbitAngle + 0.72).toFixed(3) + 'rad)';
        if (orbitProgress >= 1 && modelReady) {
          orbitActive = false;
          unfoldStarted = true;
          unfoldClock = 0;
          cloud.visible = true;
          cloud.scale.setScalar(0.72);
          canvas.style.opacity = '0';
          setStatus('墨色化形 · 轮廓渐显');
        } else if (orbitProgress >= 1) {
          setStatus('墨色化形 · 静候轮廓');
        }
      }
      if (unfoldStarted) {
        unfoldClock += rdt;
        var unfoldProgress = Math.min(1, unfoldClock / unfoldDuration);
        unfoldMix = smoothStep(unfoldProgress);
        canvas.style.opacity = unfoldMix.toFixed(3);
        cloud.scale.setScalar(0.72 + unfoldMix * 0.28);
        inkRevealBrush.style.opacity = (1 - unfoldMix).toFixed(3);
      }
      if (unfoldStarted && unfoldProgress >= 1 && !introPresetSequenceStarted) {
        introPresetSequenceStarted = true;
        introPresetClock = 0;
        setStatus('墨色化形 · 四件馆藏轮番显影');
      }
      if (introPresetSequenceStarted && !introPresetSequenceDone) {
        introPresetClock += rdt;
        var presetInterval = reducedMotion ? 0.28 : 1.25;
        if (introPresetClock >= presetInterval) {
          introPresetClock = 0;
          if (introPresetIndex < introPresetCount - 1) {
            var nextPresetIndex = introPresetIndex + 1;
            var nextPreset = PRESETS[nextPresetIndex];
            if (!store[nextPreset.id]) {
              modelReady = false;
              loadPreset(nextPreset);
              setStatus('墨色化形 · 正在载入' + introPresetLabels[nextPresetIndex]);
            } else {
              introPresetIndex = nextPresetIndex;
              cur = introPresetIndex;
              modelReady = true;
              applyPreset(nextPreset);
              setStatus('墨色化形 · ' + introPresetLabels[introPresetIndex]);
            }
          } else {
            introPresetSequenceDone = true;
            revealDone = true;
            orbitActive = false;
            canvas.style.opacity = '1';
            cloud.scale.setScalar(1);
            inkRevealBrush.style.opacity = '0';
            overlay.classList.add('ready');
            enterBtn.disabled = false;
            enterBtn.setAttribute('aria-disabled', 'false');
            setStatus('园境已开 · 可入馆');
            pointer.ui = false;
            if (pointer.inside && inkCursor) {
              var currentTarget = document.elementFromPoint(pointer.x, pointer.y);
              var showCursor = !isUiTarget(currentTarget) && !brushCoversControls();
              inkCursor.classList.toggle('visible', showCursor);
              pointer.ui = !showCursor;
            }
          }
        }
      }
    }
    if (!handSeen && !reducedMotion) spin += dt * 0.25;
    rotY += (rotYT - rotY) * (reducedMotion ? 0 : 0.06);
    rotX += (rotXT - rotX) * (reducedMotion ? 0 : 0.06);
    if (inkCursor && !reducedMotion && Math.abs(cursorMotion.tilt) > 0.04) {
      cursorMotion.tilt *= 0.9;
      inkCursor.style.setProperty('--brush-tilt', cursorMotion.tilt.toFixed(2) + 'deg');
    }
    spread += (spreadT - spread) * 0.07;
    cloud.rotation.y = spin + rotY;
    cloud.rotation.x = rotX * 0.7;
    if (cloud.visible) {
      var n = density, i3, br;
      for (var k = 0; k < n; k++) {
        i3 = k * 3;
        br = spread + Math.sin(t * 1.8 + phase[k]) * 0.035;
        pos[i3] = base[i3] * br;
        pos[i3 + 1] = base[i3 + 1] * br;
        pos[i3 + 2] = base[i3 + 2] * br;
        /* 只用墨黑与灰青的浓淡变化，不引入色相漂移。 */
        var inkLight = Math.max(0.075, Math.min(0.38, 0.22 + hueOff[k] * 0.72 + 0.025 * Math.sin(t * 1.7 + phase[k] * 2)));
        col[i3] = inkLight * 0.88;
        col[i3 + 1] = inkLight;
        col[i3 + 2] = inkLight * 0.96;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, n);
      for (bi = 0; bi < blobs.length; bi++) {
        blobs[bi].position.x = blobs[bi].userData.bx + Math.sin(t * 0.04 + bi * 2.1) * 0.7;
      }
      renderer.render(scene, camera);
    }
    drawInkFx(t);
  }
  tick();
})();
