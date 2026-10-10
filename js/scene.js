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
  var animWindowDoors = [];     // 微风摆动的窗扇门（buildPartWindowWall 注册）
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

  /* 粉墙纹理：宣纸白 + 极轻斑驳 + 墙脚泛潮，替换原来的纯色平板墙 */
  function drawPlaster() {
    var cv = makeCanvas(256, 256);
    var ctx = cv.ctx;
    ctx.fillStyle = "#f4efe5";
    fillRect(ctx, 0, 0, 256, 256);
    for (var i = 0; i < 240; i++) {
      var x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 26;
      var a = 0.02 + Math.random() * 0.055;
      var g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
      g2.addColorStop(0, Math.random() > 0.5 ? "rgba(212,203,186," + a + ")" : "rgba(255,255,255," + a + ")");
      g2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g2;
      fillRect(ctx, x - r, y - r, r * 2, r * 2);
    }
    var damp = ctx.createLinearGradient(0, 222, 0, 256);
    damp.addColorStop(0, "rgba(146,138,122,0)");
    damp.addColorStop(1, "rgba(146,138,122,0.24)");
    ctx.fillStyle = damp;
    fillRect(ctx, 0, 222, 256, 34);
    return cv.canvas;
  }

  /* 石基纹理：浅灰条石 + 水平石缝（参考图"石基与墙身有清晰分界线"） */
  function drawStoneBase() {
    var cv = makeCanvas(256, 256);
    var ctx = cv.ctx;
    ctx.fillStyle = "#9a9488";
    fillRect(ctx, 0, 0, 256, 256);
    for (var row = 0; row < 4; row++) {
      var y = row * 64;
      for (var col = -1; col < 3; col++) {
        var w = 100 + Math.floor(Math.random() * 40);
        var x = col * 128 + (row % 2 ? 64 : 0);
        var s = 138 + Math.floor(Math.random() * 26);
        ctx.fillStyle = "rgb(" + s + "," + (s - 4) + "," + (s - 14) + ")";
        fillRect(ctx, x + 3, y + 4, w - 6, 56);
      }
      ctx.fillStyle = "rgba(70,66,57,0.52)";
      fillRect(ctx, 0, y, 256, 4);
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

    /* 坡面：优先用举折（凹曲）屋面，翼角自带上翘 —— 构件移植自外观原型
       （tools/exterior-prototype.html 的 hipGeo）；没有该模块时退回平面四坡。 */
    var useHip = !!(window.MuseumExterior && window.MuseumExterior.hipGeo);
    var geo;
    if (useHip) {
      geo = window.MuseumExterior.hipGeo(w, d, h, Math.min(0.5, 0.14 + Math.max(w, d) * 0.018));
      geo.translate(0, 0.3, 0);
    } else {
      var A = [-a, 0.3, -b], B = [a, 0.3, -b], C = [a, 0.3, b], D = [-a, 0.3, b];
      var P = [-c, 0.3 + h, 0], Q = [c, 0.3 + h, 0];
      var tris = [
        A, B, Q, A, Q, P,
        D, C, P, C, Q, P,
        B, Q, C,
        P, A, D,
      ];
      var pos = [], uv = [];
      for (var i = 0; i < tris.length; i++) {
        var v = tris[i];
        pos.push(v[0], v[1], v[2]);
        uv.push((v[0] + a) / (2 * a), (v[2] + b) / (2 * b));
      }
      geo = new _g.BufferGeometry();
      geo.setAttribute("position", new _g.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new _g.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
    }

    var tileTex = new _g.CanvasTexture(drawTile());
    tileTex.encoding = _g.sRGBEncoding;
    tileTex.wrapS = tileTex.wrapT = _g.RepeatWrapping;
    /* 举折屋面的 UV 单位是"米"，平面四坡是 0~1，重复率要分开设 */
    tileTex.repeat.set(useHip ? 0.35 : 3, useHip ? 0.25 : 1.6);
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

    /* 草丛：GLB 实例撒点（低面数 grass-tuft，有资产才铺） */
    if (window.MuseumModels) {
      window.MuseumModels.scatter(root, "grass-tuft",
        { x0: x0 + 0.5, x1: x1 - 0.5, z0: z0 + 0.5, z1: z1 - 0.5 },
        18, { seed: x0 + z0, scaleMin: 0.8, scaleMax: 1.4 });
    }

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

  /* ============================================================
   * 墙体系统（按参考图重构 · 2026-09-23）
   * 依据：docs/reference-images/facade.png、xuting-components.png
   *   ① 石基（墙裙）：浅灰条石，高约墙高 1/8，比墙面出挑 70mm，
   *      与墙身之间有一条清晰的水平分界线
   *   ② 粉墙身：白粉墙，暖白带极轻斑驳（不用纯色平板）
   *   ③ 砖砌边框：浅灰砖镶边（两端竖框 + 石基上的勒脚线 + 洞口套框），
   *      对应参考图"中间为白色墙面，两侧有砖砌边框"
   *   ④ 瓦压顶：青黑瓦双坡收头，两侧各出挑 120mm，端部微翘
   *   ⑤ 马头墙：三级水平阶梯，逐级黑瓦压顶
   * 局部坐标：x 沿墙长（-len/2 … len/2），z 沿墙厚，y 自墙脚起
   * ============================================================ */
  var WALL_PAL = {
    base: 0x9a9488,
    frame: 0xa39d90,
    tile: 0x3e3934,
    wood: 0x7c4436
  };
  var _wallMats = {};
  function wallMat(kind) {
    if (_wallMats[kind]) return _wallMats[kind];
    var m;
    if (kind === "plaster") m = canvasMat(drawPlaster(), { roughness: 0.95, side: _g.DoubleSide });
    else if (kind === "base") m = canvasMat(drawStoneBase(), { roughness: 0.92 });
    else if (kind === "frame") m = canvasMat(drawBrick(), { roughness: 0.93, side: _g.DoubleSide });
    else if (kind === "tile") m = canvasMat(drawTile(), { roughness: 0.86 });
    else m = mat(WALL_PAL.wood, { roughness: 0.72 });
    _wallMats[kind] = m;
    return m;
  }

  /* 瓦压顶：双坡小瓦顶收头，端部微翘（参考图"黑色瓦片，边缘略向外挑出"） */
  function buildPartWallCoping(g, len, th, y, tileMat) {
    var over = 0.12;
    var half = th / 2 + over;
    var slopeLen = Math.sqrt(half * half + 0.13 * 0.13);
    [1, -1].forEach(function (s) {
      var slope = new _g.Mesh(new _g.BoxGeometry(len, 0.07, slopeLen * 2), tileMat);
      slope.rotation.x = s * 0.42;
      slope.position.set(0, y + 0.075, s * half / 2);
      slope.castShadow = true;
      slope.receiveShadow = true;
      g.add(slope);
    });
    buildBox(g, len, 0.09, 0.2, 0, y + 0.17, 0, tileMat);
    [-1, 1].forEach(function (e) {
      buildBox(g, 0.26, 0.16, th + over * 2, e * (len / 2 - 0.13), y + 0.15, 0, tileMat);
      var tip = new _g.Mesh(new _g.BoxGeometry(0.34, 0.1, th + over * 2), tileMat);
      tip.rotation.z = e * 0.34;
      tip.position.set(e * (len / 2 + 0.02), y + 0.26, 0);
      tip.castShadow = true;
      g.add(tip);
    });
  }

  /* 入口台阶：地面 → 门洞底，三级石阶（参考图"台阶组件 / 浅米色石板"）
   * 在墙的局部坐标里：x 沿墙长，z 朝外为正 */
  function buildPartDoorSteps(g, u, doorW, topY, outward, th) {
    var stone = wallMat("base");
    var n = 3, stepH = topY / n, stepD = 0.32;
    for (var i = 0; i < n; i++) {
      var h = stepH * (i + 1), depth = stepD * (n - i);
      var m = new _g.Mesh(new _g.BoxGeometry(Math.max(1.2, doorW + 0.6 - i * 0.2), h, depth), stone);
      m.position.set(u, h / 2, outward * (th / 2 + 0.04 + depth / 2));
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  }
  /* 一段墙：石基 + 粉墙身 + 砖砌边框 + 瓦压顶，洞口按 kind 切段
   * opt: { cx, cz, len, h, th, ry, baseY, plinth, frame, pilasters, coping,
   *        openings:[{kind:'door'|'window', u, w, h, sill}] } */
  function buildPartWallRun(parent, opt) {
    var len = opt.len, h = opt.h;
    var th = opt.th === undefined ? 0.36 : opt.th;
    var plinth = opt.plinth === undefined ? 0.46 : opt.plinth;
    var frame = opt.frame === undefined ? 0.26 : opt.frame;
    var g = new _g.Group();
    g.position.set(opt.cx, opt.baseY || 0, opt.cz);
    g.rotation.y = opt.ry || 0;
    g.name = opt.name || "wall";
    parent.add(g);

    var plaster = wallMat("plaster"), stone = wallMat("base");
    var brick = wallMat("frame"), tile = wallMat("tile"), wood = wallMat("wood");

    buildBox(g, len, plinth, th + 0.14, 0, plinth / 2, 0, stone);
    var sillLine = frame * 0.5;
    buildBox(g, len, sillLine, th + 0.06, 0, plinth + sillLine / 2, 0, brick);

    var bodyY = plinth + sillLine, bodyH = h - bodyY;
    var openings = (opt.openings || []).slice().sort(function (a, b) { return a.u - b.u; });

    var cursor = -len / 2, spans = [];
    openings.forEach(function (o) {
      var l = o.u - o.w / 2, r = o.u + o.w / 2;
      if (l > cursor + 0.01) spans.push([cursor, l]);
      cursor = Math.max(cursor, r);
    });
    if (cursor < len / 2 - 0.01) spans.push([cursor, len / 2]);
    spans.forEach(function (s) {
      buildBox(g, s[1] - s[0], bodyH, th, (s[0] + s[1]) / 2, bodyY + bodyH / 2, 0, plaster);
    });

    openings.forEach(function (o) {
      var ow = o.w, oh = o.h, sill = o.sill || 0;
      if (o.kind === "door") {
        if (oh < bodyH) buildBox(g, ow, bodyH - oh, th, o.u, bodyY + oh + (bodyH - oh) / 2, 0, plaster);
        buildBox(g, 0.16, oh + 0.12, th + 0.08, o.u - ow / 2 - 0.08, bodyY + (oh + 0.12) / 2, 0, brick);
        buildBox(g, 0.16, oh + 0.12, th + 0.08, o.u + ow / 2 + 0.08, bodyY + (oh + 0.12) / 2, 0, brick);
        buildBox(g, ow + 0.32, 0.18, th + 0.08, o.u, bodyY + oh + 0.09, 0, brick);
        if (opt.steps !== false) buildPartDoorSteps(g, o.u, ow, bodyY, opt.outward || 1, th);
        /* 双扇门：大敞开 —— 绕门轴转到 80°，两扇都朝墙外侧折开，洞口全通透 */
        var leafW = ow / 2 - 0.04, openA = 1.40;
        [-1, 1].forEach(function (s) {
          var hinge = o.u + s * (ow / 2);
          var leaf = new _g.Mesh(new _g.BoxGeometry(leafW, oh - 0.06, 0.06), wood);
          leaf.position.set(hinge - s * (leafW / 2) * Math.cos(openA),
                            bodyY + (oh - 0.06) / 2,
                            (opt.outward || 1) * (leafW / 2) * Math.sin(openA));
          leaf.rotation.y = s * openA;
          leaf.castShadow = true;
          g.add(leaf);
        });
      } else {
        var wh = oh || 1.2;
        if (sill > 0) buildBox(g, ow, sill, th, o.u, bodyY + sill / 2, 0, plaster);
        if (bodyH > sill + wh) buildBox(g, ow, bodyH - sill - wh, th, o.u, bodyY + sill + wh + (bodyH - sill - wh) / 2, 0, plaster);
        buildBox(g, 0.18, wh + 0.24, th + 0.08, o.u - ow / 2 - 0.09, bodyY + sill + wh / 2, 0, brick);
        buildBox(g, 0.18, wh + 0.24, th + 0.08, o.u + ow / 2 + 0.09, bodyY + sill + wh / 2, 0, brick);
        buildBox(g, ow + 0.36, 0.18, th + 0.08, o.u, bodyY + sill - 0.09, 0, brick);
        buildBox(g, ow + 0.36, 0.18, th + 0.08, o.u, bodyY + sill + wh + 0.09, 0, brick);
        var pane = new _g.Mesh(new _g.PlaneGeometry(ow, wh), canvasMat(drawLattice(), { roughness: 0.55, side: _g.DoubleSide }));
        pane.position.set(o.u, bodyY + sill + wh / 2, th / 2 - 0.02);
        g.add(pane);
        var pane2 = pane.clone();
        pane2.position.z = -th / 2 + 0.02;
        pane2.rotation.y = Math.PI;
        g.add(pane2);
      }
    });

    if (frame) {
      [-1, 1].forEach(function (s) {
        buildBox(g, frame, h, th + 0.06, s * (len / 2 + frame / 2), h / 2, 0, brick);
      });
    }
    if (opt.pilasters) {
      var n = Math.max(1, Math.round(len / opt.pilasters));
      for (var i = 1; i < n; i++) {
        buildBox(g, 0.42, h, th + 0.1, -len / 2 + (len / n) * i, h / 2, 0, brick);
      }
    }
    if (opt.coping !== false) buildPartWallCoping(g, len + (frame ? frame * 2 : 0), th, h, tile);
    return g;
  }

  function buildWall(root, cx, cz, len, rotY) {
    buildPartWallRun(root, {
      cx: cx, cz: cz, len: len, h: 2.6, th: 0.42, ry: rotY,
      plinth: 0.38, frame: 0.3, pilasters: 7.5, name: "outer-wall"
    });
    if (Math.abs(rotY) < 0.01) {
      obstacles.push({ type: "rect", x0: cx - len / 2, z0: cz - 0.4, x1: cx + len / 2, z1: cz + 0.4 });
    } else {
      obstacles.push({ type: "rect", x0: cx - 0.4, z0: cz - len / 2, x1: cx + 0.4, z1: cz + len / 2 });
    }
  }

  function buildWallWithGap(root) {
    [-1, 1].forEach(function (side) {
      var x0 = side > 0 ? 4.6 : -44, x1 = side > 0 ? 44 : -4.6;
      buildPartWallRun(root, {
        cx: (x0 + x1) / 2, cz: 44, len: x1 - x0, h: 2.6, th: 0.42,
        plinth: 0.38, frame: 0.3, pilasters: 7.5, name: "outer-wall-south"
      });
      obstacles.push({ type: "rect", x0: x0, z0: 43.6, x1: x1, z1: 44.4 });
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
    addPainting(g, { x: -7, y: 2.55, z: -23.5, ry: 0 }, 2.2, 1.5, "xieshengzhenqintu");
    addPainting(g, { x: 0, y: 2.55, z: -23.5, ry: 0 }, 3.4, 2.2, "wuniutu");
    addPainting(g, { x: 7, y: 2.55, z: -23.5, ry: 0 }, 2.2, 1.5, "molantu");


    /* —— 标题匾 —— */
    buildPartHallTitle(g, "花鸟清趣", "万物有灵 诗意栖居", 0, 4.0, -23.35, 0);

    /* —— 天花木梁 —— */
    buildPartCeilingBeams(g, 22.4, 14.4, 4.0);

    /* —— 墙根石座 / 条凳 —— */
    buildPartBench(g, -10.5, -13, 0);
    buildPartBench(g, 10.5, -13, 0);
    buildPartBench(g, -10.5, -19, 0);
    buildPartBench(g, 10.5, -19, 0);

    /* —— 竹盆景点缀 —— */
    buildPartPottedPlant(g, -10.5, -9.5);
    buildPartPottedPlant(g, 10.5, -9.5);
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
   * 江南文人国画博物馆 · 零件库 + 场景装配
   * 归属：组长（组员7）
   * 坐标依据：docs/江南院落平面-坐标版.md v1
   * 设计思路：先拆零件 → 再按平面图装配，方便单独迭代每个零件。
   * 约定：
   *   - 本文件只负责外观几何、材质、灯光；
   *   - 碰撞体 / hallRegions / 热点精细登记归组员1。
   * ============================================================ */

  /* ---------- 1. 总装配 ---------- */
  function buildJiangnanCompound(root) {
    buildPartGround(root);
    buildPartOuterWall(root);
    buildPartZoneWalls(root);   // 按总平面图补分区院墙
    buildPartImportedProps(root);   // 现成资产：景观石 / 草丛 / 枯木 / 冷杉
    buildPartGate(root, 0, 42.2);
    buildPartTree(root, -7.5, 35.5, "willow");
    buildPartTree(root, 7.5, 35.5, "camphor");
    buildPartTree(root, -7.5, 40, "camphor");
    buildPartTree(root, 7.5, 40, "willow");

    buildPartCourtyard(root);
    /* 回廊骨架：两侧长廓把北三厅与序厅串起来，南廊/北廊把它们横向连通，
       对应参考图"廊子把各功能区串成一个整体"的格局 */
    buildPartCorridor(root, -16, -13, -4, 24, 1);   // 西廊：北廊 → 序厅
    buildPartCorridor(root, 13, 16, -4, 24, -1);    // 东廊：北廊 → 序厅
    buildPartCorridor(root, -16, 16, 21, 24, 1);    // 南廊：序厅前，连通两廊
    buildPartCorridor(root, -34, 34, -7, -4, 1);    // 北廊：串联山水 / 花鸟 / 人物三厅

    // 六厅：序厅 + 三主展厅 + 书斋/文创
    buildHall0(root);

    buildHall1(root);

    buildHall2(root); // 已有的样板厅，坐标正好匹配 hall2

    buildHall3(root);

    // 书斋·茶室（hall4）与文创区（hall5）按参考图精修
    buildHall4(root);
    buildHall5(root);

    // 庭院铜奔马
    addPlazaSculpture(root, 0, 14, "matayafeiyan", "马踏飞燕 · 东汉");
  }

  /* ---------- 2. 地面系统 ---------- */
  /* ============================================================
   * 分区院墙（按总平面图 2026-09-23）
   * ------------------------------------------------------------
   * 参考图 plan.png：整个馆区是"院落 + 廊道"格局，八个功能区之间
   * 用院墙分隔、靠门洞串通，而不是六栋房子孤零零散在空地上。
   * 这里补 11 道院墙，把馆区切成：
   *   前庭 | 序厅 | 中央庭院 | 三面展区（山水/花鸟/人物）/ 两翼（文创/书斋）
   * 每道墙照 buildPartWallRun 的做法：石基 + 粉墙 + 砖砌边框 + 瓦压顶，
   * 门洞处留 1.8m 通行口。
   * 碰撞体由组长代登记（接缝归属组员1），门口位置按门洞切开，保证能走进去。
   * ============================================================ */
  function buildPartZoneWall(root, opt) {
    buildPartWallRun(root, opt);
    /* 碰撞体：整道墙切成若干段，门洞处留空 */
    var hl = opt.len / 2, half = 0.42;
    var cuts = (opt.openings || []).filter(function (o) { return o.kind === "door"; })
      .map(function (o) { return [o.u - o.w / 2, o.u + o.w / 2]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var spans = [], cursor = -hl;
    cuts.forEach(function (c) {
      if (c[0] > cursor) spans.push([cursor, c[0]]);
      cursor = Math.max(cursor, c[1]);
    });
    if (cursor < hl) spans.push([cursor, hl]);
    var vertical = Math.abs(opt.ry || 0) > 0.01;
    spans.forEach(function (s) {
      if (vertical) {
        /* ry = +90°：局部 +x 映射到世界 -z */
        obstacles.push({ type: "rect", x0: opt.cx - half, z0: opt.cz - s[1], x1: opt.cx + half, z1: opt.cz - s[0] });
      } else {
        obstacles.push({ type: "rect", x0: opt.cx + s[0], z0: opt.cz - half, x1: opt.cx + s[1], z1: opt.cz + half });
      }
    });
  }

  var ZONE_WALL = { h: 2.6, th: 0.42, plinth: 0.38, frame: 0.3, pilasters: 7.5, steps: false };
  /* ============================================================
   * 现成资产（Poly Haven · CC0）：景观石 / 草丛 / 枯木 / 冷杉
   * ------------------------------------------------------------
   * 只接"自然物"——写实扫描件放进风格化场景里，自然物的违和感最小；
   * 西式家具（书架/桌/椅）不接；冷杉只放草坪与墙根，不上中轴。
   * 缺资产时整段静默跳过，场景照常。
   * ============================================================ */
  function buildPartImportedProps(root) {
    var M = window.MuseumModels;
    if (!M) return;
    /* 草丛地被：庭院东西两侧（程序化草团仍在，这里补成片的地被） */
    M.attach(root, "grass-patch", { x: -11.5, z: 6.0, ry: 0.4, scale: 1.15 });
    M.attach(root, "grass-patch", { x: -11.5, z: 15.5, ry: 1.9, scale: 1.0 });
    M.attach(root, "grass-patch", { x: 11.5, z: 6.0, ry: -0.5, scale: 1.1 });
    M.attach(root, "grass-patch", { x: 11.5, z: 15.5, ry: 2.4, scale: 1.05 });
    /* 景观石：水池两端与庭院南缘 */
    [[-12.6, 8.4, 0.0], [12.6, 8.4, 1.3], [-5.6, 5.4, 2.1], [5.6, 20.6, 3.4]].forEach(function (p, i) {
      M.attach(root, "rock-boulder", { x: p[0], z: p[1], ry: p[2], scale: 0.85 + (i % 3) * 0.2 });
    });
    /* 枯木：两个院角 */
    M.attach(root, "dead-trunk", { x: -14.4, z: 21.2, ry: 0.5, scale: 1.0 });
    M.attach(root, "dead-trunk", { x: 14.4, z: 1.4, ry: -0.8, scale: 0.9 });
    /* 冷杉：只放两翼草坪与墙根，避开中轴、前庭主通道 */
    [[-30, 27, 0.0], [30, 27, 1.7], [-30, 37.5, 3.1], [30, 37.5, 4.6]].forEach(function (p, i) {
      M.attach(root, "fir-tree", { x: p[0], z: p[1], ry: p[2], scale: 0.85 + (i % 2) * 0.18 });
    });
  }
  function buildPartZoneWalls(root) {
    var door = function (u, w, h) { return { kind: "door", u: u, w: w || 1.8, h: h || 2.4, sill: 0 }; };
    var V = Math.PI / 2;
    /* 坐标来自参考图 外墙.png 的墙线提取（见 docs/reference-images/外墙.png）：
     *   纵墙 20.1% → x −31（文创西）｜33.0% → x −18（山水/文创东）｜
     *        61.2% → x +11｜69.0% → x +19（书斋西）｜93.0% → x +43（东围墙）
     *   横墙 24.5% → z −25（花鸟北）｜39.7% → z −9（花鸟南）｜43.7% → z −5（山水/人物南）｜
     *        53.7% → z +6（书斋/文创北）｜89.3% → z +44（南围墙）
     * 换算后这些线正好落在六厅边界上——也就是说：院墙是"沿各厅边界把用地切块"，
     * 而不是我上一轮那样在空地上随手拉几段。 */
    var runs = [
      /* 中轴区（前庭—序厅—庭院—花鸟）与两翼之间的两条长纵墙：
         从花鸟厅南侧 z=-8 一直拉到南围墙 z=44，门洞开在与廊子/庭院的交汇处 */
      { cx: -16.5, cz: 18, len: 52, ry: V, openings: [door(21), door(5), door(-5)], name: "zone-w" },
      { cx: 16.5, cz: 18, len: 52, ry: V, openings: [door(21), door(5), door(-5)], name: "zone-e" },
      /* 花鸟厅与山水/人物厅之间的两小段 */
      { cx: -14, cz: -16, len: 16, ry: V, openings: [door(0)], name: "zone-nw" },
      { cx: 14, cz: -16, len: 16, ry: V, openings: [door(0)], name: "zone-ne" },
      /* 两翼内部：北厅（山水/人物）与南厅（文创/书斋）之间 */
      { cx: -30, cz: 1, len: 28, ry: 0, openings: [door(9)], name: "zone-west" },
      { cx: 30, cz: 1, len: 28, ry: 0, openings: [door(-9)], name: "zone-east" },
      /* 北侧收口：参考图北墙在 z −36 一带 */
      { cx: 0, cz: -36, len: 88, ry: 0, openings: [door(0, 2.4, 2.6)], name: "zone-north" }
    ];
    runs.forEach(function (r) { buildPartZoneWall(root, Object.assign({}, ZONE_WALL, r)); });
  }
  function buildPartGround(root) {
    // 围墙内基地
    var ground = new _g.Mesh(new _g.PlaneGeometry(88, 88), mat(0xd9d4c8, { roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.005;
    ground.receiveShadow = true;
    root.add(ground);

    // 前庭铺装
    var fore = new _g.Mesh(new _g.PlaneGeometry(88, 8), mat(0xcfcec2, { roughness: 0.9 }));
    fore.rotation.x = -Math.PI / 2;
    fore.position.set(0, 0.01, 38);
    fore.receiveShadow = true;
    root.add(fore);

    // 中央庭院青砖
    var court = new _g.Mesh(new _g.PlaneGeometry(32, 22), mat(0xcfc6b6, { roughness: 0.9 }));
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, 0.012, 11);
    court.receiveShadow = true;
    root.add(court);

    // 中轴道路
    var road = new _g.Mesh(new _g.PlaneGeometry(5, 44), mat(0xc4bdb0, { roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.015, 20);
    road.receiveShadow = true;
    root.add(road);
  }

  /* ---------- 3. 围墙与门楼 ---------- */
  function buildPartOuterWall(root) {
    buildWall(root, 0, -44, 88, 0);
    buildWall(root, -44, 0, 88, Math.PI / 2);
    buildWall(root, 44, 0, 88, Math.PI / 2);
    buildWallWithGap(root);
  }

  /* 门楼：参数化版本只做占位，GLB 到位后自动替换（models.js）；
     匾额单独建、不参与替换——馆名必须一直在。 */
  function buildPartGate(root, x, z) {
    var g = new _g.Group();
    g.position.set(x, 0, z);
    var wood = mat(0x7a3b2e, { roughness: 0.7 });
    var tile = mat(0x39332d, { roughness: 0.85 });
    [-1, 1].forEach(function (s) {
      buildBox(g, 0.9, 3.6, 0.9, s * 5.2, 1.8, 0, wood);
    });
    buildBox(g, 11.4, 0.55, 0.6, 0, 3.7, 0, wood);
    buildBox(g, 12.2, 0.25, 0.9, 0, 4.15, 0, tile);
    root.add(g);

    var plaque = new _g.Mesh(
      new _g.PlaneGeometry(2.6, 0.9),
      canvasMat(drawSign("云墨", "美术馆"), { side: _g.DoubleSide })
    );
    plaque.position.set(x, 3.75, z + 0.31);
    root.add(plaque);

  }

  /* ---------- 4. 植物与景观 ---------- */
  /* 庭院树：参数化版本只做占位，GLB 模型到位后自动替换（models.js） */
  function buildPartTree(root, x, z, modelId) {
    var g = new _g.Group();
    g.position.set(x, 0, z);
    if (window.MuseumFoliage) {
      var seed = Math.abs((x * 13 + z * 7) | 0) || 7;
      g.add(modelId === "camphor"
        ? window.MuseumFoliage.tree({ seed: seed, height: 4.6 })
        : window.MuseumFoliage.willow({ seed: seed, height: 4.4 }));
    }
    root.add(g);
    obstacles.push({ type: "circle", x: x, z: z, r: 0.8 });
    if (window.MuseumModels) {
      window.MuseumModels.attach(root, modelId || "willow", { x: x, z: z, ry: (x * 7 + z * 3) % 6.28 }, g);
    }
  }

  function buildPartCourtyard(root) {
    // 水池
    var pond = new _g.Mesh(
      new _g.PlaneGeometry(14, 8),
      new _g.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.25, transparent: true, opacity: 0.82 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(0, 0.03, 14);
    root.add(pond);
    buildBox(root, 14.8, 0.25, 8.8, 0, 0.125, 14, mat(0xa8a297, { roughness: 0.9 }));
    obstacles.push({ type: "rect", x0: -7, z0: 10, x1: 7, z1: 18 });

    // 太湖石
    buildPartRockGroup(root, -10, 11);
    buildPartRockGroup(root, 10, 11);

    // 竹丛
    buildPartBamboo(root, -13.5, 2.5);
    buildPartBamboo(root, 13.5, 2.5);
    buildPartBamboo(root, -13.5, 19.5);
    buildPartBamboo(root, 13.5, 19.5);

    /* 草丛 + 灌木：程序化生成（合并几何，几十丛也不心疼），
       避开中央水池 14×8 与中轴道路 */
    if (window.MuseumFoliage) {
      var gs = 31;
      var gr = function () { gs = (gs * 1103515245 + 12345) & 0x7fffffff; return gs / 0x7fffffff; };
      [[-15.2, -8.2], [8.2, 15.2]].forEach(function (band) {
        for (var i = 0; i < 18; i++) {
          var gx = band[0] + gr() * (band[1] - band[0]);
          var gz = 1.5 + gr() * 19;
          var clump = window.MuseumFoliage.grassClump({
            seed: Math.abs((gx * 17 + gz * 3) | 0) || 13, height: 0.30 + gr() * 0.16
          });
          clump.position.set(gx, 0, gz);
          clump.rotation.y = gr() * 6.28;
          root.add(clump);
        }
      });
      for (var j = 0; j < 8; j++) {
        var cx2 = -7.5 + gr() * 15, cz2 = 19 + gr() * 2.5;
        var c2 = window.MuseumFoliage.grassClump({ seed: Math.abs((cx2 * 23 + cz2) | 0) || 29, height: 0.26 + gr() * 0.14 });
        c2.position.set(cx2, 0, cz2);
        root.add(c2);
      }
      [[-12.6, 6.5], [-12.6, 14.5], [12.6, 6.5], [12.6, 14.5], [-9.5, 20.4], [9.5, 20.4]].forEach(function (bp, bi) {
        var bsh = window.MuseumFoliage.bush({ seed: 40 + bi * 7, radius: 0.6 + (bi % 3) * 0.08 });
        bsh.position.set(bp[0], 0, bp[1]);
        root.add(bsh);
      });
    }
  }

  function buildPartRockGroup(root, cx, cz) {
    var rg = new _g.Group();
    rg.position.set(cx, 0, cz);
    root.add(rg);
    var s1 = Math.abs((cx + cz * 5) | 0) || 17;
    var rockMat = new _g.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.98, flatShading: true });
    if (window.MuseumExterior && window.MuseumExterior.blobGeo) {
      /* 噪声球石头（移植自外观原型 blobGeo）：比十二面体自然得多 */
      [[0.85, 0, 0, 0], [0.44, 0.88, 0.26, 3], [0.36, -0.72, 0.36, 9]].forEach(function (rk) {
        var m = new _g.Mesh(window.MuseumExterior.blobGeo(rk[0], 0.24, 0.8, s1 + rk[3]), rockMat);
        m.position.set(rk[1], rk[0] * 0.8, rk[2]);
        m.rotation.y = s1 * 0.37 + rk[3];
        m.castShadow = true;
        m.receiveShadow = true;
        rg.add(m);
      });
    } else if (window.MuseumFoliage) {
      var big = window.MuseumFoliage.rock({ seed: s1, radius: 0.85 });
      rg.add(big);
      var small = window.MuseumFoliage.rock({ seed: s1 + 3, radius: 0.42 });
      small.position.set(0.85, 0, 0.25);
      small.rotation.y = 0.7;
      rg.add(small);
      var small2 = window.MuseumFoliage.rock({ seed: s1 + 9, radius: 0.34 });
      small2.position.set(-0.7, 0, 0.35);
      small2.rotation.y = -1.1;
      rg.add(small2);
    }
    obstacles.push({ type: "circle", x: cx, z: cz, r: 1.1 });
    if (window.MuseumModels) {
      window.MuseumModels.attach(root, "taihu-rock", { x: cx, z: cz, ry: (cx + cz) % 3 }, rg);
    }
  }

  function buildPartBamboo(root, cx, cz) {
    var bg = new _g.Group();
    bg.position.set(cx, 0, cz);
    if (window.MuseumFoliage) {
      bg.add(window.MuseumFoliage.bamboo({ seed: Math.abs((cx * 7 + cz * 3) | 0) || 5, height: 2.8 }));
    }
    root.add(bg);
    obstacles.push({ type: "circle", x: cx, z: cz, r: 0.7 });
    if (window.MuseumModels) {
      window.MuseumModels.attach(root, "bamboo", { x: cx, z: cz, ry: (cx * 5 + cz) % 6.28 }, bg);
    }
  }

  /* ---------- 5. 曲廊 ---------- */
  function buildPartCorridor(root, x0, x1, z0, z1, facing) {
    var g = new _g.Group();
    var w = x1 - x0, d = z1 - z0;
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var floorY = 0.15;
    var wood = mat(0x7a3b2e, { roughness: 0.7 });

    var floor = new _g.Mesh(new _g.PlaneGeometry(w - 0.1, d - 0.1), canvasMat(drawWood(), { roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, floorY, cz);
    floor.receiveShadow = true;
    g.add(floor);

    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });
    var vertical = d >= w;                       /* 南北向廊 or 东西向廊 */

    if (vertical) {
      var n = Math.max(2, Math.round(d / 3.4));
      for (var i = 0; i <= n; i++) {
        var z = z0 + d * (i / n);
        buildBox(g, 0.16, 2.9, 0.16, x0 + 0.25, floorY + 1.45, z, wood);
        buildBox(g, 0.16, 2.9, 0.16, x1 - 0.25, floorY + 1.45, z, wood);
      }
      var railX = (facing > 0) ? x0 + 0.25 : x1 - 0.25;
      buildRailing(g, railX, z0 + 0.2, z1 - 0.2, facing, floorY);
      var wallX = (facing > 0) ? x1 : x0;
      for (var j = 0; j < 2; j++) {
        var wz = z0 + d * (0.3 + j * 0.35);
        buildBox(g, 0.2, 2.2, 1.2, wallX, floorY + 1.1, wz, wallMat);
        buildPartLattice(g, wallX + (facing > 0 ? 0.11 : -0.11), floorY + 1.3, wz, facing > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    } else {
      var nx = Math.max(2, Math.round(w / 3.4));
      for (var a = 0; a <= nx; a++) {
        var x = x0 + w * (a / nx);
        buildBox(g, 0.16, 2.9, 0.16, x, floorY + 1.45, z0 + 0.25, wood);
        buildBox(g, 0.16, 2.9, 0.16, x, floorY + 1.45, z1 - 0.25, wood);
      }
      /* 美人靠 + 漏窗墙，东西向廊用同样的构件，只是把轴换过来 */
      var railZ = (facing > 0) ? z0 + 0.25 : z1 - 0.25;
      buildRailingX(g, x0 + 0.2, x1 - 0.2, railZ, floorY);
      var wallZ = (facing > 0) ? z1 : z0;
      for (var k = 0; k < 4; k++) {
        var wx = x0 + w * (0.16 + k * 0.23);
        buildBox(g, 1.2, 2.2, 0.2, wx, floorY + 1.1, wallZ, wallMat);
        buildPartLattice(g, wx, floorY + 1.3, wallZ + (facing > 0 ? 0.11 : -0.11), facing > 0 ? 0 : Math.PI);
      }
    }

    // 廊顶
    buildRoof(g, { x: cx, z: cz, y: floorY + 2.9, w: w, d: d, h: 0.7, eave: 0.4,
                   ridge: (vertical ? d : w) - 1, axis: vertical ? "z" : "x" });

    root.add(g);
  }

  /* 东西向廊的美人靠（沿 x 排） */
  function buildRailingX(parent, x0, x1, z, floorY) {
    var wood = mat(0x6d5544, { roughness: 0.75 });
    var len = x1 - x0;
    buildBox(parent, len, 0.08, 0.12, (x0 + x1) / 2, floorY + 0.55, z, wood);
    buildBox(parent, len, 0.05, 0.10, (x0 + x1) / 2, floorY + 0.30, z, wood);
    var n = Math.max(3, Math.round(len / 0.7));
    for (var i = 0; i <= n; i++) buildBox(parent, 0.06, 0.55, 0.06, x0 + len * (i / n), floorY + 0.28, z, wood);
  }

  function buildPartLattice(parent, x, y, z, ry) {
    var lattice = new _g.Mesh(new _g.PlaneGeometry(0.9, 0.9), canvasMat(drawLattice(), { roughness: 0.55 }));
    lattice.position.set(x, y, z);
    lattice.rotation.y = ry;
    parent.add(lattice);
  }


  /* ---------- 序厅专用（ richer，对标参考图） ---------- */
  function buildHall0(parent) {
    var g = new _g.Group();
    var X0 = -10, X1 = 10, Z0 = 24, Z1 = 34;
    var cx = 0, cz = 29;
    var W = 20, D = 10;
    var halfW = W / 2, halfD = D / 2;
    var F = 0.3;
    var WH = 4.6;
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });

    // 抬高地板 + 入口台阶
    buildPartRaisedFloor(g, W - 0.6, D - 0.6, F);

    // 四墙（南门洞 + 入口台阶）
    buildPartHallWalls(g, W, D, WH, 0.35, wallMat, "s", 0, 3, 3);

    // 马头墙（两山墙，序厅也要有）
    buildPartHorseHeadWall(g, -halfW, -1, -halfD, halfD, WH);
    buildPartHorseHeadWall(g, halfW, 1, -halfD, halfD, WH);

    // 背景墙（北墙中央馆名 + 山水底纹）
    buildPartBackdrop(g, W - 1.2, 3.0, "云墨美术馆");

    // 四根木柱
    buildPartColumn(g, -6, -3, WH, 0.35);
    buildPartColumn(g, 6, -3, WH, 0.35);
    buildPartColumn(g, -6, 3, WH, 0.35);
    buildPartColumn(g, 6, 3, WH, 0.35);

    // 藻井天花 + 玻璃天窗
    buildPartCeilingBeams(g, W - 0.8, D - 0.8, WH);
    buildPartSkylight(g, 6, 4, WH + 0.05);

    // 侧墙条凳与挂画
    buildPartBench(g, -8.5, 0, Math.PI / 2);
    buildPartBench(g, 8.5, 0, -Math.PI / 2);
    addPainting(g, { x: -8.6, y: 2.4, z: 0, ry: Math.PI / 2, lamp: [-0.9, 0] }, 2.0, 1.4, "fuchunshanjv");
    addPainting(g, { x: 8.6, y: 2.4, z: 0, ry: -Math.PI / 2, lamp: [0.9, 0] }, 2.0, 1.4, "xishanxinglvtu");

    // 中央鼎台
    addPedestalLocal(g, 0, F, -1, "houmuwuding", "后母戊鼎 · 商");

    // 屋顶
    buildRoof(g, { x: 0, z: 0, y: WH + 0.15, w: W, d: D, h: 1.8, eave: 1.0, ridge: W - 2 });

    // 室内暖光
    var indoor = new _g.PointLight(0xffe6c4, 0.9, 22, 1.8);
    indoor.position.set(0, WH - 0.5, 0);
    g.add(indoor);

    g.position.set(cx, 0, cz);
    parent.add(g);
  }

  /* ---------- 新零件 ---------- */
  function buildPartRaisedFloor(parent, W, D, h) {
    var floor = new _g.Mesh(new _g.BoxGeometry(W, h, D), canvasMat(drawWood(), { roughness: 0.7 }));
    floor.position.set(0, h / 2, 0);
    floor.receiveShadow = true;
    parent.add(floor);
    // 南侧两级台阶
    buildBox(parent, W, h * 0.55, 0.6, 0, h * 0.275, D / 2 + 0.3, mat(0xb9b0a0, { roughness: 0.9 }));
    buildBox(parent, W, h * 0.25, 0.5, 0, h * 0.125, D / 2 + 0.85, mat(0xcfc6b6, { roughness: 0.9 }));
  }

  function buildPartColumn(parent, x, z, h, r) {
    var wood = mat(0x5d4a3a, { roughness: 0.7 });
    var stone = mat(0xa8a297, { roughness: 0.9 });
    // 柱础
    buildBox(parent, r * 2.4, 0.25, r * 2.4, x, 0.125, z, stone);
    // 柱身
    var col = new _g.Mesh(new _g.CylinderGeometry(r, r, h, 16), wood);
    col.position.set(x, h / 2 + 0.25, z);
    col.castShadow = true;
    parent.add(col);
    // 柱头
    buildBox(parent, r * 2.2, 0.18, r * 2.2, x, h + 0.34, z, wood);
  }

  function buildPartBackdrop(parent, w, h, text) {
    // 墙芯：浅米底色
    buildBox(parent, w, h, 0.12, 0, h / 2 + 0.8, -4.7, mat(0xe8e0d2, { roughness: 0.9 }));
    // 文字匾
    var plaque = new _g.Mesh(
      new _g.PlaneGeometry(w * 0.55, h * 0.35),
      canvasMat(drawSign(text, ""), { side: _g.DoubleSide })
    );
    plaque.position.set(0, h / 2 + 1.6, -4.64);
    parent.add(plaque);
    // 两侧水墨山水衬景（示意）
    var mural = new _g.Mesh(
      new _g.PlaneGeometry(w * 0.35, h * 0.55),
      mat(0xaab8a0, { roughness: 0.95 })
    );
    mural.position.set(-w * 0.28, h / 2 + 0.9, -4.64);
    parent.add(mural);
    var mural2 = mural.clone();
    mural2.position.set(w * 0.28, h / 2 + 0.9, -4.64);
    parent.add(mural2);
  }

  function buildPartCeilingBeams(parent, W, D, y) {
    var wood = mat(0x5d4a3a, { roughness: 0.7 });
    // 横向主梁（沿 x）
    for (var z = -D / 2 + 1; z <= D / 2 - 1; z += 3) {
      buildBox(parent, W, 0.25, 0.35, 0, y, z, wood);
    }
    // 纵向檩条（沿 z）
    for (var x = -W / 2 + 2; x <= W / 2 - 2; x += 4) {
      buildBox(parent, 0.3, 0.2, D, x, y - 0.1, 0, wood);
    }
  }

  function buildPartSkylight(parent, w, d, y) {
    var glass = new _g.Mesh(
      new _g.PlaneGeometry(w, d),
      new _g.MeshStandardMaterial({ color: 0xcceeff, roughness: 0.1, transparent: true, opacity: 0.45, side: _g.DoubleSide })
    );
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(0, y, 0);
    parent.add(glass);
    // 天窗木框
    var wood = mat(0x5d4a3a, { roughness: 0.7 });
    buildBox(parent, w + 0.2, 0.15, 0.2, 0, y, -d / 2, wood);
    buildBox(parent, w + 0.2, 0.15, 0.2, 0, y, d / 2, wood);
    buildBox(parent, 0.2, 0.15, d + 0.2, -w / 2, y, 0, wood);
    buildBox(parent, 0.2, 0.15, d + 0.2, w / 2, y, 0, wood);
  }

  function buildPartBench(parent, x, z, ry) {
    var g = new _g.Group();
    g.position.set(x, 0.3, z);
    g.rotation.y = ry;
    buildBox(g, 2.2, 0.08, 0.5, 0, 0.45, 0, mat(0x6d5544, { roughness: 0.75 }));
    buildBox(g, 0.08, 0.45, 0.5, -1.0, 0.225, 0, mat(0x5d4a3a));
    buildBox(g, 0.08, 0.45, 0.5, 1.0, 0.225, 0, mat(0x5d4a3a));
    parent.add(g);
  }
  /* ---------- 6. 厅堂 ---------- */

  /* ---------- 山水画厅专用 ---------- */
  function buildHall1(parent) {
    var g = new _g.Group();
    var X0 = -34, X1 = -16, Z0 = -22, Z1 = -4;
    var cx = -25, cz = -13;
    var W = 18, D = 18;
    var halfW = W / 2, halfD = D / 2;
    var F = 0.3;
    var WH = 4.6;
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });

    // 抬高地板 + 东侧入口台阶
    buildPartRaisedFloorDir(g, W - 0.6, D - 0.6, F, "e");

    // 墙体（东门洞）+ 马头墙
    buildPartHallWalls(g, W, D, WH, 0.35, wallMat, "e", 0, 3, 3);
    buildPartHorseHeadWall(g, -halfW, -1, -halfD, halfD, WH);
    buildPartHorseHeadWall(g, halfW, 1, -halfD, halfD, WH);

    // 天花木梁
    buildPartCeilingBeams(g, W - 0.8, D - 0.8, WH);

    // 北墙挂画（左富春、中千里、右溪山）与标题
    addPainting(g, { x: -5.5, y: 2.55, z: -8.6, ry: 0, lamp: [0, 0.9] }, 2.2, 1.5, "fuchunshanjv");
    addPainting(g, { x: 0,   y: 2.55, z: -8.6, ry: 0, lamp: [0, 0.9] }, 3.4, 2.2, "qianlijiangshan");
    addPainting(g, { x: 5.5, y: 2.55, z: -8.6, ry: 0, lamp: [0, 0.9] }, 2.2, 1.5, "xishanxinglvtu");
    buildPartHallTitle(g, "山水清音", "江山可游 心居万象", 0, 4.0, -8.5, 0);

    // 墙根石座 / 条凳
    buildPartBench(g, -6.5, -6.0, 0);
    buildPartBench(g, 6.5, -6.0, 0);
    buildPartBench(g, -6.5, 5.0, 0);
    buildPartBench(g, 6.5, 5.0, 0);

    // 屋顶
    buildRoof(g, { x: 0, z: 0, y: WH + 0.15, w: W, d: D, h: 1.8, eave: 1.0, ridge: W - 2 });

    // 室内暖光 + 门洞光
    var indoor = new _g.PointLight(0xffe6c4, 0.8, 20, 1.6);
    indoor.position.set(0, WH - 0.8, 0);
    g.add(indoor);

    g.position.set(cx, 0, cz);
    parent.add(g);
  }

  /* 可指定台阶方向（s/e/w）的抬高地板 */
  function buildPartRaisedFloorDir(parent, W, D, h, dir) {
    var floor = new _g.Mesh(new _g.BoxGeometry(W, h, D), canvasMat(drawWood(), { roughness: 0.7 }));
    floor.position.set(0, h / 2, 0);
    floor.receiveShadow = true;
    parent.add(floor);

    var stepH1 = h * 0.6, stepD1 = 0.6, stepH2 = h * 0.3, stepD2 = 0.5;
    var stone = mat(0xb9b0a0, { roughness: 0.9 });

    if (dir === "s") {
      buildBox(parent, W, stepH1, stepD1, 0, stepH1 / 2, D / 2 + stepD1 / 2, stone);
      buildBox(parent, W, stepH2, stepD2, 0, stepH2 / 2, D / 2 + stepD1 + stepD2 / 2, mat(0xcfc6b6, { roughness: 0.9 }));
    } else if (dir === "e") {
      buildBox(parent, stepD1, stepH1, D, W / 2 + stepD1 / 2, stepH1 / 2, 0, stone);
      buildBox(parent, stepD2, stepH2, D, W / 2 + stepD1 + stepD2 / 2, stepH2 / 2, 0, mat(0xcfc6b6, { roughness: 0.9 }));
    } else if (dir === "w") {
      buildBox(parent, stepD1, stepH1, D, -W / 2 - stepD1 / 2, stepH1 / 2, 0, stone);
      buildBox(parent, stepD2, stepH2, D, -W / 2 - stepD1 - stepD2 / 2, stepH2 / 2, 0, mat(0xcfc6b6, { roughness: 0.9 }));
    }
  }


  function buildPartPottedPlant(parent, x, z) {
    var g = new _g.Group();
    g.position.set(x, 0.3, z);
    // 盆
    var pot = new _g.Mesh(new _g.CylinderGeometry(0.28, 0.22, 0.35, 10), mat(0x6d5544, { roughness: 0.75 }));
    pot.position.y = 0.175;
    g.add(pot);
    // 竹/叶
    for (var i = 0; i < 5; i++) {
      var h = 0.8 + Math.random() * 0.4;
      var pole = new _g.Mesh(new _g.CylinderGeometry(0.025, 0.03, h, 6), mat(0x7c8a53, { roughness: 0.9 }));
      pole.position.set((Math.random() - 0.5) * 0.2, 0.35 + h / 2, (Math.random() - 0.5) * 0.2);
      g.add(pole);
      var leaf = new _g.Mesh(new _g.ConeGeometry(0.18, 0.5, 6), mat(0x5f7043, { roughness: 1 }));
      leaf.position.set(pole.position.x, pole.position.y + h / 2 + 0.2, pole.position.z);
      g.add(leaf);
    }
    parent.add(g);
  }

  /* ---------- 人物画厅专用 ---------- */
  function buildHall3(parent) {
    var g = new _g.Group();
    var X0 = 16, X1 = 34, Z0 = -22, Z1 = -4;
    var cx = 25, cz = -13;
    var W = 18, D = 18;
    var halfW = W / 2, halfD = D / 2;
    var F = 0.3;
    var WH = 4.6;
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });

    buildPartRaisedFloorDir(g, W - 0.6, D - 0.6, F, "w");
    buildPartHallWalls(g, W, D, WH, 0.35, wallMat, "w", 0, 3, 3);
    buildPartHorseHeadWall(g, -halfW, -1, -halfD, halfD, WH);
    buildPartHorseHeadWall(g, halfW, 1, -halfD, halfD, WH);

    buildPartCeilingBeams(g, W - 0.8, D - 0.8, WH);

    // 北墙挂画：左韩熙载、中洛神赋、右步辇图
    addPainting(g, { x: -5.5, y: 2.55, z: -8.6, ry: 0, lamp: [0, 0.9] }, 3.4, 2.2, "hanxizai");
    addPainting(g, { x: 0,   y: 2.55, z: -8.6, ry: 0, lamp: [0, 0.9] }, 2.2, 1.5, "luoshenfu");
    addPainting(g, { x: 5.5, y: 2.55, z: -8.6, ry: 0, lamp: [0, 0.9] }, 2.2, 1.5, "buniantu");
    buildPartHallTitle(g, "人物丹青", "观古鉴今 · 以画识人", 0, 4.0, -8.5, 0);

    // 中央将军俑
    addPedestalLocal(g, 0, F, 0, "jiangjunyong", "将军俑 · 秦");

    // 侧墙立轴书法
    buildPartVerticalScroll(g, -8.4, 2.4, -3.0, Math.PI / 2);
    buildPartVerticalScroll(g, -8.4, 2.4, -9.0, Math.PI / 2);
    buildPartVerticalScroll(g, 8.4, 2.4, -3.0, -Math.PI / 2);
    buildPartVerticalScroll(g, 8.4, 2.4, -9.0, -Math.PI / 2);

    // 条凳与盆栽
    buildPartBench(g, -5.5, -7.5, 0);
    buildPartBench(g, 5.5, -7.5, 0);
    buildPartPottedPlant(g, -8.0, -6.0);
    buildPartPottedPlant(g, 8.0, -6.0);

    buildRoof(g, { x: 0, z: 0, y: WH + 0.15, w: W, d: D, h: 1.8, eave: 1.0, ridge: W - 2 });

    var indoor = new _g.PointLight(0xffe6c4, 0.85, 20, 1.6);
    indoor.position.set(0, WH - 0.8, 0);
    g.add(indoor);

    g.position.set(cx, 0, cz);
    parent.add(g);
  }


  /* ---------- 书斋·茶室专用（hall4） ---------- */
  function buildHall4(parent) {
    var g = new _g.Group();
    var X0 = 16, X1 = 32, Z0 = 6, Z1 = 20;
    var cx = 24, cz = 13;
    var W = 16, D = 14;
    var halfW = W / 2, halfD = D / 2;
    var F = 0.3;
    var WH = 4.2;
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });

    buildPartRaisedFloorDir(g, W - 0.6, D - 0.6, F, "w");
    buildPartHallWalls(g, W, D, WH, 0.35, wallMat, "w", 0, 3, 3);

    // 东墙大窗格扇，借景中央庭院
    buildPartWindowWall(g, halfW - 0.2, F + 0.1, WH - 0.4, -halfD + 1.5, halfD - 1.5, Math.PI / 2);

    buildPartCeilingBeams(g, W - 0.8, D - 0.8, WH);

    // 北墙：山水画 + 两侧对联
    addPainting(g, { x: 0, y: 2.6, z: -halfD + 0.2, ry: 0, lamp: [0, 0.9] }, 4.0, 1.8, "xishanxinglvtu");
    buildPartVerticalScroll(g, -5.0, 2.6, -halfD + 0.25, 0);
    buildPartVerticalScroll(g, 5.0, 2.6, -halfD + 0.25, 0);
    buildPartHallTitle(g, "书斋茶室", "读书养心 · 品茗会友", 0, 3.8, -halfD + 0.3, 0);

    // 中央茶席长案 3.2m x 1m + 六方凳
    buildPartLongTable(g, 0, F, 0, 3.2, 1.0);
    buildPartStool(g, -1.1, 0.35);
    buildPartStool(g, 1.1, 0.35);
    buildPartStool(g, -1.1, -0.35);
    buildPartStool(g, 1.1, -0.35);
    buildPartStool(g, 0, 0.65);
    buildPartStool(g, 0, -0.65);

    // 靠墙低矮书架
    buildPartBookshelf(g, -halfW + 0.35, F, -3.5, Math.PI / 2);
    buildPartBookshelf(g, -halfW + 0.35, F, 3.5, Math.PI / 2);
    buildPartBookshelf(g, halfW - 0.55, F, -3.5, -Math.PI / 2);
    buildPartBookshelf(g, halfW - 0.55, F, 3.5, -Math.PI / 2);

    // 盆栽点缀
    buildPartPottedPlant(g, -5.5, 5.5);
    buildPartPottedPlant(g, 5.5, 5.5);

    buildRoof(g, { x: 0, z: 0, y: WH + 0.15, w: W, d: D, h: 1.5, eave: 1.0, ridge: W - 2 });

    var indoor = new _g.PointLight(0xffe6c4, 0.8, 18, 1.6);
    indoor.position.set(0, WH - 0.8, 0);
    g.add(indoor);

    g.position.set(cx, 0, cz);
    parent.add(g);
  }

  /* ---------- 文创区专用（hall5） ---------- */
  function buildHall5(parent) {
    var g = new _g.Group();
    var X0 = -32, X1 = -16, Z0 = 6, Z1 = 20;
    var cx = -24, cz = 13;
    var W = 16, D = 14;
    var halfW = W / 2, halfD = D / 2;
    var F = 0.3;
    var WH = 4.2;
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });

    buildPartRaisedFloorDir(g, W - 0.6, D - 0.6, F, "e");
    buildPartHallWalls(g, W, D, WH, 0.35, wallMat, "e", 0, 3, 3);

    // 西墙大窗格扇，借景中央庭院
    buildPartWindowWall(g, -halfW + 0.2, F + 0.1, WH - 0.4, -halfD + 1.5, halfD - 1.5, -Math.PI / 2);

    buildPartCeilingBeams(g, W - 0.8, D - 0.8, WH);

    // 北墙：匾额 + 五幅小画
    buildPartHallTitle(g, "文创雅集", "以画会友 · 以文养心", 0, 3.6, -halfD + 0.3, 0);
    [-4, -2, 0, 2, 4].forEach(function (px, idx) {
      var ids = ["xieshengzhenqintu", "wuniutu", "fuchunshanjv", "xishanxinglvtu", "qianlijiangshan"];
      addPainting(g, { x: px, y: 2.05, z: -halfD + 0.2, ry: 0, lamp: [0, 0.85] }, 0.9, 1.35, ids[idx]);
    });

    // 中央 2-3 张临帖长案
    buildPartLongTable(g, -2.2, F, 0, 2.6, 0.9);
    buildPartLongTable(g, 2.2, F, 0, 2.6, 0.9);
    buildPartLongTable(g, 0, F, 3.0, 2.6, 0.9);

    // 靠墙文创展示架
    buildPartDisplayShelf(g, -halfW + 0.35, F, -3.5, Math.PI / 2);
    buildPartDisplayShelf(g, -halfW + 0.35, F, 3.5, Math.PI / 2);
    buildPartDisplayShelf(g, halfW - 0.55, F, -3.5, -Math.PI / 2);
    buildPartDisplayShelf(g, halfW - 0.55, F, 3.5, -Math.PI / 2);

    // 盆栽
    buildPartPottedPlant(g, -5.5, 5.5);
    buildPartPottedPlant(g, 5.5, 5.5);

    buildRoof(g, { x: 0, z: 0, y: WH + 0.15, w: W, d: D, h: 1.5, eave: 1.0, ridge: W - 2 });

    var indoor = new _g.PointLight(0xfff4e6, 0.95, 18, 1.5);
    indoor.position.set(0, WH - 0.8, 0);
    g.add(indoor);

    g.position.set(cx, 0, cz);
    parent.add(g);
  }

    function buildPartVerticalScroll(parent, x, y, z, ry) {
    var g = new _g.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    // 卷轴
    var scroll = new _g.Mesh(new _g.PlaneGeometry(0.55, 2.2), canvasMat(drawSign("", ""), { side: _g.DoubleSide }));
    scroll.position.z = 0.02;
    g.add(scroll);
    // 上下轴头
    buildBox(g, 0.7, 0.08, 0.08, 0, 1.1, 0.04, mat(0x5d4a3a));
    buildBox(g, 0.7, 0.08, 0.08, 0, -1.1, 0.04, mat(0x5d4a3a));
    parent.add(g);
  }
  function buildPartHallTitle(parent, title, sub, x, y, z, ry) {
    var plaque = new _g.Mesh(
      new _g.PlaneGeometry(3.2, 0.9),
      canvasMat(drawSign(title, sub), { side: _g.DoubleSide })
    );
    plaque.position.set(x, y, z);
    plaque.rotation.y = ry;
    parent.add(plaque);
  }
  function buildPartHall(parent, opt) {
    var g = new _g.Group();
    var X0 = opt.x0, X1 = opt.x1, Z0 = opt.z0, Z1 = opt.z1;
    var cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    var W = X1 - X0, D = Z1 - Z0;
    var halfW = W / 2, halfD = D / 2;
    var F = opt.floorY || 0.3;
    var WH = opt.wallH || 4.2;
    var TH = 0.35;
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });

    // 墙体（带门洞）+ 窗
    buildPartHallWalls(g, W, D, WH, TH, wallMat, opt.doorSide, opt.doorCenter || 0, opt.doorWidth || 3, opt.doorHeight || 3);

    // 马头墙（山墙两侧）
    if (opt.horseHead) {
      buildPartHorseHeadWall(g, -halfW, -1, -halfD, halfD, WH);
      buildPartHorseHeadWall(g, halfW, 1, -halfD, halfD, WH);
    }

    // 木地板
    var floor = new _g.Mesh(new _g.PlaneGeometry(W - 0.6, D - 0.6), canvasMat(drawWood(), { roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, F, 0);
    floor.receiveShadow = true;
    g.add(floor);

    // 屋顶
    buildRoof(g, { x: 0, z: 0, y: WH + 0.15, w: W, d: D, h: opt.roofH || 1.6, eave: 1.0, ridge: W - 2 });

    // 挂画
    if (opt.paintings) {
      opt.paintings.forEach(function (p) {
        addPainting(g, { x: p.x, y: p.y, z: p.z, ry: p.ry || 0, lamp: p.lamp }, p.w, p.h, p.id);
      });
    }

    // 展台器物
    if (opt.pedestal) {
      addPedestalLocal(g, 0, F, 0, opt.pedestal.id, opt.pedestal.sign);
    }

    // 家具
    if (opt.furniture) {
      opt.furniture(g, halfW, halfD, F);
    }

    g.position.set(cx, 0, cz);
    parent.add(g);
  }

  /* 厅墙体：四面都用墙体系统（石基 + 粉墙 + 砖框 + 瓦压顶），洞口走 openings
   * 签名保持不变，六厅自动全部升级 */
  function buildPartHallWalls(g, W, D, WH, TH, wallMat, doorSide, doorCenter, doorW, doorH) {
    var a = W / 2, b = D / 2;
    var win = function (u, sill, w, h) { return { kind: "window", u: u, w: w, h: h, sill: sill }; };
    var door = function (u) { return { kind: "door", u: u, w: doorW, h: doorH, sill: 0 }; };

    /* 北墙：挂画的主墙，只开高窗，不打断画面 */
    var north = [win(-a * 0.45, 1.9, 1.2, 1.3), win(a * 0.45, 1.9, 1.2, 1.3)];
    /* 南墙 */
    var south = [];
    if (doorSide === "s") {
      south.push(door(doorCenter));
      [-1, 1].forEach(function (s) {
        var u = doorCenter + s * (doorW / 2 + 1.6);
        if (Math.abs(u) < a - 1.3) south.push(win(u, 1.9, 1.1, 1.3));
      });
    } else {
      south.push(win(-a * 0.5, 1.9, 1.2, 1.3), win(a * 0.5, 1.9, 1.2, 1.3));
    }
    /* 东西墙：开门的那面开门，另一面开中窗（借景） */
    var west = doorSide === "w" ? [door(doorCenter)] : [win(0, 1.9, 1.3, 1.4)];
    var east = doorSide === "e" ? [door(doorCenter)] : [win(0, 1.9, 1.3, 1.4)];

    buildPartWallRun(g, { cx: 0, cz: -b, len: W, h: WH, th: TH, ry: 0, openings: north, name: "wall-N", outward: -1 });
    buildPartWallRun(g, { cx: 0, cz: b, len: W, h: WH, th: TH, ry: 0, openings: south, name: "wall-S", outward: 1 });
    buildPartWallRun(g, { cx: -a, cz: 0, len: D, h: WH, th: TH, ry: Math.PI / 2, openings: west, name: "wall-W", outward: -1 });
    buildPartWallRun(g, { cx: a, cz: 0, len: D, h: WH, th: TH, ry: Math.PI / 2, openings: east, name: "wall-E", outward: 1 });
  }

  /* 马头墙：三级水平阶梯，逐级黑瓦压顶（依据 facade.png 与 xuting-components.png 3-1）
   * 中段升至墙身以上 1.5m，两肩各降一级，水平出步各占进深的 20% */
  function buildPartHorseHeadWall(g, x, side, z0, z1, baseH) {
    var step = (z1 - z0) * 0.2;
    var tiers = [
      { a: z0 + step, b: z1 - step, top: baseH + 1.5 },
      { a: z0, b: z0 + step, top: baseH + 0.85 },
      { a: z1 - step, b: z1, top: baseH + 0.85 }
    ];
    tiers.forEach(function (t) {
      buildPartWallRun(g, {
        cx: x + side * 0.2, cz: (t.a + t.b) / 2, len: t.b - t.a, h: t.top,
        th: 0.4, ry: Math.PI / 2, plinth: 0.46, frame: 0.22, name: "horsehead"
      });
    });
  }
  /* 局部坐标展台（不依赖 addPedestal 的硬编码 z=-2） */
  function addPedestalLocal(parent, x, floorY, z, exhibitId, signText) {
    var base = new _g.Mesh(new _g.BoxGeometry(1.5, 1.05, 1.5), mat(0x7a5c48, { roughness: 0.75 }));
    base.position.set(x, floorY + 0.525, z);
    base.castShadow = true;
    parent.add(base);
    obstacles.push({ type: "circle", x: x, z: z, r: 1.0 });

    var artifact;
    if (exhibitId === "houmuwuding") artifact = buildDing();
    else artifact = buildWarrior();
    artifact.position.set(x, floorY + 1.05, z);
    artifact.castShadow = true;
    parent.add(artifact);

    addSign(parent, x, floorY + 1.05, z + 0.9, signText);
    registerSpot({ exhibitId: exhibitId, x: x, y: floorY + 1.76, z: z, radius: 2.6 });
  }
  /* ---------- 7. 家具零件 ---------- */
  function buildPartTeaTable(parent, x, y, z) {
    var g = new _g.Group();
    g.position.set(x, y, z);
    buildBox(g, 3.2, 0.08, 1.0, 0, 0.04, 0, mat(0x6d5544, { roughness: 0.75 }));
    [[-1.4, -0.35], [1.4, -0.35], [-1.4, 0.35], [1.4, 0.35]].forEach(function (p) {
      buildBox(g, 0.12, 0.45, 0.12, p[0], -0.225, p[1], mat(0x5d4a3a));
    });
    parent.add(g);
  }

  function buildPartStudyTable(parent, x, y, z) {
    var g = new _g.Group();
    g.position.set(x, y, z);
    buildBox(g, 2.8, 0.08, 0.9, 0, 0.04, 0, mat(0x6d5544, { roughness: 0.75 }));
    [[-1.2, -0.3], [1.2, -0.3], [-1.2, 0.3], [1.2, 0.3]].forEach(function (p) {
      buildBox(g, 0.1, 0.4, 0.1, p[0], -0.2, p[1], mat(0x5d4a3a));
    });
    parent.add(g);
  }


  function buildPartLongTable(parent, x, y, z, w, d) {
    var g = new _g.Group();
    g.position.set(x, y, z);
    buildBox(g, w, 0.08, d, 0, 0.04, 0, mat(0x6d5544, { roughness: 0.75 }));
    var legW = 0.12, legH = 0.72;
    var lx = w / 2 - 0.25, lz = d / 2 - 0.2;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (p) {
      buildBox(g, legW, legH, legW, p[0], -0.36, p[1], mat(0x5d4a3a));
    });
    parent.add(g);
  }

  function buildPartStool(parent, x, z) {
    var g = new _g.Group();
    g.position.set(x, 0.3, z);
    buildBox(g, 0.55, 0.08, 0.55, 0, 0.34, 0, mat(0x6d5544, { roughness: 0.75 }));
    buildBox(g, 0.1, 0.32, 0.1, -0.18, 0.16, -0.18, mat(0x5d4a3a));
    buildBox(g, 0.1, 0.32, 0.1, 0.18, 0.16, -0.18, mat(0x5d4a3a));
    buildBox(g, 0.1, 0.32, 0.1, -0.18, 0.16, 0.18, mat(0x5d4a3a));
    buildBox(g, 0.1, 0.32, 0.1, 0.18, 0.16, 0.18, mat(0x5d4a3a));
    parent.add(g);
  }

  function buildPartBookshelf(parent, x, y, z, ry) {
    var g = new _g.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    var wood = mat(0x6d5544, { roughness: 0.75 });
    var w = 2.6, h = 1.3, d = 0.45;
    buildBox(g, w, 0.06, d, 0, 0.03, 0, wood);
    buildBox(g, w, 0.06, d, 0, h - 0.03, 0, wood);
    buildBox(g, 0.06, h, d, -w / 2 + 0.03, h / 2, 0, wood);
    buildBox(g, 0.06, h, d, w / 2 - 0.03, h / 2, 0, wood);
    for (var i = 1; i < 4; i++) {
      buildBox(g, w - 0.12, 0.04, d - 0.04, 0, i * (h / 4), 0, wood);
    }
    // 摆放典籍色块
    var bookMat = mat(0x8fb3a8, { roughness: 0.9 });
    for (var j = 0; j < 12; j++) {
      var bh = 0.22 + (j % 3) * 0.04;
      buildBox(g, 0.08, bh, 0.28, -w / 2 + 0.22 + (j % 6) * 0.18, 0.04 + bh / 2 + Math.floor(j / 6) * (h / 4) + 0.02, 0.06, bookMat);
    }
    parent.add(g);
  }

  function buildPartDisplayShelf(parent, x, y, z, ry) {
    var g = new _g.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    var wood = mat(0x7a5c48, { roughness: 0.75 });
    var w = 2.4, h = 2.2, d = 0.4;
    buildBox(g, w, 0.06, d, 0, 0.03, 0, wood);
    buildBox(g, w, 0.06, d, 0, h - 0.03, 0, wood);
    buildBox(g, 0.05, h, d, -w / 2 + 0.025, h / 2, 0, wood);
    buildBox(g, 0.05, h, d, w / 2 - 0.025, h / 2, 0, wood);
    for (var i = 1; i < 5; i++) {
      buildBox(g, w - 0.1, 0.03, d - 0.02, 0, i * (h / 5), 0, wood);
    }
    // 文创产品：卷轴、书签、明信片色块
    var rollMat = mat(0xd9c39a, { roughness: 0.8 });
    var cardMat = mat(0xc9e0e4, { roughness: 0.8 });
    for (var j = 0; j < 8; j++) {
      buildBox(g, 0.12, 0.55, 0.12, -w / 2 + 0.25 + j * 0.28, 0.275 + (h / 5), 0.04, rollMat);
      buildBox(g, 0.18, 0.12, 0.05, -w / 2 + 0.25 + j * 0.28, 0.06 + (h / 5) * 2, 0.04, cardMat);
    }
    parent.add(g);
  }

  function buildPartWindowWall(parent, x, y0, y1, z0, z1, ry) {
    var wood = mat(0x5d4a3a, { roughness: 0.7 });
    var paper = mat(0xf5f0e6, { roughness: 0.9, transparent: true, opacity: 0.55, side: _g.DoubleSide });
    var H = y1 - y0;
    var W = z1 - z0;
    var paneW = 1.15;
    var n = Math.max(3, Math.round(W / paneW));
    var actualW = W / n;
    var frameD = 0.12;

    // 外框门槛/上槛（整体）
    buildBox(parent, 0.14, 0.12, W + 0.1, x, y0, (z0 + z1) / 2, wood);
    buildBox(parent, 0.14, 0.12, W + 0.1, x, y1, (z0 + z1) / 2, wood);

    for (var i = 0; i < n; i++) {
      var cz = z0 + actualW * (i + 0.5);
      var isEdge = i === 0 || i === n - 1;
      var openAngle = isEdge ? (ry > 0 ? 0.12 : -0.12) : 0;

      var door = new _g.Group();
      door.position.set(x, y0, cz);
      door.rotation.y = ry + openAngle;
      // 注册微风动画：基础角度 + 随机相位
      animWindowDoors.push({ mesh: door, baseRy: ry + openAngle, phase: Math.random() * Math.PI * 2 });

      // 门扇左右竖框
      buildBox(door, 0.08, H, frameD, 0, H / 2, -actualW / 2 + 0.04, wood);
      buildBox(door, 0.08, H, frameD, 0, H / 2, actualW / 2 - 0.04, wood);
      // 门扇上下横框
      buildBox(door, 0.08, 0.1, actualW - 0.08, 0, 0.05, 0, wood);
      buildBox(door, 0.08, 0.1, actualW - 0.08, 0, H - 0.05, 0, wood);
      // 中腰槛
      buildBox(door, 0.06, 0.08, actualW - 0.1, 0, H * 0.52, 0, wood);
      // 竖棂条 3 根
      for (var k = -1; k <= 1; k++) {
        buildBox(door, 0.04, H - 0.24, frameD, 0, H / 2, k * (actualW * 0.22), wood);
      }
      // 窗纸
      var paperMesh = new _g.Mesh(new _g.PlaneGeometry(H - 0.24, actualW - 0.18), paper);
      paperMesh.position.set(ry > 0 ? 0.045 : -0.045, H / 2, 0);
      paperMesh.rotation.y = ry > 0 ? Math.PI / 2 : -Math.PI / 2;
      door.add(paperMesh);

      parent.add(door);
    }
  }

  /* ============================================================
   * 展品热点登记
   * ============================================================ */
  /* ============================================================
   * 地面高度查询（给 player.js 做高度跟随）
   * ------------------------------------------------------------
   * 新布局里序厅是 1.2m 高台，南侧有六级踏跺；玩家若只按平面移动
   * 会直接穿进台基。这里把"某点地面标高"暴露出去，player.js 每帧
   * 查一次、把视点抬到地面之上即可（上升建议做插值，避免瞬移感）。
   * 数据来自外观原型：台基 x −11~11 / z 24.5~34.5、高 1.2m；
   * 南入口六级踏跺 z 34.9~36.7，每级 0.2m，顶面 1.2→0.2。
   * ============================================================ */
  /* 各厅正房 0.5m 台基（buildHall 的 platTop=0.5；台基面阔/进深在厅 w/d 上各外扩 1.2m）。
     数据从外观原型 slots.hall 抽取，与 registerProtoHallWalls 同源，换方案不用重写本表。 */
  var _hallPlatforms = [];

  function buildTerrainPlatforms() {
    _hallPlatforms.length = 0;
    var slots = window.MuseumExteriorLayout && window.MuseumExteriorLayout.slots;
    var halls = (slots && slots.hall) || [];
    halls.forEach(function (h) {
      var pw = h.w + 2.4, pd = h.d + 2.4;
      _hallPlatforms.push({
        x0: h.cx - pw / 2, x1: h.cx + pw / 2,
        z0: h.cz - pd / 2, z1: h.cz + pd / 2,
      });
    });
  }

  function terrainHeightAt(x, z) {
    /* 序厅 1.2m 高台：x ±11.3 含两侧 4m 侧院（旧值 ±11 漏掉侧院外带，会 1.2m 直降） */
    if (x >= -11.3 && x <= 11.3 && z >= 24.5 && z <= 34.5) return 1.2;

    /* 南入口六级踏跺（越往北越高，第 0 级顶面 1.2） */
    if (x >= -7 && x <= 7 && z >= 34.5 && z <= 36.9) {
      var i = Math.floor((z - 34.9) / 0.36 + 0.5);
      if (i < 0) i = 0;
      if (i > 5) i = 5;
      return 1.2 - i * 0.2;
    }

    /* 序厅北侧中央大踏跺：六级（面阔 4.2m，x ±2.1），1.2m 下到中轴南院 */
    if (x >= -2.1 && x <= 2.1 && z >= 22.1 && z < 24.5) {
      var c = Math.floor((24.5 - z) / 0.34);
      if (c < 0) c = 0;
      if (c > 5) c = 5;
      return Math.max(0, 1.2 - c * 0.2);
    }

    /* 序厅北出口：后墙照壁两侧门（x=±4.8，净 1.6m）外四步踏跺，下 1.2m 高台到中轴庭院 */
    if (z >= 23.7 && z < 24.5 && ((x >= -5.6 && x <= -4.0) || (x >= 4.0 && x <= 5.6))) {
      var j = Math.min(3, Math.floor((24.5 - z) / 0.2));
      return 1.2 - j * 0.3;
    }

    /* 侧院东西廊门踏跺：侧院(1.2m) → 游廊(0m) 逐级下（东门 z=26.5、西门 z=28.5） */
    if (x >= 11.3 && x <= 12.5 && z >= 25.6 && z <= 27.4) {
      var e = Math.min(3, Math.floor((x - 11.3) / 0.3));
      return Math.max(0, 1.2 - e * 0.3);
    }
    if (x >= -12.5 && x <= -11.3 && z >= 27.6 && z <= 29.4) {
      var w = Math.min(3, Math.floor((-11.3 - x) / 0.3));
      return Math.max(0, 1.2 - w * 0.3);
    }

    /* 各厅正房 0.5m 台基 */
    for (var k = 0; k < _hallPlatforms.length; k++) {
      var p = _hallPlatforms[k];
      if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return 0.5;
    }

    return 0;
  }
  function registerSpot(spot) {
    spotMeshes.push(spot);
  }

  function findExhibit(id) {
    return window.MuseumConfig.exhibits.find(function (e) { return e.id === id; });
  }

  /* ============================================================
   * 展品热点登记（proto 布局）
   * ------------------------------------------------------------
   * 坐标见 docs/展品落位表.md 与 tools/exhibit-anchors.json。
   * 9 幅画挂中轴双廊的画廊墙（半壁墙 x=±8.1，画面在 x=±7.96），
   * 玩家走中间过道、两侧都能触发；3 件雕塑在序厅 / 人物厅 / 中心庭。
   * ============================================================ */
  function registerProtoExhibitSpots() {
    var RING = 2.4, SCULPT = 2.8;
    var paintings = [
      /* 西廊（面朝东）：北 → 南 */
      ["hanxizai",          -7.96, 10.93],
      ["qianlijiangshan",   -7.96, 13.79],
      ["fuchunshanjv",      -7.96, 16.65],
      ["xishanxinglvtu",    -7.96, 19.51],
      ["luoshenfu",         -7.96, 22.37],
      /* 东廊（面朝西）：北 → 南；z=22.37 那个开间组长留空，暂不登记 */
      ["buniantu",           7.96, 10.93],
      ["xieshengzhenqintu",  7.96, 13.79],
      ["wuniutu",            7.96, 16.65],
      ["molantu",            7.96, 19.51],
      /* 书斋 / 茶室（立轴在正房背墙 x=40.84，面朝西） */
      ["lantingjixu",        40.84, 10.0],
      ["jizhiwengao",        40.84, 15.0],
      ["hanshitie",          40.84, 24.0],
      ["tingqintu",          40.84, 29.0],
      /* 文创 / 临摹（立轴在正房背墙 x=-43.84，面朝东） */
      ["huishanchahui",     -43.84, 12.0],
      ["shimingtu",         -43.84, 17.0],
      ["pinchatu",          -43.84, 26.0],
      ["luyupengchatu",     -43.84, 31.0],
    ];
    var sculptures = [
      ["houmuwuding",   0,      29.5],   // 序厅（原型 slots.ding 落点）
      ["jiangjunyong",  36.75, -13.8],   // 人物厅正房
      ["matayafeiyan",  0,     -13],     // 中心庭广场点景
    ];
    paintings.forEach(function (p) {
      registerSpot({ exhibitId: p[0], x: p[1], y: 1.5, z: p[2], radius: RING });
    });
    sculptures.forEach(function (s) {
      registerSpot({ exhibitId: s[0], x: s[1], y: 1.2, z: s[2], radius: SCULPT });
    });
  }

  /* ============================================================
   * 碰撞体登记（proto 布局）
   * ------------------------------------------------------------
   * 数据来源：docs/外观原型-坐标对接表.md（组长按原型抽的院墙/台基范围）。
   * 原型只画外观、不提供碰撞体，这里按表逐栋补上。
   * 规则：
   *   - 院落式：登记一圈院墙，主门洞（表里「洞口宽」）与后门断开；
   *     人物厅西墙另有 2.5m 侧门（对齐游廊端头）。
   *   - 单体式（雅集/兰竹）：没有院墙，按正房面阔×进深登记四面墙，
   *     正门 2.6m / 后门 1.8m 断开（与 buildHall 实际留洞一致）。
   *   - ⚠️ 台基一律不登记：序厅 1.2m 高台由 player.js 的 terrainHeightAt 高度跟随处理。
   * ============================================================ */
  var WALL_T = 0.4;        // 墙体厚（对齐原型 wallRun/fenceRun 的量级）
  var BACK_DOOR_W = 2.5;   // 院落式后门净宽（fenceRun 在 cx±1.25 断开）

  function rectObs(x0, z0, x1, z1) {
    obstacles.push({ type: "rect", x0: Math.min(x0, x1), z0: Math.min(z0, z1),
                     x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }
  function circleObs(x, z, r) {
    obstacles.push({ type: "circle", x: x, z: z, r: r });
  }

  /* 在一段轴上墙里挖掉若干门洞，剩下的登记成矩形碰撞体。
     axis='x' 墙沿 x 延伸、fixed 为 z；axis='z' 反之。gaps: [{c: 洞中心, w: 洞宽}] */
  function pushWallRun(axis, fixed, a0, a1, gaps) {
    var segs = [], cur = a0;
    gaps.slice().sort(function (p, q) { return p.c - q.c; }).forEach(function (g) {
      var gs = g.c - g.w / 2, ge = g.c + g.w / 2;
      if (ge <= a0 || gs >= a1) return;          // 洞完全在墙段之外
      if (gs > cur) segs.push([cur, Math.min(gs, a1)]);
      cur = Math.max(cur, ge);
    });
    if (cur < a1) segs.push([cur, a1]);
    segs.forEach(function (s) {
      if (s[1] - s[0] <= 0.01) return;           // 门洞紧贴墙角时可能切出空段
      if (axis === 'x') obstacles.push({ type: "rect", x0: s[0], z0: fixed - WALL_T / 2, x1: s[1], z1: fixed + WALL_T / 2 });
      else              obstacles.push({ type: "rect", x0: fixed - WALL_T / 2, z0: s[0], x1: fixed + WALL_T / 2, z1: s[1] });
    });
  }

  /* 一圈院墙/墙体：四边各挖该边的门洞（主门 / 后门 / 侧门） */
  function pushEnclosure(b) {
    var cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    var back = { N: 'S', S: 'N', E: 'W', W: 'E' }[b.entry];
    var backW = b.backW || BACK_DOOR_W;
    function gaps(side) {
      var alongX = (side === 'N' || side === 'S');
      var g = [];
      if (side === b.entry) g.push({ c: alongX ? cx : cz, w: b.gate });
      else if (side === back) g.push({ c: alongX ? cx : cz, w: backW });
      if (b.sideDoor && b.sideDoor[side] !== undefined) g.push({ c: b.sideDoor[side], w: BACK_DOOR_W });
      return g;
    }
    pushWallRun('x', b.z0, b.x0, b.x1, gaps('N'));
    pushWallRun('x', b.z1, b.x0, b.x1, gaps('S'));
    pushWallRun('z', b.x0, b.z0, b.z1, gaps('W'));
    pushWallRun('z', b.x1, b.z0, b.z1, gaps('E'));
  }

  function registerProtoObstacles() {
    /* 院落式：矩形取对接表的「院墙范围」，gate 取「洞口宽」 */
    [
      { x0: -11, x1: 11,    z0: -37.5,  z1: -21,    entry: 'S', gate: 5.4 },                        // 花鸟 hall2
      { x0: 28,  x1: 45.5,  z0: -21,    z1: -10,    entry: 'S', gate: 5.4, sideDoor: { W: -16 } },  // 人物 hall3（西墙侧门接东长廊）
      { x0: -46, x1: -28.5, z0: -20,    z1: -5,     entry: 'E', gate: 5.4 },                        // 山水 hall1
      { x0: 34,  x1: 42,    z0: 6,      z1: 19,     entry: 'W', gate: 3.8 },                        // 书斋 hall4
      { x0: -45, x1: -34,   z0: 8,      z1: 21,     entry: 'E', gate: 3.8 },                        // 文创 hall5
      { x0: 33,  x1: 45,    z0: -34.75, z1: -25.25, entry: 'S', gate: 3.8 },                        // 景韵（装饰）
      { x0: 34,  x1: 42,    z0: 20,     z1: 33,     entry: 'W', gate: 3.8 },                        // 茶室（装饰）
      { x0: -45, x1: -34,   z0: 22,     z1: 35,     entry: 'E', gate: 3.8 },                        // 临摹（装饰）
    ].forEach(pushEnclosure);

    /* 各栋正房（厅本体）另由 registerProtoHallWalls() 读 slots.hall 登记 */
  }

  /* ============================================================
   * 各栋正房（厅本体）碰撞体
   * ------------------------------------------------------------
   * 数据直接读外观原型的 MuseumExteriorLayout.slots.hall —— 原型在
   * buildHall() 里登记了 {cx, cz, w, d, entry, tag}，共 10 栋
   * （含雅集/兰竹两栋单体式）。洞口与 buildHall 实际留洞一致：
   * 正门 2.6m、后门 1.8m。台基不登记。
   * ============================================================ */
  function registerProtoHallWalls() {
    var slots = window.MuseumExteriorLayout && window.MuseumExteriorLayout.slots;
    var halls = (slots && slots.hall) || [];
    halls.forEach(function (h) {
      pushEnclosure({
        x0: h.cx - h.w / 2, x1: h.cx + h.w / 2,
        z0: h.cz - h.d / 2, z1: h.cz + h.d / 2,
        entry: h.entry, gate: 2.6, backW: 1.8,
      });
    });
  }

  /* ============================================================
   * 园区外墙登记（proto 布局）
   * ------------------------------------------------------------
   * 坐标逐段转写自 exterior-layout.js 的 buildBoundary()：
   * 100×80 园区（x ±50 / z ±40），北墙中央外凸出北门楼、
   * 南墙两角内折并在中央留序厅大门（x ±11），
   * x ±6.5 之间是北门、x ±11 之间是南大门 —— 两处都留空当门洞。
   * 不登记的话玩家能从东西两侧直接走出园区。
   * ============================================================ */
  function registerProtoBoundary() {
    var B = WALL_T / 2;
    function seg(x0, z0, x1, z1) {
      obstacles.push({
        type: "rect",
        x0: Math.min(x0, x1) - (x0 === x1 ? B : 0),
        x1: Math.max(x0, x1) + (x0 === x1 ? B : 0),
        z0: Math.min(z0, z1) - (z0 === z1 ? B : 0),
        z1: Math.max(z0, z1) + (z0 === z1 ? B : 0),
      });
    }
    /* 东、西两墙 */
    seg(-50, -40, -50, 40);
    seg(50, -40, 50, 40);
    /* 北墙：中央 x±6.5 外凸至 z=-43（北门楼），中间留空为北门 */
    seg(-50, -40, -6.5, -40);
    seg(-6.5, -40, -6.5, -43);
    seg(-6.5, -43, 6.5, -43);
    seg(6.5, -43, 6.5, -40);
    seg(6.5, -40, 50, -40);
    /* 南墙：两角 z=40 → 内折 z=36，中央 x±11 留作序厅大门 */
    seg(26, 40, 50, 40);
    seg(26, 40, 26, 36);
    seg(26, 36, 11, 36);
    seg(11, 36, 11, 34.8);
    seg(-11, 34.8, -11, 36);
    seg(-11, 36, -26, 36);
    seg(-26, 36, -26, 40);
    seg(-26, 40, -50, 40);
  }

  /* ============================================================
   * 序厅（buildXuting）墙体
   * ------------------------------------------------------------
   * 1.2m 高台基不登记（归 terrainHeightAt 高度跟随）；
   * 只登记前大门两翼墙、后照壁、侧墙与侧院围栏，以及阙楼柱、台上铜鼎。
   * ============================================================ */
  function registerProtoXuting() {
    /* 前大门（z=34.5）：两翼墙，中间净门洞 x[-1.8, 1.8] */
    rectObs(-7.1, 34.25, -1.8, 34.75);
    rectObs(1.8, 34.25, 7.1, 34.75);
    /* 抱鼓石（略侵门洞，略收窄入口） */
    circleObs(-2.3, 34.05, 0.62);
    circleObs(2.3, 34.05, 0.62);
    /* 后墙照壁（z=25）：中央实心，两侧各留 1.6m 小门 */
    rectObs(-7.0, 24.75, -5.6, 25.25);
    rectObs(-4.0, 24.75, 4.0, 25.25);
    rectObs(5.6, 24.75, 7.0, 25.25);
    /* 侧墙（x=±7.25）：月洞门留空 z[25.4, 27.5] */
    rectObs(-7.45, 24.8, -7.05, 25.4);
    rectObs(-7.45, 27.5, -7.05, 34.5);
    rectObs(7.05, 24.8, 7.45, 25.4);
    rectObs(7.05, 27.5, 7.45, 34.5);
    /* 侧院围栏（x=±11.25）：各留廊门洞 */
    rectObs(11.11, 24.5, 11.39, 25.25);
    rectObs(11.11, 27.75, 11.39, 34.5);
    rectObs(-11.39, 24.5, -11.11, 27.25);
    rectObs(-11.39, 29.75, -11.11, 34.5);
    /* 侧院南墙 */
    rectObs(-11.25, 34.3, -7.25, 34.7);
    rectObs(7.25, 34.3, 11.25, 34.7);
    /* 四角阙楼柱（每角 4 根） */
    [-10.15, -8.25, 8.25, 10.15].forEach(function (x) {
      [24.45, 26.35, 32.65, 34.55].forEach(function (z) { circleObs(x, z, 0.24); });
    });
    /* 台上铜鼎（原型 slots.ding 落点） */
    circleObs(0, 29.5, 1.02);
  }

  /* ============================================================
   * 游廊坐槛 · 画廊半壁墙 · 场内装饰障碍
   * ------------------------------------------------------------
   * 坐标逐条转写自 exterior-layout.js（游廊 / 观澜亭 / 中心庭 /
   * 水榭庭院 / 山石·荷池·兰竹·景观各庭院围栏 / 干涸河床立石）。
   * 不登记：各种台基与踏跺（可踩）、绿篱与灌木球（低矮）、
   *         檐枋挂落屋顶（在头顶）、水面（需另做禁行区，本轮未做）。
   * ============================================================ */
  function registerProtoDeco() {
    /* 游廊坐槛：两列通长实心条，玩家只能走中间净宽约 1.5m */
    [
      [-8.05, 9.5, -7.75, 23.8], [-6.25, 9.5, -5.95, 23.8],        // 中轴西廊
      [5.95, 9.5, 6.25, 23.8], [7.75, 9.5, 8.05, 23.8],            // 中轴东廊
      [-28.5, -13.55, -8.5, -13.25], [-28.5, -11.75, -8.5, -11.45],// 西长廊
      [8.5, -17.05, 27.9, -16.75], [8.5, -15.25, 27.9, -14.95],    // 东长廊
      [11, 27.25, 34, 27.55], [11, 25.45, 34, 25.75],              // 南花园东廊
      [-34, 29.25, -11, 29.55], [-34, 27.45, -11, 27.75],          // 南花园西廊
      [-24.25, -34, -23.95, -24.2], [-26.05, -34, -25.75, -24.2],  // 枯山水曲廊（沿 z）
      [-25, -33.25, -13.5, -32.95], [-25, -35.05, -13.5, -34.75],  // 枯山水曲廊（沿 x）
      /* 画廊半壁墙（9 幅画就挂在这两道墙上） */
      [-8.175, 10.3, -8.025, 23.2], [8.025, 10.3, 8.175, 23.2],
    ].forEach(function (r) { rectObs(r[0], r[1], r[2], r[3]); });

    /* 观澜亭四柱（石台 0.45m 可踩，不登记） */
    [-1.5, 1.5].forEach(function (x) {
      [14.5, 17.5].forEach(function (z) { circleObs(x, z, 0.24); });
    });

    /* 中心庭：5×5 内院围栏（南面留 1.6m 门洞）+ 石景 */
    rectObs(-2.5, -15.64, 2.5, -15.36);
    rectObs(-2.64, -15.5, -2.36, -10.5);
    rectObs(2.36, -15.5, 2.64, -10.5);
    rectObs(-2.5, -10.64, 0.9, -10.36);
    circleObs(0, -13.4, 0.32);          // 主树
    circleObs(-1.5, -14.4, 0.9);        // 太湖石
    circleObs(1.4, -12.0, 0.4);
    circleObs(5.8, -9.5, 1.05);         // 石桌
    rectObs(-6.6, -9.73, -5.0, -9.28);  // 石凳
    circleObs(0, -8.3, 1.9);            // 喷泉（实心）
    rectObs(3.32, -16.78, 3.88, -16.22);// 石灯
    circleObs(-4.0, -16.3, 0.22);
    circleObs(2.2, -16.2, 0.5);

    /* 水榭庭院：围栏（南面留 2.4m 门洞）+ 平台柱 + 假山 + 半亭柱 */
    rectObs(-7, -5.14, 7, -4.86);
    rectObs(-7.14, -5, -6.86, 7);
    rectObs(6.86, -5, 7.14, 7);
    rectObs(-7, 6.86, -1.2, 7.14);
    rectObs(1.2, 6.86, 7, 7.14);
    rectObs(-1.5, 6.7, -0.9, 7.3);
    rectObs(0.9, 6.7, 1.5, 7.3);
    [2.9, 5.5].forEach(function (x) {
      [-0.2, 1.4].forEach(function (z) { circleObs(x, z, 0.11); });
    });
    circleObs(-4.6, -2.6, 1.3);
    circleObs(-3.0, -3.4, 0.7);
    circleObs(-5.6, -1.2, 0.5);
    circleObs(5.3, 3.1, 0.19);
    circleObs(5.3, 5.3, 0.19);
    circleObs(3.2, 5.3, 0.2);
    circleObs(3.6, -3.4, 1.05);

    /* 山石庭院：围栏（南留 2.4m、东留 2m 门洞）+ 山石 */
    rectObs(-26.5, -6.14, -13.5, -5.86);
    rectObs(-26.5, 5.86, -21.2, 6.14);
    rectObs(-18.8, 5.86, -13.5, 6.14);
    rectObs(-26.64, -6, -26.36, 6);
    rectObs(-13.64, -6, -13.36, -1);
    rectObs(-13.64, 1, -13.36, 6);
    circleObs(-21.2, -0.6, 1.3);
    circleObs(-18.6, 1.2, 0.75);
    circleObs(-22.4, 2.6, 0.55);
    circleObs(-19.5, -3.2, 0.48);

    /* 荷池庭院：围栏（南留 2.8m 门洞）；荷池水面本轮不登记 */
    rectObs(15.5, 5.76, 26.5, 6.04);
    rectObs(15.5, 16.86, 19.6, 17.14);
    rectObs(22.4, 16.86, 26.5, 17.14);
    rectObs(15.36, 5.9, 15.64, 17);
    rectObs(26.36, 5.9, 26.64, 17);

    /* 兰竹庭院：三面围栏，南侧开放 */
    rectObs(30, -3.14, 36, -2.86);
    rectObs(29.86, -3, 30.14, 1);
    rectObs(35.86, -3, 36.14, 1);

    /* 景观庭院：围栏（南北各留 1.2/1.4m 门洞）+ 西花窗墙 + 影壁 */
    rectObs(11.5, -15.14, 12.9, -14.86);
    rectObs(14.1, -15.14, 15.5, -14.86);
    rectObs(11.5, -9.14, 12.8, -8.86);
    rectObs(14.2, -9.14, 15.5, -8.86);
    rectObs(11.36, -15, 11.64, -9);
    rectObs(15.36, -15, 15.64, -9);
    rectObs(12.5, -9.72, 14.5, -9.48);

    /* 干涸河床的立石（床面可站，只有石头挡人） */
    circleObs(-19.15, -29.48, 0.5);
    circleObs(-16.62, -27.95, 0.36);
    circleObs(-17.77, -30.23, 0.28);
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

      /* 布局来源：严格遵循外观原型 tools/exterior-prototype.html
         （原作者 Kimi；整块搬入 js/exterior-layout.js）
         没有该模块时退回本项目旧的六厅院落。 */
      var useProtoLayout = !!(window.MuseumExteriorLayout && window.MuseumExteriorLayout.build);
      if (useProtoLayout) {
        window.MuseumExteriorLayout.addLights(scene);
        window.MuseumExteriorLayout.build(scene);
        /* 真模型接线：读原型的 slots 登记表，把代码件换成 assets/models/parts/opt/ 里的 GLB
           （门楼/石狮/青铜鼎/太湖石/景观石/树/竹…；任何一件失败就保留代码件） */
        if (window.MuseumExteriorSlots) window.MuseumExteriorSlots.install(scene);
        /* 碰撞体：原型不提供，由接缝侧按对接表登记（旧路径 buildJiangnanCompound 自带） */
        registerProtoObstacles();
        registerProtoBoundary();
        registerProtoHallWalls();
        buildTerrainPlatforms();
        registerProtoXuting();
        registerProtoDeco();
        /* 展品热点：同上（旧路径自带 20 条，此处只补 proto 布局缺的 12 条） */
        registerProtoExhibitSpots();
      } else {
        buildJiangnanCompound(scene);
      }

      if (useProtoLayout) {
        /* 光照与雾也照原型来（原型光照在 addLights 里） */
        scene.background = new _g.Color(0xece6d8);
        scene.fog = new _g.Fog(0xece6d8, 95, 300);
      } else {
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
        var fill = new _g.DirectionalLight(0xdfe6f2, 0.3);
        fill.position.set(-16, 14, -20);
        scene.add(fill);
        scene.fog = new _g.Fog(0xd9d4c8, 52, 135);
      }
      // 展厅区域判定：坐标取自外观原型（tools/exterior-prototype.html）
      Object.keys(hallRegions).forEach(function (k) { delete hallRegions[k]; });
      if (useProtoLayout) {
        Object.assign(hallRegions, {
          plaza:     { type: "rect",  x0: -26,  z0: 34,   x1: 26,   z1: 41 },     // 南入口前庭（六级大台阶）
          hall0:     { type: "rect",  x0: -11,  z0: 24.5, x1: 11,   z1: 34.5 },   // 序厅（高台基 22×10）
          courtyard: { type: "rect",  x0: -9,   z0: -20,  x1: 9,    z1: 24.5 },   // 中轴庭院带（轴线庭+水榭+中心庭）
          hall1:     { type: "rect",  x0: -46,  z0: -20,  x1: -28.5, z1: -5 },    // 山水画展区（院落 17.5×15）
          hall2:     { type: "rect",  x0: -11,  z0: -37.5, x1: 11,  z1: -21 },    // 花鸟画展区（院落 22×16.5）
          hall3:     { type: "rect",  x0: 28,   z0: -21,  x1: 45.5, z1: -10 },    // 人物画展区（院落 17.5×11）
          hall4:     { type: "rect",  x0: 34,   z0: 6,    x1: 42,   z1: 35.5 },   // 书斋 + 茶室（两个院落，z 6~35.5）
          hall5:     { type: "rect",  x0: -45,  z0: 8,    x1: -34,  z1: 35.5 },   // 文创 + 临摹（两个院落，z 8~35.5）
        });
      } else {
        Object.assign(hallRegions, {
          plaza:     { type: "circle", x: 0, z: 20, r: 34 },
          hall0:     { type: "rect",  x0: -10, z0: 24,  x1: 10,  z1: 34 },
          courtyard: { type: "rect",  x0: -16, z0: 0,   x1: 16,  z1: 22 },
          hall1:     { type: "rect",  x0: -34, z0: -22, x1: -16, z1: -4 },
          hall2:     { type: "rect",  x0: -12, z0: -24, x1: 12,  z1: -8 },
          hall3:     { type: "rect",  x0: 16,  z0: -22, x1: 34,  z1: -4 },
          hall4:     { type: "rect",  x0: 16,  z0: 6,   x1: 32,  z1: 20 },
          hall5:     { type: "rect",  x0: -32, z0: 6,   x1: -16, z1: 20 },
        });
      }

    },

    update: function () {
      // 窗扇微风摆动
      var t = Date.now() * 0.0012;
      animWindowDoors.forEach(function (item) {
        item.mesh.rotation.y = item.baseRy + Math.sin(t + item.phase) * 0.035;
      });
    },

    terrainHeightAt: terrainHeightAt,   // 地面标高查询（player.js 高度跟随用）
    /* 供 js/windows.js 调用：把我们的落地格扇窗建到指定 parent 里 */
    buildWindowWallInto: function (parent, x, y0, y1, z0, z1, ry) {
      buildPartWindowWall(parent, x, y0, y1, z0, z1, ry);
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