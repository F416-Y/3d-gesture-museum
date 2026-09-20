/* ============================================================
 * scene.js —— 园区 · 建筑 · 展厅 · 灯光
 * 归属：组员1（3D 场景主程）
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
  function buildPlaza(root) {
    // 地面（石板米白）
    var ground = new _g.Mesh(new _g.PlaneGeometry(90, 90), mat(0xd8d2c4, { roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);

    // 草坪（两侧灰绿）
    var lawnGeo = new _g.PlaneGeometry(90, 26);
    [-1, 1].forEach(function (side) {
      var lawn = new _g.Mesh(lawnGeo, mat(0x70795a, { roughness: 1 }));
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(side * 21, 0.02, 6);
      root.add(lawn);
    });

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
    var gateRoof = new _g.Mesh(new _g.CylinderGeometry(6.2, 6.8, 0.5, 4), mat(0x3f3a35, { roughness: 0.8 }));
    gateRoof.rotation.y = Math.PI / 4;
    gateRoof.position.set(0, 4.15, 42.2);
    root.add(gateRoof);

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
    var wall = new _g.Mesh(new _g.BoxGeometry(len, 2.1, 0.4), mat(0xd0c8b6, { roughness: 0.9 }));
    wall.position.set(cx, 1.05, cz);
    wall.rotation.y = rotY;
    root.add(wall);
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
      var wall = new _g.Mesh(new _g.BoxGeometry(half, 2.1, 0.4), mat(0xd0c8b6, { roughness: 0.9 }));
      wall.position.set(side * (half / 2 + 4.6), 1.05, 44);
      root.add(wall);
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

    // 基座
    var plinth = new _g.Mesh(new _g.BoxGeometry(26, 0.7, 18), mat(0xb9b0a0, { roughness: 0.9 }));
    plinth.position.set(0, 0.35, -2);
    plinth.receiveShadow = true;
    group.add(plinth);
    // 建筑碰撞：只挡「外墙 + 正门两侧基座」，室内展厅必须保持可漫游，
    // 否则玩家会被堵在 x ∈ [-2,2] 的 4 米通道里，二楼展厅的 6 件展品全都走不到。
    obstacles.push({ type: "rect", x0: -13, z0: 5.6, x1: -2, z1: 7 });      // 南立面·门左
    obstacles.push({ type: "rect", x0: 2, z0: 5.6, x1: 13, z1: 7 });        // 南立面·门右
    obstacles.push({ type: "rect", x0: -13, z0: -11, x1: -10.6, z1: 7 });   // 西外墙
    obstacles.push({ type: "rect", x0: 10.6, z0: -11, x1: 13, z1: 7 });     // 东外墙
    obstacles.push({ type: "rect", x0: -13, z0: -11, x1: 13, z1: -9.6 });   // 北外墙

    // 台阶（正门）
    [-1, 1].forEach(function (k) {
      var step = new _g.Mesh(new _g.BoxGeometry(8, 0.16, 1.1), mat(0xb9b0a0, { roughness: 0.9 }));
      step.position.set(0, 0.16 * (k + 1), 6.4 + k * 1.1);
      group.add(step);
    });

    // 一层主体墙（22 x 3.8 x 14）
    var wallMat = mat(0xefe9dc, { roughness: 0.9, side: _g.DoubleSide });
    buildBox(group, 22, 3.8, 0.35, 0, 2.55, -2, wallMat);   // 顶板（兼挑檐内侧）
    buildBox(group, 22, 0.35, 14, 0, 4.55, -2, wallMat);    // 一层楼板/二层地面
    buildBox(group, 0.35, 3.8, 14, -10.82, 2.55, -2, wallMat); // 西墙
    buildBox(group, 0.35, 3.8, 14, 10.82, 2.55, -2, wallMat);  // 东墙
    buildBox(group, 22, 3.8, 0.35, 0, 2.55, -9.82, wallMat);   // 北墙
    // 南墙（大门开口）：左墙 + 右墙 + 门上横墙
    buildBox(group, 9, 3.8, 0.35, -6.5, 2.55, 5.82, wallMat);
    buildBox(group, 9, 3.8, 0.35, 6.5, 2.55, 5.82, wallMat);
    buildBox(group, 4, 1.0, 0.35, 0, 4.05, 5.82, wallMat);

    // 一层立柱（红柱，正门廊）
    var colGeo = new _g.CylinderGeometry(0.18, 0.22, 3.9, 10);
    var colMat = mat(0x9c3a2c, { roughness: 0.55 });
    [-6.8, -2.6, 2.6, 6.8].forEach(function (x) {
      var col = new _g.Mesh(colGeo, colMat);
      col.position.set(x, 2.55, 7.0);
      col.castShadow = true;
      group.add(col);
      obstacles.push({ type: "circle", x: x, z: 7.0, r: 0.4 });
    });

    // 二层外观（不可进入，纯外观）
    buildBox(group, 20.4, 2.6, 12.4, 0, 6.0, -2, wallMat);
    // 二层窗户
    var winMat = mat(0x2c2a26, { roughness: 0.4 });
    [[-5, 6.2, -3.9], [5, 6.2, -3.9], [-5, 6.2, -0.1], [5, 6.2, -0.1]].forEach(function (p) {
      buildBox(group, 2.6, 1.5, 0.12, p[0], p[1], p[2], winMat);
    });

    // 挑檐 + 四坡屋顶
    buildBox(group, 23.4, 0.28, 15.4, 0, 7.25, -2, mat(0x3f3a35, { roughness: 0.8 }));
    var roof = new _g.Mesh(new _g.CylinderGeometry(4.4, 14.2, 2.6, 4), mat(0x3f3a35, { roughness: 0.8 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 8.75, -2);
    roof.castShadow = true;
    group.add(roof);

    // 匾额（正门上方）
    var plaque = new _g.Mesh(
      new _g.PlaneGeometry(3.6, 1.0),
      canvasMat(drawPlaque("云墨美术馆"), { side: _g.DoubleSide })
    );
    plaque.position.set(0, 4.28, 5.9);
    group.add(plaque);

    /* ---------- 室内一层（中国绘画厅） ---------- */
    // 室内地面（木地板）
    var floor = new _g.Mesh(new _g.PlaneGeometry(21.6, 13.6), canvasMat(drawWood(), { roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.71, -2);
    floor.receiveShadow = true;
    group.add(floor);

    // 天花板（一层顶板底面，double side 已可见）

    // 中央展台（鼎 + 俑）
    addPedestal(group, -3.2, "houmuwuding", "后母戊鼎 · 商");
    addPedestal(group, 3.4, "jiangjunyong", "将军俑 · 秦");

    // 展墙上的画（挂于东、西、北墙 + 南墙两侧）
    addPainting(group, { x: 0, y: 2.55, z: -9.35, ry: 0 }, 3.4, 2.2, "qianlijiangshan");            // 北墙·千里江山
    addPainting(group, { x: -5.6, y: 2.55, z: -9.35, ry: 0 }, 2.2, 1.5, "fuchunshanjv");          // 北墙·富春山居
    addPainting(group, { x: 5.6, y: 2.55, z: -9.35, ry: 0 }, 2.2, 1.5, "qingmingshanghe");        // 北墙·清明上河
    addPainting(group, { x: -10.35, y: 2.55, z: -4.5, ry: -Math.PI / 2 }, 2.2, 1.5, "hanxizai");    // 西墙·韩熙载
    addPainting(group, { x: -10.35, y: 2.55, z: 0.8, ry: -Math.PI / 2 }, 2.2, 1.5, "luoshenfu");    // 西墙·洛神赋

    // 室内照明
    var light1 = new _g.PointLight(0xffe6c4, 0.85, 26, 2);
    light1.position.set(0, 4.2, -2);
    group.add(light1);
    var light2 = new _g.PointLight(0xffe6c4, 0.5, 18, 2);
    light2.position.set(-6, 4.0, -6);
    group.add(light2);
    var light3 = new _g.PointLight(0xffe6c4, 0.5, 18, 2);
    light3.position.set(6, 4.0, -6);
    group.add(light3);

    /* ---------- 西侧连廊（文明对话厅 · 二楼展品移此，可到达） ---------- */
    buildCorridor(root, group);

    /* ---------- 前庭雕塑（铜奔马 + 石狮） ---------- */
    // 铜奔马置于中轴偏西：中轴要给「张开手掌向前漫游 → 直行进门」留出干净走道
    addPlazaSculpture(root, -6.4, 15.2, "matayafeiyan", "马踏飞燕 · 东汉");
    addStoneLion(root, -7.2, 9.2, 1);
    addStoneLion(root, 7.2, 9.2, -1);

    /* ---------- 展厅区域（用于玩家所在厅判定） ---------- */
    hallRegions.plaza = { type: "circle", x: 0, z: 20, r: 34 };
    hallRegions.hall1 = { type: "rect", x0: -10.5, z0: -9.5, x1: 10.5, z1: 5.5 };
    hallRegions.hall2 = { type: "rect", x0: -16.5, z0: -9.5, x1: -12.2, z1: 5.5 };

    return group;
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
    addSign(parent, pos.x, pos.y - h / 2 - 0.75, pos.z, ex.title + " · " + ex.dynasty);

    // 射灯
    var spot = new _g.SpotLight(0xffe9c9, 0.55, 9, Math.PI / 6, 0.5, 1.6);
    spot.position.set(pos.x, pos.y + h / 2 + 1.0, pos.z);
    parent.add(spot);

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

    // 顶
    buildBox(g, 5.0, 0.25, 15.2, -14.5, 4.15, -2, mat(0x3f3a35, { roughness: 0.8 }));
    var roof = new _g.Mesh(new _g.CylinderGeometry(2.0, 3.4, 1.1, 4), mat(0x3f3a35, { roughness: 0.8 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-14.5, 4.95, -2);
    g.add(roof);

    // 西墙挂画（蒙娜丽莎、星月夜 → 文明对话厅）
    addPainting(g, { x: -12.3, y: 2.35, z: -4.5, ry: Math.PI / 2 }, 2.4, 1.6, "monalisa");
    addPainting(g, { x: -12.3, y: 2.35, z: 0.6, ry: Math.PI / 2 }, 2.4, 1.6, "starrynight");

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

      // 全场景光照
      var ambient = new _g.AmbientLight(0xffffff, 0.42);
      scene.add(ambient);
      var hemi = new _g.HemisphereLight(0xfff4e0, 0x40352a, 0.55);
      scene.add(hemi);
      var sun = new _g.DirectionalLight(0xfff0d8, 1.05);
      sun.position.set(14, 22, 18);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 60;
      scene.add(sun);

      scene.fog = new _g.Fog(0xd9d4c8, 40, 110);
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
