/* ============================================================
 * scene.js —— 园区 · 建筑 · 展厅 · 灯光
 * 归属：组长 —— 外观（园区 / 建筑 / 连廊 / 材质 / 灯光）
 *       组员1 —— 接缝（碰撞体 / 展品热点 / 展厅区域 / 性能）
 * ------------------------------------------------------------
 * 职责：
 *   1. 搭建「云墨美术馆」园区：地面、草坪、道路、围墙、门柱、行道树
 *   2. 搭建博物馆主楼外观（新中式：基座、一层大厅、二层外观、四坡屋顶、匾额）
 *   3. 搭建可进入的室内展厅：一楼中国绘画厅 + 西侧文明对话连廊
 *   4. 布置展品（程序化名画贴图 / 几何雕塑，组员6 可替换为真实素材）
 *   5. 提供：碰撞体列表 MuseumScene.obstacles
 *           展品热点   MuseumScene.exhibitSpots
 *           展厅区域   MuseumScene.hallRegions
 * ------------------------------------------------------------
 * 依赖：config.js（MuseumConfig）、THREE 全局
 * 注意：墙体材质使用 DoubleSide，保证从室内也能看到墙面
 * ============================================================ */

window.MuseumScene = (function () {

  /* ---------- 内部状态 ---------- */
  var scene = null;
  var camera = null;
  var spotMeshes = [];          // 展品热点 mesh（exhibit.js 拾取用）
  var obstacles = [];           // 碰撞体（player.js 用）
  var hallRegions = {};         // 展厅区域判定（player.js 用）

  var _g = THREE;

  /* ============================================================
   * 工具：Canvas 程序化贴图（示意素材）
   * 组员6：将 assets/images 下真实名画放入后，可在此替换为 TextureLoader
   * ============================================================ */
  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    return { canvas: c, ctx: ctx };
  }

  /* 画作示意贴图：根据展品 type/id 生成风格化画面 + 题签 */
  function drawPainting(ex) {
    var W = 512, H = 320;
    var cv = makeCanvas(W, H);
    var ctx = cv.ctx;

    // 底色 + 画面（示意，非真实作品）
    switch (ex.id) {
      case "qianlijiangshan": // 青绿山水
        ctx.fillStyle = "#b9cbb0"; fillRect(ctx, 0, 0, W, H);
        drawMountains(ctx, W, H, ["#3f6b4f", "#5f8f63", "#8fb97d", "#c3d9a8"], 0.62);
        drawRiver(ctx, W, H, "#7fb2c9");
        break;
      case "qingmingshanghe": // 风俗长卷
        ctx.fillStyle = "#d9c39a"; fillRect(ctx, 0, 0, W, H);
        drawTown(ctx, W, H);
        break;
      case "fuchunshanjv": // 水墨山水
        ctx.fillStyle = "#ece6d8"; fillRect(ctx, 0, 0, W, H);
        drawInkMountains(ctx, W, H);
        break;
      case "hanxizai": // 夜宴人物
        ctx.fillStyle = "#3a2430"; fillRect(ctx, 0, 0, W, H);
        drawFigures(ctx, W, H);
        break;
      case "luoshenfu": // 洛神叙事
        ctx.fillStyle = "#cfd8c9"; fillRect(ctx, 0, 0, W, H);
        drawGoddess(ctx, W, H);
        break;
      case "monalisa": // 文艺复兴肖像
        ctx.fillStyle = "#5c4632"; fillRect(ctx, 0, 0, W, H);
        drawPortrait(ctx, W, H, "#c9a37a");
        break;
      case "starrynight": // 星月夜
        ctx.fillStyle = "#24355c"; fillRect(ctx, 0, 0, W, H);
        drawStarry(ctx, W, H);
        break;
      default:
        ctx.fillStyle = "#d8d2c4"; fillRect(ctx, 0, 0, W, H);
    }

    // 题签：右上竖排（新中式画作装裱习惯）
    ctx.save();
    ctx.fillStyle = "rgba(20,16,12,0.72)";
    ctx.fillRect(W - 92, 22, 40, H - 44);
    ctx.fillStyle = "#e9e2d3";
    ctx.font = "22px 'SimSun', 'Songti SC', serif";
    ctx.textAlign = "center";
    var chars = (ex.title || "").split("");
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], W - 72, 60 + i * 34);
    }
    ctx.restore();

    return cv.canvas;
  }

  /* —— 各画风绘制函数（示意） —— */
  function fillRect(ctx, x, y, w, h) { ctx.fillRect(x, y, w, h); }

  function drawMountains(ctx, W, H, colors, peakY) {
    var layers = colors.length;
    for (var k = layers - 1; k >= 0; k--) {
      ctx.fillStyle = colors[k];
      ctx.beginPath();
      ctx.moveTo(0, H);
      var step = W / (10 + k * 4);
      for (var x = 0; x <= W; x += step) {
        var peak = H * (peakY - k * 0.09 - 0.08 * Math.sin(x * 0.02 + k * 2));
        ctx.lineTo(x, peak);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
  }
  function drawRiver(ctx, W, H, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.74);
    ctx.bezierCurveTo(W * 0.3, H * 0.6, W * 0.6, H * 0.85, W, H * 0.68);
    ctx.stroke();
    ctx.lineWidth = 8; ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.66);
    ctx.bezierCurveTo(W * 0.3, H * 0.52, W * 0.6, H * 0.78, W, H * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawTown(ctx, W, H) {
    ctx.fillStyle = "#8a6f4d";
    for (var i = 0; i < 14; i++) {
      var bx = i * (W / 14) + 12, bw = 26 + (i % 3) * 10, bh = 40 + (i % 4) * 26;
      ctx.fillRect(bx, H - bh - 24, bw, bh);
      ctx.fillStyle = "#6d5438";
      ctx.beginPath();
      ctx.moveTo(bx - 4, H - bh - 24);
      ctx.lineTo(bx + bw / 2, H - bh - 52);
      ctx.lineTo(bx + bw + 4, H - bh - 24);
      ctx.fill();
      ctx.fillStyle = "#8a6f4d";
    }
    ctx.fillStyle = "#4f3d2a";
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.bezierCurveTo(W * 0.25, H - 70, W * 0.55, H - 30, W, H - 56);
    ctx.stroke();
    ctx.strokeStyle = "#4f3d2a"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W * 0.42, H - 62);
    ctx.lineTo(W * 0.42, H - 26);
    ctx.moveTo(W * 0.46, H - 62);
    ctx.lineTo(W * 0.46, H - 26);
    ctx.stroke();
  }
  function drawInkMountains(ctx, W, H) {
    var shades = ["#4a4a46", "#6f6f68", "#9a9a90", "#c2c2b6"];
    for (var k = 0; k < shades.length; k++) {
      ctx.strokeStyle = shades[k]; ctx.lineWidth = 6 - k;
      ctx.beginPath();
      ctx.moveTo(0, H * (0.52 + k * 0.1));
      for (var x = 0; x <= W; x += 14) {
        var y = H * (0.34 + k * 0.1) + 26 * Math.sin(x * 0.014 + k * 1.7) + x * 0.18 * (k + 1) * 0.02;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(28,26,23,0.2)";
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
  }
  function drawFigures(ctx, W, H) {
    ctx.fillStyle = "#e8d9b8";
    for (var i = 0; i < 6; i++) {
      var x = 70 + i * 76, h = 60 + (i % 3) * 24;
      ctx.beginPath(); ctx.arc(x, H - h - 44, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 16, H - h - 32, 32, h);
    }
    ctx.fillStyle = "#c9a37a";
    ctx.fillRect(W * 0.42, H * 0.28, W * 0.16, H * 0.5);
    ctx.fillStyle = "#3a2430";
    ctx.font = "26px serif"; ctx.textAlign = "center";
    ctx.fillText("夜宴", W / 2, H * 0.2);
  }
  function drawGoddess(ctx, W, H) {
    ctx.fillStyle = "#e6e0d0";
    for (var i = 0; i < 3; i++) {
      var x = 90 + i * 170;
      ctx.beginPath(); ctx.arc(x, H * 0.34, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#7a8f86"; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, H * 0.4);
      ctx.bezierCurveTo(x - 26, H * 0.55, x + 22, H * 0.7, x - 8, H * 0.82);
      ctx.stroke();
    }
    ctx.strokeStyle = "#9fb8ad"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.7);
    ctx.bezierCurveTo(W * 0.3, H * 0.5, W * 0.7, H * 0.9, W, H * 0.62);
    ctx.stroke();
  }
  function drawPortrait(ctx, W, H, skin) {
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(W * 0.52, H * 0.42, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7c5a3e";
    ctx.fillRect(W * 0.5 - 6, H * 0.32, 12, 12);
    ctx.fillRect(W * 0.36, H * 0.45, 20, 8);
    ctx.fillRect(W * 0.62, H * 0.45, 20, 8);
    ctx.fillStyle = "#2e241c";
    ctx.beginPath(); ctx.arc(W * 0.46, H * 0.4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.58, H * 0.4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3d3a34"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W * 0.52, H * 0.45);
    ctx.bezierCurveTo(W * 0.6, H * 0.5, W * 0.62, H * 0.58, W * 0.6, H * 0.62);
    ctx.stroke();
    ctx.fillStyle = "#4a3b2e";
    ctx.fillRect(W * 0.4, H * 0.62, W * 0.26, H * 0.3);
    ctx.strokeStyle = "#3a3026";
    ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.68); ctx.lineTo(W * 0.58, H * 0.68);
    ctx.moveTo(W * 0.42, H * 0.78); ctx.lineTo(W * 0.58, H * 0.78);
    ctx.stroke();
  }
  function drawStarry(ctx, W, H) {
    for (var i = 0; i < 90; i++) {
      ctx.fillStyle = "rgba(245,241,232," + (0.25 + Math.random() * 0.7) + ")";
      var sx = Math.random() * W, sy = Math.random() * H * 0.62;
      ctx.fillRect(sx, sy, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    ctx.strokeStyle = "#e8c96a"; ctx.lineWidth = 9;
    for (var s = 0; s < 3; s++) {
      ctx.beginPath();
      var cx = W * (0.3 + s * 0.24), cy = H * 0.3, r = 34 + s * 10;
      for (var a = 0; a < 20; a++) {
        var rad = a / 20 * Math.PI * 2;
        var rr = r + 7 * Math.sin(a * 3.1 + s * 2);
        var px = cx + Math.cos(rad) * rr, py = cy + Math.sin(rad) * rr * 0.7;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = "#1c2733";
    ctx.beginPath();
    ctx.moveTo(W * 0.72, H);
    ctx.lineTo(W * 0.88, H * 0.5);
    ctx.lineTo(W, H * 0.34);
    ctx.lineTo(W, H);
    ctx.fill();
  }

  /* 展品说明牌（小型立牌） */
  function drawSign(line1, line2) {
    var cv = makeCanvas(320, 180);
    var ctx = cv.ctx;
    ctx.fillStyle = "#efe9dc";
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = "#8c3b2e";
    ctx.fillRect(0, 0, 320, 10);
    ctx.fillStyle = "#2a2622";
    ctx.font = "34px 'SimSun','Songti SC',serif";
    ctx.textAlign = "center";
    ctx.fillText(line1, 160, 82);
    ctx.font = "22px 'SimSun','Songti SC',serif";
    ctx.fillStyle = "#6b6155";
    ctx.fillText(line2 || "", 160, 128);
    return cv.canvas;
  }

  /* 匾额 */
  function drawPlaque(text) {
    var cv = makeCanvas(720, 200);
    var ctx = cv.ctx;
    ctx.fillStyle = "#1c1a17";
    ctx.fillRect(0, 0, 720, 200);
    ctx.strokeStyle = "#c9a37a"; ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 696, 176);
    ctx.fillStyle = "#f5f1e8";
    ctx.font = "88px 'SimSun','Songti SC',serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 360, 136);
    return cv.canvas;
  }

  /* 木纹地板（简单条状） */
  function drawWood() {
    var cv = makeCanvas(256, 256);
    var ctx = cv.ctx;
    ctx.fillStyle = "#6d5544";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(20,16,12,0.18)";
    for (var i = 0; i < 8; i++) {
      ctx.lineWidth = 1 + i % 3;
      ctx.beginPath();
      ctx.moveTo(0, i * 34 + 8);
      ctx.bezierCurveTo(90, i * 34 - 6, 170, i * 34 + 14, 256, i * 34 + 2);
      ctx.stroke();
    }
    return cv.canvas;
  }

  /* ---------- 外观专用：程序化材质贴图（组长补） ---------- */

  /* 筒瓦纹理（屋顶坡面，组员6 换真实瓦贴图时替换这里即可） */
  function drawTile() {
    var cv = makeCanvas(256, 256);
    var ctx = cv.ctx;
    ctx.fillStyle = "#484139";
    fillRect(ctx, 0, 0, 256, 256);
    for (var x = 0; x < 256; x += 16) {
      var lg = ctx.createLinearGradient(x, 0, x + 16, 0);
      lg.addColorStop(0, "rgba(0,0,0,0.44)");
      lg.addColorStop(0.42, "rgba(255,246,232,0.12)");
      lg.addColorStop(0.58, "rgba(255,246,232,0.06)");
      lg.addColorStop(1, "rgba(0,0,0,0.44)");
      ctx.fillStyle = lg;
      fillRect(ctx, x, 0, 16, 256);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 2;
    for (var y = 10; y < 256; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    return cv.canvas;
  }

  /* 灰砖墙纹理（围墙 / 院墙） */
  function drawBrick() {
    var cv = makeCanvas(256, 256);
    var ctx = cv.ctx;
    ctx.fillStyle = "#8e8878";
    fillRect(ctx, 0, 0, 256, 256);
    var bw = 62, bh = 24, gap = 4;
    for (var row = 0, y = 0; y < 256; y += bh + gap, row++) {
      var offset = row % 2 ? -(bw + gap) / 2 : 0;
      for (var x = offset; x < 256 + bw; x += bw + gap) {
        var s = 196 + Math.floor(Math.random() * 26);
        ctx.fillStyle = "rgb(" + s + "," + (s - 5) + "," + (s - 20) + ")";
        fillRect(ctx, x, y, bw, bh);
        ctx.fillStyle = "rgba(90,80,66,0.12)";
        fillRect(ctx, x, y + bh - 3, bw, 3);
      }
    }
    return cv.canvas;
  }

  /* 木格花窗（新中式视觉关键元素，替换原来纯黑窗洞） */
  function drawLattice() {
    var cv = makeCanvas(256, 320);
    var ctx = cv.ctx;
    ctx.fillStyle = "#17140f";
    fillRect(ctx, 0, 0, 256, 320);
    var warm = ctx.createRadialGradient(128, 150, 16, 128, 150, 190);
    warm.addColorStop(0, "rgba(255,214,150,0.42)");
    warm.addColorStop(1, "rgba(255,214,150,0.02)");
    ctx.fillStyle = warm;
    fillRect(ctx, 0, 0, 256, 320);
    ctx.strokeStyle = "#7a5f46";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 312);
    ctx.lineWidth = 5;
    for (var i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 320); ctx.stroke();
    }
    for (var j = 1; j <= 4; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * 64); ctx.lineTo(256, j * 64); ctx.stroke();
    }
    ctx.strokeStyle = "#8d6c4e";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(256, 320); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(0, 320); ctx.stroke();
    return cv.canvas;
  }

  /* ============================================================
   * 材质工厂（新中式色板）
   * ============================================================ */
  function mat(color, opts) {
    opts = opts || {};
    return new _g.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness === undefined ? 0.85 : opts.roughness,
      metalness: opts.metalness === undefined ? 0.0 : opts.metalness,
      side: opts.side || _g.FrontSide,
    });
  }

  function canvasMat(canvas, opts) {
    opts = opts || {};
    var tex = new _g.CanvasTexture(canvas);
    tex.encoding = _g.sRGBEncoding;
    tex.minFilter = _g.LinearFilter;
    tex.anisotropy = 4;
    return new _g.MeshStandardMaterial({
      map: tex,
      roughness: opts.roughness === undefined ? 0.9 : opts.roughness,
      side: opts.side || _g.FrontSide,
    });
  }

  /* ============================================================
   * 组件：园区
   * ============================================================ */
  /* ============================================================
   * 新中式屋顶：四坡瓦面 + 檐口 + 飞檐翘角 + 正脊 + 鸱吻
   * 原实现用 CylinderGeometry(…, 4) 拼方锥：没有出檐、没有翘角，
   * 而且屋顶面阔还小于墙身，从广场看楼体边缘是露出来的。
   * opt: { x, z, y(檐口下沿), w(世界 x 向面阔), d(世界 z 向进深),
   *        h(举高), eave(出檐), ridge(正脊长), axis('x'|'z'，正脊走向) }
   * ============================================================ */
  function buildRoof(parent, opt) {
    var g = new _g.Group();
    var w = opt.w, d = opt.d;
    var rotY = 0;
    if (opt.axis === "z") {
      rotY = Math.PI / 2;
      var swap = w; w = d; d = swap;
    }
    var a = w / 2, b = d / 2, h = opt.h;
    var c = Math.max(0.001, (opt.ridge === undefined ? w - d : opt.ridge) / 2);
    var eave = opt.eave === undefined ? 1.5 : opt.eave;

    // 檐口板：悬出墙身，同时遮住屋顶与墙之间的缝
    buildBox(g, w + eave * 2, 0.3, d + eave * 2, 0, 0.15, 0, mat(0x4b423a, { roughness: 0.9 }));

    // 坡面：手写四边形，保证是「矩形四坡顶」而不是方锥
    var A = [-a, 0.3, -b], B = [a, 0.3, -b], C = [a, 0.3, b], D = [-a, 0.3, b];
    var P = [-c, 0.3 + h, 0], Q = [c, 0.3 + h, 0];
    var tris = [
      A, B, Q, A, Q, P,   // 北坡
      D, C, P, C, Q, P,   // 南坡
      B, Q, C,            // 东坡
      P, A, D,            // 西坡
    ];
    var pos = [], uv = [];
    for (var i = 0; i < tris.length; i++) {
      var v = tris[i];
      pos.push(v[0], v[1], v[2]);
      uv.push((v[0] + a) / (2 * a), (v[2] + b) / (2 * b));
    }
    var geo = new _g.BufferGeometry();
    geo.setAttribute("position", new _g.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new _g.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();

    var tileTex = new _g.CanvasTexture(drawTile());
    tileTex.encoding = _g.sRGBEncoding;
    tileTex.wrapS = tileTex.wrapT = _g.RepeatWrapping;
    tileTex.repeat.set(3, 1.6);
    var roofMesh = new _g.Mesh(geo, new _g.MeshStandardMaterial({
      map: tileTex, roughness: 0.72, metalness: 0.05, side: _g.DoubleSide,
    }));
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    g.add(roofMesh);

    // 正脊 + 两端鸱吻
    buildBox(g, c * 2 + 0.5, 0.34, 0.4, 0, 0.42 + h, 0, mat(0x39332d, { roughness: 0.85 }));
    [-1, 1].forEach(function (s) {
      var kiss = new _g.Mesh(new _g.BoxGeometry(0.3, 0.62, 0.3), mat(0x39332d, { roughness: 0.85 }));
      kiss.position.set(s * (c + 0.18), 0.72 + h, 0);
      kiss.rotation.z = -s * 0.22;
      kiss.castShadow = true;
      g.add(kiss);
    });

    // 飞檐翘角：四角向外挑出并上扬，新中式屋顶的辨识点
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (corner) {
      var tip = new _g.Group();
      tip.position.set(corner[0] * a, 0.32, corner[1] * b);
      tip.rotation.y = Math.atan2(-corner[1], corner[0]);
      var wing = new _g.Mesh(new _g.BoxGeometry(eave + 0.9, 0.22, 0.5), mat(0x453d35, { roughness: 0.85 }));
      wing.position.set((eave + 0.9) / 2 - 0.25, 0.06, 0);
      wing.rotation.z = 0.3;
      wing.castShadow = true;
      tip.add(wing);
      var finial = new _g.Mesh(new _g.SphereGeometry(0.17, 10, 8), mat(0x8a6a45, { roughness: 0.6, metalness: 0.25 }));
      finial.position.set(eave + 0.5, 0.42, 0);
      tip.add(finial);
      g.add(tip);
    });

    g.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  }

  /* 檐下灯笼（自带微弱自发光，暖色点缀） */
  function buildLantern(parent, x, y, z, scale) {
    var g = new _g.Group();
    var cord = new _g.Mesh(new _g.CylinderGeometry(0.02, 0.02, 0.8, 6), mat(0x2b2721));
    cord.position.y = 0.4;
    g.add(cord);
    var body = new _g.Mesh(
      new _g.SphereGeometry(0.34, 14, 12),
      new _g.MeshStandardMaterial({
        color: 0xc4342a, emissive: 0xff8a3c, emissiveIntensity: 0.55, roughness: 0.6,
      })
    );
    body.scale.set(1, 0.82, 1);
    g.add(body);
    var cap = new _g.Mesh(new _g.CylinderGeometry(0.13, 0.13, 0.06, 10), mat(0x8a6a45, { metalness: 0.3, roughness: 0.5 }));
    cap.position.y = 0.28;
    g.add(cap);
    var tassel = new _g.Mesh(new _g.CylinderGeometry(0.03, 0.01, 0.26, 6), mat(0xc9a37a));
    tassel.position.y = -0.34;
    g.add(tassel);
    g.scale.setScalar(scale || 1);
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  /* 连廊美人靠（扶手 + 坐板 + 望柱 + 横枨），带 floorY 以适配抬高 0.73 的廊面 */
  function buildRailing(parent, x, z0, z1, side, floorY) {
    var g = new _g.Group();
    var wood = mat(0x7a3b2e, { roughness: 0.7 });
    var len = Math.abs(z1 - z0);
    var cz = (z0 + z1) / 2;
    buildBox(g, 0.16, 0.14, len, x, floorY + 1.05, cz, wood);
    buildBox(g, 0.46, 0.1, len, x + side * 0.18, floorY + 0.6, cz, mat(0x6d5544, { roughness: 0.75 }));
    buildBox(g, 0.09, 0.09, len, x, floorY + 0.84, cz, wood);
    var n = Math.max(2, Math.round(len / 1.7));
    for (var i = 0; i <= n; i++) {
      var z = cz + (len / 2) * (i / n * 2 - 1);
      buildBox(g, 0.13, 1.05, 0.13, x, floorY + 0.525, z, wood);
    }
    parent.add(g);
    return g;
  }
  /* ============================================================
   * 园区绿化与铺装（组长 · 外观）
   * 原实现：两片 PlaneGeometry(90, 26) 放在 x=±21，实际覆盖 x∈[-66,66]，
   *   在 x∈[-24,24] 重叠且越出围墙 22m，等效一块 48×26 的大绿毯，
   *   重叠处同高共面还会 z-fighting 闪烁。
   * 现改为：两块规整草坪（带 0.3m 石材镶边）+ 前庭铺装分带 + 围墙内侧灌木绿篱。
   * 注意：草坪内新增的小乔木与石凳已代登记碰撞体（标记为「组长代登记」），
   *       待组员1 在接缝子任务里复核。
   * ============================================================ */
  function buildLawn(root, x0, x1, z0, z1) {
    var w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

    // 草地
    var lawn = new _g.Mesh(new _g.PlaneGeometry(w, d), mat(0x5f7043, { roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.02, cz);
    lawn.receiveShadow = true;
    root.add(lawn);

    // 石材镶边（0.3m 宽，四条）
    var edgeMat = mat(0xb9b0a0, { roughness: 0.9 });
    buildBox(root, w + 0.6, 0.12, 0.3, cx, 0.06, z0 - 0.15, edgeMat);
    buildBox(root, w + 0.6, 0.12, 0.3, cx, 0.06, z1 + 0.15, edgeMat);
    buildBox(root, 0.3, 0.12, d + 0.6, x0 - 0.15, 0.06, cz, edgeMat);
    buildBox(root, 0.3, 0.12, d + 0.6, x1 + 0.15, 0.06, cz, edgeMat);

    // 草坪内点景一：小乔木 3 株
    [[cx - w * 0.28, cz - d * 0.22], [cx + w * 0.30, cz + d * 0.04], [cx - w * 0.06, cz + d * 0.30]].forEach(function (p) {
      var trunk = new _g.Mesh(new _g.CylinderGeometry(0.12, 0.17, 2.2, 8), mat(0x5d4a3a));
      trunk.position.set(p[0], 1.1, p[1]);
      trunk.castShadow = true;
      root.add(trunk);
      var crown = new _g.Mesh(new _g.SphereGeometry(1.15, 10, 8), mat(0x63704f, { roughness: 1 }));
      crown.position.set(p[0], 2.85, p[1]);
      crown.castShadow = true;
      root.add(crown);
      obstacles.push({ type: "circle", x: p[0], z: p[1], r: 0.6 });  // 组长代登记，待组员1 复核
    });

    // 草坪内点景二：灌木丛 3 组（每组 3 球，不投影以省开销）
    [[cx + w * 0.18, cz - d * 0.34], [cx - w * 0.34, cz + d * 0.18], [cx + w * 0.34, cz + d * 0.30]].forEach(function (p) {
      [[0, 0, 0.62], [0.58, 0.1, 0.46], [-0.5, -0.2, 0.5]].forEach(function (b) {
        var s = new _g.Mesh(new _g.SphereGeometry(b[2], 9, 7), mat(0x5c6748, { roughness: 1 }));
        s.position.set(p[0] + b[0], b[2] * 0.85, p[1] + b[1]);
        s.scale.y = 0.82;
        root.add(s);
      });
    });

    // 草坪内点景三：石凳 1 条
    var benchX = x1 - 1.6, benchZ = cz + d * 0.40;
    buildBox(root, 1.8, 0.16, 0.5, benchX, 0.42, benchZ, mat(0xa8a297, { roughness: 0.9 }));
    buildBox(root, 0.3, 0.34, 0.42, benchX - 0.6, 0.17, benchZ, mat(0x9a9488, { roughness: 0.9 }));
    buildBox(root, 0.3, 0.34, 0.42, benchX + 0.6, 0.17, benchZ, mat(0x9a9488, { roughness: 0.9 }));
    obstacles.push({ type: "circle", x: benchX, z: benchZ, r: 0.75 });  // 组长代登记，待组员1 复核

    /* ---------- 以下为 Plan C 园景与户外展场（组长 · 外观） ---------- */

    // 园景一：中式石灯 2 座（草坪内缘对称）
    [-1, 1].forEach(function (sg) {
      var lx = cx + sg * w * 0.22, lz = cz - d * 0.30;
      buildBox(root, 0.62, 0.2, 0.62, lx, 0.1, lz, mat(0xa8a297, { roughness: 0.9 }));
      buildBox(root, 0.26, 1.4, 0.26, lx, 0.9, lz, mat(0xa8a297, { roughness: 0.9 }));
      buildBox(root, 0.46, 0.5, 0.46, lx, 1.85, lz, mat(0x9c968a, { roughness: 0.85 }));
      obstacles.push({ type: "circle", x: lx, z: lz, r: 0.5 });   // 组长代登记，待组员1 复核
    });

    // 园景二：太湖石组（3 块示意，组员6 可换真实模型）
    var rockX = cx - w * 0.30, rockZ = cz - d * 0.34;
    [[0, 0.55, 0.75], [0.78, 0.36, 0.5], [-0.62, 0.3, 0.44]].forEach(function (rk) {
      var rock = new _g.Mesh(new _g.DodecahedronGeometry(rk[1], 0), mat(0x8f8a7e, { roughness: 0.95 }));
      rock.position.set(rockX + rk[0], rk[1] * 0.85, rockZ);
      rock.rotation.y = rk[0];
      rock.scale.set(1, rk[2] / rk[1], 0.8);
      rock.castShadow = true;
      root.add(rock);
    });
    obstacles.push({ type: "circle", x: rockX, z: rockZ, r: 1.1 });  // 组长代登记，待组员1 复核

    // 园景三：竹丛（细杆 + 窄冠）
    var bambooX = cx + w * 0.34, bambooZ = cz - d * 0.16;
    for (var bi = 0; bi < 7; bi++) {
      var bx = bambooX + (bi % 3) * 0.34 - 0.34, bz = bambooZ + Math.floor(bi / 3) * 0.36;
      var pole = new _g.Mesh(new _g.CylinderGeometry(0.045, 0.055, 3.0 + (bi % 3) * 0.45, 6), mat(0x7c8a53, { roughness: 0.9 }));
      pole.position.set(bx, 1.5 + (bi % 3) * 0.22, bz);
      root.add(pole);
      var leaf = new _g.Mesh(new _g.ConeGeometry(0.42, 1.1, 6), mat(0x5f7043, { roughness: 1 }));
      leaf.position.set(bx, 3.3 + (bi % 3) * 0.25, bz);
      root.add(leaf);
    }
    obstacles.push({ type: "circle", x: bambooX, z: bambooZ, r: 0.7 });  // 组长代登记，待组员1 复核

    // 户外展场：三座石展座（顶上为示意雕塑，组员6 可换 glb）
    [[-0.5, -0.12], [0.05, 0.14], [0.6, -0.06]].forEach(function (o) {
      var px = cx + o[0] * w * 0.5, pz = cz + o[1] * d;
      buildBox(root, 1.2, 0.7, 1.2, px, 0.35, pz, mat(0x8a8578, { roughness: 0.9 }));
      var art = new _g.Mesh(new _g.TorusGeometry(0.34, 0.1, 8, 18), mat(0x4f5a3c, { roughness: 0.45, metalness: 0.5 }));
      art.position.set(px, 1.05, pz);
      art.rotation.x = 0.5;
      art.castShadow = true;
      root.add(art);
      obstacles.push({ type: "circle", x: px, z: pz, r: 0.85 });  // 组长代登记，待组员1 复核
    });

    // 连接小径：从中轴道路通向草坪（石板 2.5m 宽）
    var side = x1 > 0 ? 1 : -1;
    var path = new _g.Mesh(new _g.PlaneGeometry(24, 2.5), mat(0xcfc6b6, { roughness: 0.95 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(side * 14.5, 0.026, 15.0);
    path.receiveShadow = true;
    root.add(path);
  }

  function buildLawns(root) {
    buildLawn(root, -38, -14, -6, 14);
    buildLawn(root, 14, 38, -6, 14);
  }

  /* 前庭铺装分带：z 14~40 三条横向色带 + 中轴两侧浅色镶边 */
  function paveForecourt(root) {
    [[14, 22, 0xe6dfd1], [22, 30, 0xd3cbbc], [30, 40, 0xe6dfd1]].forEach(function (b) {
      var m = new _g.Mesh(new _g.PlaneGeometry(88, b[1] - b[0]), mat(b[2], { roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.022, (b[0] + b[1]) / 2);
      m.receiveShadow = true;
      root.add(m);
    });
    [-1, 1].forEach(function (s) {
      var e = new _g.Mesh(new _g.PlaneGeometry(1, 42), mat(0xcfc6b6, { roughness: 0.95 }));
      e.rotation.x = -Math.PI / 2;
      e.position.set(s * 3, 0.025, 4);
      root.add(e);
    });
  }

  /* 围墙内侧灌木绿篱（低矮，不登记碰撞体） */
  function buildHedge(root) {
    var bushMat = mat(0x5c6748, { roughness: 1 });
    function bush(x, z, r) {
      var s = new _g.Mesh(new _g.SphereGeometry(r, 9, 7), bushMat);
      s.position.set(x, r * 0.8, z);
      s.scale.set(1, 0.8, 1);
      root.add(s);
    }
    // 北墙内侧
    for (var x = -42; x <= 42; x += 4) bush(x, -42.4, 0.55 + (Math.abs(x) % 8 === 0 ? 0.15 : 0));
    // 东西墙内侧
    [-42.4, 42.4].forEach(function (wx) {
      for (var z = -42; z <= 42; z += 4) {
        if (Math.abs(z) < 45) bush(wx, z, 0.55 + (Math.abs(z) % 8 === 0 ? 0.15 : 0));
      }
    });
    // 南墙内侧（门洞 x ±4.6 左右各留出，避开入口）
    [-1, 1].forEach(function (side) {
      for (var sx = 8; sx <= 42; sx += 4) bush(side * sx, 42.4, 0.55);
    });
  }
  function buildPlaza(root) {
    // 地面（石板米白）
    var ground = new _g.Mesh(new _g.PlaneGeometry(90, 90), mat(0xc9c2b1, { roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);

    // 草坪：两块规整草坪 + 石材镶边 + 点景（原为两片 90×26 重叠并越出围墙，已重写）
    buildLawns(root);

    // 前庭铺装分带（治空旷）
    paveForecourt(root);

    // 围墙内侧灌木绿篱
    buildHedge(root);

    // 中轴道路
    var road = new _g.Mesh(new _g.PlaneGeometry(5, 42), mat(0x57514a, { roughness: 1 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, 4);
    road.receiveShadow = true;
    root.add(road);

    // 围墙（含南侧门洞）
    buildWall(root, 0, -44, 90, 0);     // 北墙
    buildWall(root, -44, 0, 90, Math.PI / 2); // 西墙
    buildWall(root, 44, 0, 90, Math.PI / 2);  // 东墙
    buildWallWithGap(root);             // 南墙留门洞

    // 大门门柱（两侧红柱 + 横梁 + 小坡檐）
    [-5.2, 5.2].forEach(function (x) {
      var pillar = new _g.Mesh(new _g.BoxGeometry(0.9, 3.6, 0.9), mat(0x9c3a2c, { roughness: 0.6 }));
      pillar.position.set(x, 1.8, 42.2);
      pillar.castShadow = true;
      root.add(pillar);
      obstacles.push({ type: "circle", x: x, z: 42.2, r: 0.7 });
    });
    var beam = new _g.Mesh(new _g.BoxGeometry(11.6, 0.6, 0.8), mat(0x6d5544, { roughness: 0.7 }));
    beam.position.set(0, 3.7, 42.2);
    root.add(beam);
    // 门楼屋顶：原为一块扁平四棱台，现改为瓦面四坡顶 + 飞檐翘角
    buildRoof(root, { x: 0, z: 42.2, y: 3.95, w: 12.6, d: 2.8, h: 1.2, eave: 1.0, ridge: 8.0 });
    // 檐下灯笼一对
    buildLantern(root, -3.6, 2.95, 42.2, 1);
    buildLantern(root, 3.6, 2.95, 42.2, 1);

    // 行道树（道路两侧）
    for (var i = 0; i < 4; i++) {
      [-1, 1].forEach(function (side) {
        var z = 18 + i * 6.5;
        var trunk = new _g.Mesh(new _g.CylinderGeometry(0.14, 0.2, 2.6, 8), mat(0x5d4a3a));
        trunk.position.set(side * 4.6, 1.3, z);
        root.add(trunk);
        var crown = new _g.Mesh(new _g.SphereGeometry(1.25, 10, 8), mat(0x6c7658, { roughness: 1 }));
        crown.position.set(side * 4.6, 3.4, z);
        crown.castShadow = true;
        root.add(crown);
        obstacles.push({ type: "circle", x: side * 4.6, z: z, r: 0.7 });
      });
    }
  }

  function buildWall(root, cx, cz, len, rotY) {
    var wall = new _g.Mesh(new _g.BoxGeometry(len, 2.1, 0.4), canvasMat(drawBrick(), { roughness: 0.95 }));
    wall.position.set(cx, 1.05, cz);
    wall.rotation.y = rotY;
    root.add(wall);
    // 墙帽（压顶瓦）：原来围墙是一整块光板，缺收头
    var cap = new _g.Mesh(new _g.BoxGeometry(len, 0.22, 0.72), mat(0x4b423a, { roughness: 0.85 }));
    cap.position.set(cx, 2.21, cz);
    cap.rotation.y = rotY;
    cap.castShadow = true;
    root.add(cap);
    if (Math.abs(rotY) < 0.01) {
      // 横向墙（南北）：z 固定，阻挡 x 轴活动
      obstacles.push({ type: "rect", x0: cx - len / 2, z0: cz - 0.4, x1: cx + len / 2, z1: cz + 0.4 });
    } else {
      // 纵向墙（东西）：x 固定，阻挡 z 轴活动
      obstacles.push({ type: "rect", x0: cx - 0.4, z0: cz - len / 2, x1: cx + 0.4, z1: cz + len / 2 });
    }
  }

  function buildWallWithGap(root) {
    var half = 41.5;
    [-1, 1].forEach(function (side) {
      var wall = new _g.Mesh(new _g.BoxGeometry(half, 2.1, 0.4), canvasMat(drawBrick(), { roughness: 0.95 }));
      wall.position.set(side * (half / 2 + 4.6), 1.05, 44);
      root.add(wall);
      var cap2 = new _g.Mesh(new _g.BoxGeometry(half, 0.22, 0.72), mat(0x4b423a, { roughness: 0.85 }));
      cap2.position.set(side * (half / 2 + 4.6), 2.21, 44);
      cap2.castShadow = true;
      root.add(cap2);
      // 南墙左右段碰撞（中间 ±4.6 留门洞）
      obstacles.push({
        type: "rect",
        x0: side > 0 ? 4.6 : -44,
        z0: 43.6,
        x1: side > 0 ? 44 : -4.6,
        z1: 44.4,
      });
    });
  }

  /* ============================================================
   * 组件：博物馆主楼（外观 + 可进入一层）
   * ============================================================ */
  function buildMuseum(root) {
    var group = new _g.Group();
    root.add(group);

    /* ============================================================
     * 江南院落 · 六厅逐栋替换旧单体大殿（2026-09-22 拆改）
     * ------------------------------------------------------------
     * 本次拆除：
     *   · 旧单体大殿：石基座 / 南侧柱廊 / 一层墙体与高侧窗 / 四坡顶与匾额 /
     *     檐下灯笼 / 室内木地板 / 顶棚梁格 / 室内照明 / 两座展台 /
     *     北墙三幅与西墙两幅挂画
     *   · 旧西侧连廊：美人靠、展墙、蒙娜丽莎与星月夜两幅西画
     *   同时移除旧大殿墙体的 5 个碰撞体与柱廊 4 个柱碰撞体
     *   （原为组长代登记，已随几何一并移除，**待组员1 复核**）。
     *   需要回溯旧几何：见提交 095e8dd 之前的版本。
     *
     * 进度：已建 hall2 花鸟画展区（样板厅，函数定义见本函数下方）
     *       待建 hall0 序厅 / hall1 山水展区 / hall3 人物展区 /
     *            hall4 书斋茶室 / hall5 文创区 / 中央庭院 courtyard
     *            （含水池、太湖石、竹丛、东西曲廊、马头墙与漏窗）
     * ============================================================ */

    /* ---------- 前庭雕塑与石狮（按坐标版 §四 调整坐标）---------- */
    addPlazaSculpture(root, -6.4, 6, "matayafeiyan", "马踏飞燕 · 东汉");  // 移入中央庭院西南
    addStoneLion(root, -8, 25, 1);   // 序厅前 · 西
    addStoneLion(root, 8, 25, -1);   // 序厅前 · 东
    /* ---------- 展厅区域（用于玩家所在厅判定） ---------- */
    hallRegions.plaza = { type: "circle", x: 0, z: 20, r: 34 };
    hallRegions.hall1 = { type: "rect", x0: -10.5, z0: -9.5, x1: 10.5, z1: 5.5 };
    hallRegions.hall2 = { type: "rect", x0: -16.5, z0: -9.5, x1: -12.2, z1: 5.5 };

    // ===== 江南院落样板厅：hall2 花鸟画展区（新方案 · 第一栋）=====
    // TODO(组长): 其余五厅（hall0/hall1/hall3/hall4/hall5）与中央庭院
    //   按 docs/江南院落平面-坐标版.md §二 逐厅实现；完成后按 §七 拆改清单
    //   移除上方旧主楼与西侧连廊几何（当前为「样板厅 + 旧建筑」共存态）。
    buildHall2(group);

    return group;
  }

  /* ============================================================
   * 江南院落样板厅：hall2 花鸟画展区（新方案 · 第一栋样板）
   * 归属：组长 —— 外观
   * ------------------------------------------------------------
   * 坐标（冻结值，见 docs/江南院落平面-坐标版.md §二）：
   *   x −12~12、z −24~−8（24×16），入口朝南（z=−8 朝中央庭院）
   * 风貌要素：
   *   粉墙 0.35m 厚 / 黛瓦四坡顶（檐口 ≈4.6、出檐 1.2）/
   *   东西山墙马头墙叠落三阶 / 南墙入口两侧木格长窗 2.2×2.4 /
   *   屋顶北侧 6×4 天井 + 天光 SpotLight / 室内木地板（高 0.3）/
   *   入口 2 级台阶 / 门廊 4 朱柱 + 小四坡顶 + 2 灯笼
   * ------------------------------------------------------------
   * 约定：
   *   - 碰撞体 / hallRegions / 热点登记归组员1，本函数不主动 push
   *     obstacles、不写 hallRegions；addPainting 自带的射灯与热点
   *     为既有工具行为。
   *   - 挂画暂用现有 id 占位，组员4 config 合并后换新 id（见 TODO）。
   * ============================================================ */
  function buildHall2(parent) {
    var g = new _g.Group();
    parent.add(g);

    /* —— 常量（色板沿用全局，不得自创色值）—— */
    var FLOOR = 0.3;          // 室内地坪（比室外高 0.3m）
    var WALL_TOP = 4.45;      // 墙顶标高（檐口 4.6 − 檐口板半厚 0.15）
    var TH = 0.35;            // 墙厚
    var X0 = -12, X1 = 12;    // 面阔
    var Z0 = -24, Z1 = -8;    // 进深（z0 北、z1 南）

    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });  // 粉墙
    var capMat = mat(0x4b423a, { roughness: 0.85 });                       // 深压顶
    var stoneMat = mat(0xb9b0a0, { roughness: 0.9 });                      // 浅灰石材
    var tileMat = mat(0x484139, { roughness: 0.8 });                       // 深灰筒瓦

    /* —— 墙体四围 —— */
    // 北墙
    buildBox(g, X1 - X0, WALL_TOP, TH, 0, WALL_TOP / 2, Z0, wallMat);
    // 东西山墙（主体 0~4.45，马头墙在其上加高）
    buildBox(g, TH, WALL_TOP, Z1 - Z0, X1, WALL_TOP / 2, (Z0 + Z1) / 2, wallMat);
    buildBox(g, TH, WALL_TOP, Z1 - Z0, X0, WALL_TOP / 2, (Z0 + Z1) / 2, wallMat);
    // 南墙：左段 + 右段 + 门上横墙（门洞 x −2~2，净高 3.0）
    buildBox(g, 10, WALL_TOP, TH, -7, WALL_TOP / 2, Z1, wallMat);
    buildBox(g, 10, WALL_TOP, TH, 7, WALL_TOP / 2, Z1, wallMat);
    buildBox(g, 4, WALL_TOP - 3.0, TH, 0, 3.0 + (WALL_TOP - 3.0) / 2, Z1, wallMat);
    // 南墙木格长窗（门洞两侧各一樘 2.2×2.4，落地，中心 x=±5.6）
    var winMat = canvasMat(drawLattice(), { roughness: 0.55 });
    [-5.6, 5.6].forEach(function (wx) {
      buildBox(g, 2.2, 2.4, 0.16, wx, FLOOR + 1.2, Z1 - 0.09, winMat);
    });

    /* —— 马头墙（东西山墙叠落三阶，随屋面走向逐级升高）—— */
    // 三段顶标高：低 5.3 / 次 6.1 / 中 6.9（中段与屋脊 6.9 齐平）。
    // ASSUMPTION：坐标文档 §八「马头墙最高 5.5m」与四坡顶屋脊
    //   （檐口 4.6 + 举高 2.0 → 脊 6.9）不可兼得；此处取「三阶均高出
    //   屋面檐口、随坡升高」的视觉做法。若须严守 5.5m，需把屋顶举高
    //   降到 ≤0.6（屋脊≈5.5），请组长定夺。
    var horseTiers = [
      { z0: -19, z1: -13, top: 6.9 },   // 中段（屋脊附近）
      { z0: -22.5, z1: -19, top: 6.1 }, // 次段（北）
      { z0: -13, z1: -9.5, top: 6.1 },  // 次段（南）
      { z0: -24, z1: -22.5, top: 5.3 }, // 低段（北收头）
      { z0: -9.5, z1: -8, top: 5.3 },   // 低段（南收头）
    ];
    [-1, 1].forEach(function (side) {
      var x = side * 12;
      for (var i = 0; i < horseTiers.length; i++) {
        var t = horseTiers[i];
        var cz = (t.z0 + t.z1) / 2, len = t.z1 - t.z0;
        var h = t.top - WALL_TOP;
        // 阶梯墙体（从墙顶向上叠）
        buildBox(g, TH, h, len, x, WALL_TOP + h / 2, cz, wallMat);
        // 压顶瓦：水平三向挑出（x 两侧各 0.3、z 两端各 0.15）
        buildBox(g, TH + 0.6, 0.18, len + 0.3, x, t.top + 0.09, cz, capMat);
      }
    });

    /* —— 四坡黛瓦顶（檐口 4.6、出檐 1.2、举高 2.0 → 脊 6.9）—— */
    buildRoof(g, { x: 0, z: (Z0 + Z1) / 2, y: 4.6, w: X1 - X0, d: Z1 - Z0, h: 2.0, eave: 1.2, ridge: 9 });

    /* —— 屋顶北侧天井（6×4：x −3~3、z −23~−19）+ 天光 —— */
    buildHall2Skylight(g, FLOOR, tileMat, capMat);

    /* —— 室内木地板（比室外高 0.3）—— */
    var floor = new _g.Mesh(new _g.PlaneGeometry(X1 - X0 - 0.7, Z1 - Z0 - 0.7), canvasMat(drawWood(), { roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR, (Z0 + Z1) / 2);
    floor.receiveShadow = true;
    g.add(floor);

    /* —— 室内顶板（天井区域开口，拆四块；底 4.15 → 净高 3.85）—— */
    var ceilY = WALL_TOP - 0.15;
    buildBox(g, X1 - X0 - 0.7, 0.3, 0.825, 0, ceilY, -23.41, wallMat);   // 天井以北窄条
    buildBox(g, 8.825, 0.3, 4.0, -7.41, ceilY, -21, wallMat);             // 天井以西
    buildBox(g, 8.825, 0.3, 4.0, 7.41, ceilY, -21, wallMat);              // 天井以东
    buildBox(g, X1 - X0 - 0.7, 0.3, 10.825, 0, ceilY, -13.59, wallMat);   // 天井以南

    /* —— 北墙挂画（花鸟三帧，暂以现有 id 占位）—— */
    // TODO(组员4 config 合并后换成 xieshengzhenqintu / wuniutu / molantu
    addPainting(g, { x: -7, y: 2.55, z: -23.5, ry: 0 }, 2.2, 1.5, "qianlijiangshan"); // TODO: 写生珍禽图
    addPainting(g, { x: 0, y: 2.55, z: -23.5, ry: 0 }, 3.4, 2.2, "fuchunshanjv");     // TODO: 五牛图
    addPainting(g, { x: 7, y: 2.55, z: -23.5, ry: 0 }, 2.2, 1.5, "hanxizai");          // TODO: 墨兰图

    /* —— 室内基础照明 —— */
    var roomA = new _g.PointLight(0xffe6c4, 0.55, 20, 2);
    roomA.position.set(0, 3.8, -16);
    g.add(roomA);
    var roomB = new _g.PointLight(0xffe6c4, 0.4, 16, 2);
    roomB.position.set(-6, 3.6, -19);
    g.add(roomB);

    /* —— 入口台阶（2 级，室外 0 → 室内 0.3）—— */
    buildBox(g, 4.0, 0.15, 0.8, 0, 0.225, -7.2, stoneMat);  // 第 2 级（高，顶 0.3）
    buildBox(g, 5.0, 0.15, 0.8, 0, 0.075, -6.4, stoneMat);  // 第 1 级（低，顶 0.15）

    /* —— 入口门廊（4 朱柱 + 小四坡顶 + 2 灯笼）—— */
    var colGeo = new _g.CylinderGeometry(0.16, 0.2, 3.25, 10);
    var colMat = mat(0x9c3a2c, { roughness: 0.55 });          // 朱砂
    [-5.0, -2.2, 2.2, 5.0].forEach(function (x) {
      var col = new _g.Mesh(colGeo, colMat);
      col.position.set(x, 1.625, -6.0);
      col.castShadow = true;
      g.add(col);
    });
    // 门廊小四坡顶（檐口 3.4、脊 4.45，低于大厅檐口 4.6；北缘 z=−7.7 不穿南墙）
    buildRoof(g, { x: 0, z: -6.6, y: 3.4, w: 9.0, d: 1.6, h: 0.75, eave: 0.3, ridge: 6.0 });
    // 檐下灯笼（悬挂点取檐口板底 3.25 之下，避免插进顶板）
    buildLantern(g, -2.8, 2.5, -6.6, 0.9);
    buildLantern(g, 2.8, 2.5, -6.6, 0.9);
  }

  /* hall2 天井：屋顶北坡 6×4 井口（亮面 + 瓦框）+ 室内井壁 + 天光 */
  function buildHall2Skylight(parent, floorY, tileMat, capMat) {
    var W = 6, D = 4;          // 井口 6（x）× 4（z）
    var cx = 0, cz = -21;      // 井口中心（北坡中段）
    var slope = -0.24;         // 贴北坡角度（举高 2.0 / 半深 8 → 约 14°）
    var darkMat = mat(0x4b423a, { roughness: 0.95 });  // 深压顶（井壁）
    // 北坡面标高：z=−24 处 4.9（檐口板顶），每向南 1m 升 0.25 → y(z)=4.9+0.25*(z+24)
    var slopeY = function (z) { return 4.9 + 0.25 * (z + 24); };

    // 井口亮面（自发光，模拟天光透入；贴北坡、高于坡面 0.13）
    var mouth = new _g.Mesh(
      new _g.BoxGeometry(W, 0.12, D),
      new _g.MeshStandardMaterial({
        color: 0xd8e0d8, emissive: 0xfff4e0, emissiveIntensity: 0.55, roughness: 0.6,
      })
    );
    mouth.rotation.x = slope;
    mouth.position.set(cx, slopeY(cz) + 0.13, cz);
    parent.add(mouth);

    // 井口压边（瓦色细框，随坡面贴合）
    [[0, -2.35, W + 0.4, 0.2], [0, 2.35, W + 0.4, 0.2]].forEach(function (p) {
      var rim = new _g.Mesh(new _g.BoxGeometry(p[2], 0.22, p[3]), tileMat);
      rim.rotation.x = slope;
      rim.position.set(cx, slopeY(cz + p[1]) + 0.13, cz + p[1]);
      parent.add(rim);
    });
    [[-3.35, 0, 0.2, D + 0.4], [3.35, 0, 0.2, D + 0.4]].forEach(function (p) {
      var rim = new _g.Mesh(new _g.BoxGeometry(p[2], 0.22, p[3]), tileMat);
      rim.rotation.x = slope;
      rim.position.set(cx + p[0], slopeY(cz) + 0.13, cz);
      parent.add(rim);
    });

    // 室内井壁（顶板开口四周，从顶板底 4.15 向上到坡面）
    var wellH = 1.5;
    var wellY = 4.15 + wellH / 2;
    buildBox(parent, W, wellH, 0.15, cx, wellY, cz - D / 2, darkMat);   // 北壁
    buildBox(parent, W, wellH, 0.15, cx, wellY, cz + D / 2, darkMat);   // 南壁
    buildBox(parent, 0.15, wellH, D, cx - W / 2, wellY, cz, darkMat);   // 西壁
    buildBox(parent, 0.15, wellH, D, cx + W / 2, wellY, cz, darkMat);   // 东壁

    // 天光：从天井口向下打（0xfff4e0，强度 0.6），target 指向室内地面
    var skylight = new _g.SpotLight(0xfff4e0, 0.6, 14, Math.PI / 5, 0.5, 1.5);
    skylight.position.set(cx, 5.2, cz);
    skylight.target.position.set(cx, floorY, cz);
    parent.add(skylight);
    parent.add(skylight.target);
  }

  function buildBox(parent, w, h, d, x, y, z, m) {
    var mesh = new _g.Mesh(new _g.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  /* 展台 + 器物/雕塑 */
  function addPedestal(parent, x, exhibitId, signText) {
    var base = new _g.Mesh(new _g.BoxGeometry(1.5, 1.05, 1.5), mat(0x7a5c48, { roughness: 0.75 }));
    base.position.set(x, 0.71 + 0.525, -2);
    base.castShadow = true;
    parent.add(base);
    obstacles.push({ type: "circle", x: x, z: -2, r: 1.0 });

    var artifact;
    if (exhibitId === "houmuwuding") {
      artifact = buildDing();
    } else {
      artifact = buildWarrior();
    }
    artifact.position.set(x, 0.71 + 1.05, -2);
    artifact.castShadow = true;
    parent.add(artifact);

    // 说明牌：立于展台前方（+z 方向为参观者来向），y=1.05 与其它展签一致
    addSign(parent, x, 1.05, -0.7, signText);
    registerSpot({ exhibitId: exhibitId, x: x, y: 1.76, z: -2, radius: 2.6 });
  }

  /* 后母戊鼎（简化几何） */
  function buildDing() {
    var g = new _g.Group();
    var bronze = mat(0x4f5a3c, { roughness: 0.42, metalness: 0.55 });
    var body = new _g.Mesh(new _g.CylinderGeometry(0.52, 0.44, 0.62, 16), bronze);
    body.position.y = 0.31;
    g.add(body);
    var band = new _g.Mesh(new _g.CylinderGeometry(0.545, 0.545, 0.1, 16), mat(0x3c4530, { roughness: 0.5, metalness: 0.5 }));
    band.position.y = 0.42;
    g.add(band);
    [[-0.36, 0.62], [0.36, 0.62], [0, -0.42]].forEach(function (p) {
      var foot = new _g.Mesh(new _g.CylinderGeometry(0.07, 0.09, 0.34, 8), bronze);
      foot.position.set(p[0], 0.17, p[1]);
      g.add(foot);
    });
    [[-0.42, 0], [0.42, 0]].forEach(function (p) {
      var ear = new _g.Mesh(new _g.BoxGeometry(0.12, 0.34, 0.26), bronze);
      ear.position.set(p[0], 0.72, p[1]);
      g.add(ear);
    });
    return g;
  }

  /* 将军俑（简化陶塑） */
  function buildWarrior() {
    var g = new _g.Group();
    var clay = mat(0x9c7a55, { roughness: 0.95 });
    var base = new _g.Mesh(new _g.CylinderGeometry(0.26, 0.32, 0.08, 12), mat(0x7a5c48));
    base.position.y = 0.04;
    g.add(base);
    var body = new _g.Mesh(new _g.CylinderGeometry(0.19, 0.24, 0.9, 12), clay);
    body.position.y = 0.53;
    g.add(body);
    var head = new _g.Mesh(new _g.SphereGeometry(0.15, 12, 10), clay);
    head.position.y = 1.1;
    g.add(head);
    var helmet = new _g.Mesh(new _g.CylinderGeometry(0.16, 0.17, 0.12, 10), clay);
    helmet.position.y = 1.24;
    g.add(helmet);
    var armor = new _g.Mesh(new _g.CylinderGeometry(0.22, 0.24, 0.16, 12), mat(0x8a6a48, { roughness: 0.9 }));
    armor.position.y = 0.66;
    g.add(armor);
    return g;
  }

  /* 画作挂墙（带画框 + 说明牌 + 射灯） */
  function addPainting(parent, pos, w, h, exhibitId) {
    var ex = findExhibit(exhibitId);
    if (!ex) return;

    // 画芯
    var art = new _g.Mesh(
      new _g.PlaneGeometry(w, h),
      canvasMat(drawPainting(ex), { side: _g.DoubleSide })
    );
    art.position.set(pos.x, pos.y, pos.z);
    art.rotation.y = pos.ry || 0;
    art.castShadow = true;
    parent.add(art);

    // 木框（四条）
    var frameMat = mat(0x6d5544, { roughness: 0.7 });
    var t = 0.07;
    addFrameBox(parent, w + t * 2, t, h + t * 2, pos.x, pos.y, pos.z - 0.02, pos.ry, frameMat);
    addFrameBox(parent, t, h + t * 2, w + t * 2, pos.x, pos.y, pos.z - 0.02, pos.ry, frameMat);

    // 说明牌（画下）
    addSign(parent, pos.x, pos.y - h / 2 - 0.4, pos.z, ex.title + " · " + ex.dynasty);

    // 射灯：必须显式设置 target 并把 target 加入场景图。
    // three.js 的 SpotLight 不设 target 时会一直照向世界原点 (0,0,0)——
    // 上一版每幅画都挂了射灯，但实际没有一盏照在画上。
    // lamp：灯具相对画面的水平偏移（默认 [0, 0.9]，即朝展厅内侧）
    var lampDx = pos.lamp ? pos.lamp[0] : 0;
    var lampDz = pos.lamp ? pos.lamp[1] : 0.9;
    var lampY = pos.y + h / 2 + 1.0;
    var spot = new _g.SpotLight(0xffe9c9, 0.95, 10, Math.PI / 7, 0.55, 1.4);
    spot.position.set(pos.x + lampDx, lampY, pos.z + lampDz);
    spot.target.position.set(pos.x, pos.y, pos.z);
    parent.add(spot);
    parent.add(spot.target);
    var fixture = new _g.Mesh(new _g.CylinderGeometry(0.1, 0.06, 0.28, 10), mat(0x2f2b26, { roughness: 0.5, metalness: 0.3 }));
    fixture.position.set(pos.x + lampDx, lampY, pos.z + lampDz);
    parent.add(fixture);

    registerSpot({ exhibitId: exhibitId, x: pos.x, y: pos.y, z: pos.z, radius: 2.8 });
  }

  function addFrameBox(parent, w, h, d, x, y, z, ry, m) {
    var mesh = new _g.Mesh(new _g.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z - 0.03);
    mesh.rotation.y = ry || 0;
    parent.add(mesh);
  }

  /* 说明牌 */
  function addSign(parent, x, y, z, text) {
    text = String(text == null ? "" : text);
    var sign = new _g.Mesh(
      new _g.PlaneGeometry(1.15, 0.62),
      canvasMat(drawSign(text.split(" · ")[0], text.split(" · ")[1] || ""), { side: _g.DoubleSide })
    );
    sign.position.set(x, y, z);
    parent.add(sign);
    var pole = new _g.Mesh(new _g.CylinderGeometry(0.025, 0.025, 0.4, 6), mat(0x3f3a35));
    pole.position.set(x, y - 0.5, z);
    parent.add(pole);
  }

  /* 西侧连廊（文明对话厅） */
  function buildCorridor(root, museumGroup) {
    var g = new _g.Group();
    root.add(g);

    // 廊地面
    var floor = new _g.Mesh(new _g.PlaneGeometry(4.6, 15), canvasMat(drawWood(), { roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-14.5, 0.73, -2);
    floor.receiveShadow = true;
    g.add(floor);

    // 立柱（连廊外侧）
    var colGeo = new _g.CylinderGeometry(0.14, 0.18, 3.4, 8);
    var colMat = mat(0x9c3a2c, { roughness: 0.55 });
    for (var z = -7; z <= 3.2; z += 3.4) {
      var col = new _g.Mesh(colGeo, colMat);
      col.position.set(-16.8, 2.4, z);
      col.castShadow = true;
      g.add(col);
      obstacles.push({ type: "circle", x: -16.8, z: z, r: 0.4 });
    }
    // 内侧为博物馆西墙，外侧立柱 + 顶

    // 廊顶：改为瓦面四坡顶 + 飞檐，与主楼同一套语汇（正脊顺走廊方向）
    buildRoof(g, { x: -14.5, z: -2, y: 4.15, w: 5.0, d: 15.2, h: 1.35, eave: 0.9, ridge: 12.0, axis: "z" });

    // 美人靠栏杆（沿外侧柱列，坐面高出廊面 0.6）
    buildRailing(g, -16.8, -7.4, 3.6, 1, 0.73);

    // 展墙：原来这两幅画悬在半空、背后没有墙，画背朝着参观者。
    // 现沿走廊内侧立一道展墙，画挂在墙上、法线朝西面向走廊。
    var galleryWall = new _g.Mesh(new _g.BoxGeometry(0.3, 3.5, 15.2), mat(0xefe9dc, { roughness: 0.9 }));
    galleryWall.position.set(-12.35, 2.48, -2);
    galleryWall.castShadow = true;
    galleryWall.receiveShadow = true;
    g.add(galleryWall);
    buildBox(g, 0.46, 0.18, 15.2, -12.35, 4.23, -2, mat(0x6d5544, { roughness: 0.75 }));
    // 展墙不单独登记碰撞体：被西外墙碰撞体 x[-13,-10.6] 完全包含，登记了也撞不到
    //（组员1 复核结论，PR #1）。注意：若日后收窄西外墙碰撞体，需重新评估展墙是否单独登记。

    // 展墙挂画（蒙娜丽莎、星月夜 → 文明对话厅）
    addPainting(g, { x: -12.62, y: 2.5, z: -4.5, ry: -Math.PI / 2, lamp: [-0.9, 0] }, 2.4, 1.6, "monalisa");
    addPainting(g, { x: -12.62, y: 2.5, z: 0.6, ry: -Math.PI / 2, lamp: [-0.9, 0] }, 2.4, 1.6, "starrynight");

    // 廊内照明
    var light = new _g.PointLight(0xffe6c4, 0.7, 16, 2);
    light.position.set(-14.5, 3.8, -2);
    g.add(light);

    // 连廊出口碰撞（只挡外侧，入口开放）
    obstacles.push({ type: "rect", x0: -17.2, z0: -8.8, x1: -16.4, z1: 4.8 });
  }

  /* 前庭雕塑（铜奔马，抽象几何示意） */
  function addPlazaSculpture(root, x, z, exhibitId, signText) {
    var g = new _g.Group();
    var bronze = mat(0x4f5a3c, { roughness: 0.4, metalness: 0.6 });
    var base = new _g.Mesh(new _g.CylinderGeometry(1.0, 1.15, 0.5, 14), mat(0x8a8578, { roughness: 0.85 }));
    base.position.y = 0.25;
    g.add(base);

    // 抽象奔马：斜置圆环 + 支撑（示意，组员6 可换 glb）
    var ring = new _g.Mesh(new _g.TorusGeometry(0.8, 0.13, 10, 24), bronze);
    ring.rotation.x = Math.PI / 2.4;
    ring.rotation.z = 0.35;
    ring.position.set(0, 1.35, 0.15);
    g.add(ring);
    var spear = new _g.Mesh(new _g.CylinderGeometry(0.03, 0.03, 1.9, 6), bronze);
    spear.position.set(0.28, 1.0, -0.28);
    spear.rotation.z = 0.3;
    g.add(spear);

    g.position.set(x, 0.75, z);
    g.castShadow = true;
    root.add(g);

    addSign(root, x, 1.05, z - 1.5, signText);
    obstacles.push({ type: "circle", x: x, z: z, r: 1.6 });
    registerSpot({ exhibitId: exhibitId, x: x, y: 1.5, z: z, radius: 3.4 });
  }

  /* 石狮（门口，简化几何） */
  function addStoneLion(root, x, z, dir) {
    var g = new _g.Group();
    var stone = mat(0xa8a297, { roughness: 0.95 });
    var base = new _g.Mesh(new _g.BoxGeometry(1.3, 0.55, 0.95), mat(0x8a8578));
    base.position.y = 0.27;
    g.add(base);
    var body = new _g.Mesh(new _g.BoxGeometry(0.72, 0.62, 0.5), stone);
    body.position.set(0, 0.86, 0);
    g.add(body);
    var head = new _g.Mesh(new _g.SphereGeometry(0.3, 10, 8), stone);
    head.position.set(0.18 * dir, 1.32, 0);
    g.add(head);
    var ear = new _g.Mesh(new _g.BoxGeometry(0.12, 0.12, 0.1), stone);
    ear.position.set(0.3 * dir, 1.56, 0);
    g.add(ear);

    g.position.set(x, 0.75, z);
    g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.scale.setScalar(1.4);
    root.add(g);
    obstacles.push({ type: "circle", x: x, z: z, r: 0.9 });
  }

  /* ============================================================
   * 展品热点登记
   * ============================================================ */
  function registerSpot(spot) {
    spotMeshes.push(spot);
  }

  function findExhibit(id) {
    return window.MuseumConfig.exhibits.find(function (e) { return e.id === id; });
  }

  /* ============================================================
   * 对外 API
   * ============================================================ */
  return {
    init: function (opts) {
      scene = opts.scene;
      camera = opts.camera;
      obstacles.length = 0;
      spotMeshes.length = 0;

      // 主楼 + 连廊（hall1 / hall2）
      var museum = buildMuseum(scene);
      // 园区（plaza）
      buildPlaza(scene);

      // 全场景光照：环境光压一档、天光提亮，明暗关系更清楚
      var ambient = new _g.AmbientLight(0xffffff, 0.45);
      scene.add(ambient);
      var hemi = new _g.HemisphereLight(0xfff4e0, 0x3b3228, 0.75);
      scene.add(hemi);
      var sun = new _g.DirectionalLight(0xfff0d8, 1.6);
      sun.position.set(14, 22, 18);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 60;
      scene.add(sun);

      // 背光面补光（太阳在东南向，主楼北侧原为死黑）
      var fill = new _g.DirectionalLight(0xdfe6f2, 0.3);
      fill.position.set(-16, 14, -20);
      scene.add(fill);

      scene.fog = new _g.Fog(0xd9d4c8, 52, 135);
    },

    update: function () {
      // 预留：环境动画（如树冠轻摇、水面等），组员1 可在此扩展
    },

    obstacles: obstacles,
    spotMeshes: spotMeshes,
    hallRegions: hallRegions,
    getHallAt: function (x, z) {
      // 先判具体展厅（矩形），再判前庭（大圆）。
      // 否则前庭那圈 r=34 的判定会把整座楼都盖住，室内永远显示「前庭 · 园区」。
      var rects = [], circles = [];
      for (var id in hallRegions) {
        if (hallRegions[id].type === "circle") circles.push(id);
        else rects.push(id);
      }
      var order = rects.concat(circles);
      for (var i = 0; i < order.length; i++) {
        var r = hallRegions[order[i]];
        if (r.type === "circle") {
          var dx = x - r.x, dz = z - r.z;
          if (dx * dx + dz * dz <= r.r * r.r) return order[i];
        } else {
          if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return order[i];
        }
      }
      return null;
    },
  };
})();