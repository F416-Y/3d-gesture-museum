/* ============================================================
 * 外观布局（由 scripts/vendor-prototype.mjs 自动同步自外观原型）
 * 源文件：tools/exterior-prototype.html —— 请勿手改本文件，改原型后重跑脚本
 * ------------------------------------------------------------
 * 原作者：Kimi 的「江南文人国画博物馆 · 建筑外观布局原型」
 * 坐标约定（与原型一致）：1 单位 = 1 米；x 向东为正，z 向南为正
 * 入口：MuseumExteriorLayout.addLights(scene) / .build(scene) / .slots
 * ============================================================ */
window.MuseumExteriorLayout = (function () {

  /* ---------- 共享上下文 ---------- */
  /* slots：给 glb 真模型接线用的登记表（代码件先建，模型加载成功后替换隐藏） */
  var S = { scene: null, slots: { rock: [], tree: [], bamboo: [], lion: [], ding: [], hall: [] }, anims: [] };
  var M = {};
  /* HALL_DOORS：闭门展厅登记册（靠近弹窗 + 门口拦阻 + 厅内落点），buildHall 闭门时填入；
     挂 window：交互逻辑在另一闭包（闭包乙），跨闭包只走 window 桥 */
  var HALL_DOORS = window.HALL_DOORS = [];
  var WATERS = [];

  /* ---------- 色板 ---------- */
  var PAPER  = 0xEFE9DC;  // 宣纸米白
  var TILE   = 0x484139;  // 深灰瓦
  var CINNAB = 0x8C3B2E;  // 朱砂
  var WOOD   = 0x6D5544;  // 木色
  var LAWN   = 0x70795A;  // 草坪灰绿
  var STONE  = 0xB9B0A0;  // 石材浅灰
  var INK    = 0x1C1A17;  // 墨黑

  function C(hex) {
    if (THREE.ColorManagement && THREE.ColorManagement.legacyMode === false) return new THREE.Color(hex);
    return new THREE.Color(hex).convertSRGBToLinear();
  }

  /* ---------- 二维值噪声 ---------- */
  function makeNoise(seed) {
    var p = new Uint8Array(512), b = [], i, j, t, s = seed >>> 0;
    for (i = 0; i < 256; i++) b[i] = i;
    for (i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      j = s % (i + 1); t = b[i]; b[i] = b[j]; b[j] = t;
    }
    for (i = 0; i < 512; i++) p[i] = b[i & 255];
    function fade(t2) { return t2 * t2 * (3 - 2 * t2); }
    function n2(x, y) {
      var X = Math.floor(x), Y = Math.floor(y);
      var xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
      var aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1];
      var ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
      var u = fade(xf), v = fade(yf);
      var top = aa + (ba - aa) * u, bot = ab + (bb - ab) * u;
      return (top + (bot - top) * v) / 255;
    }
    return n2;
  }
  function fbm(n, x, y, oct) {
    var a = 0, amp = 0.5, f = 1, k;
    for (k = 0; k < (oct || 4); k++) { a += amp * n(x * f, y * f); f *= 2; amp *= 0.5; }
    return a;
  }

  /* ---------- Canvas 程序化贴图 ---------- */
  function canvasTex(size, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (rx) t.repeat.set(rx, ry);
    return t;
  }
  function speckle(ctx, size, n, colors, rMin, rMax, alpha) {
    var i, s = 1234;
    for (i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      var x = (s % 1000) / 1000 * size;
      s = (s * 1664525 + 1013904223) >>> 0;
      var y = (s % 1000) / 1000 * size;
      s = (s * 1664525 + 1013904223) >>> 0;
      var r = rMin + (s % 1000) / 1000 * (rMax - rMin);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 基础几何快捷函数 ---------- */
  function box(w, h, d, mat, x, y, z, ry, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    (parent || S.scene).add(m);
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || S.scene).add(m);
    return m;
  }
  function spread(a, b, gap) {
    var n = Math.max(1, Math.round((b - a) / gap)), arr = [], i;
    for (i = 0; i <= n; i++) arr.push(a + (b - a) * i / n);
    return arr;
  }

  /* ---------- 噪点球（太湖石 / 假山 / 树冠） ---------- */
  function blobGeo(r, amp, sy, seed) {
    var n = makeNoise(seed), W = 18, H = 12;
    var pos = [], idx = [], i, j;
    for (j = 0; j <= H; j++) {
      var v = j / H, phi = v * Math.PI;
      for (i = 0; i <= W; i++) {
        var u = i / W, th = u * Math.PI * 2;
        var d = 1 + (fbm(n, u * 3 + seed, v * 3 + seed * 0.7) - 0.47) * 2 * amp;
        pos.push(r * d * Math.sin(phi) * Math.cos(th),
                 r * d * Math.cos(phi) * sy,
                 r * d * Math.sin(phi) * Math.sin(th));
      }
    }
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
      var a = j * (W + 1) + i, b2 = a + 1, c2 = a + W + 1, d2 = c2 + 1;
      idx.push(a, c2, b2, b2, c2, d2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function rock(x, y, z, r, amp, sy, seed) {
    var m = new THREE.Mesh(blobGeo(r, amp, sy, seed), M.rock);
    m.position.set(x, y, z);
    m.rotation.y = seed * 1.37;
    m.castShadow = m.receiveShadow = true;
    S.scene.add(m);
    S.slots.rock.push({ mesh: m, x: x, y: y, z: z, r: r, sy: sy || 1, seed: seed || 0 });
    return m;
  }

  /* ---------- 空间杆件：任意两点间一根方杆（垂脊 / 戗角用） ---------- */
  function bar3(x0, y0, z0, x1, y1, z1, th, mat, parent) {
    var a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
    var len = a.distanceTo(b);
    if (len < 0.01) return null;
    var m = new THREE.Mesh(new THREE.BoxGeometry(len, th, th), mat);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.sub(a).normalize());
    m.castShadow = m.receiveShadow = true;
    (parent || S.scene).add(m);
    return m;
  }

  /* ---------- 四坡屋顶几何：举折凹曲屋面 + 四角戗角起翘 ----------
     * 坡向按 v^1.7 下凹（脊陡坡缓），四角按 |u|³(1-v)² 起翘；
     * 四个坡面分片构建，戗脊处保持锐利棱线；UV 为公制（repeat 1 = 1m） */
  function hipGeo(w, d, h, up) {
    var hw = w / 2, hd = d / 2, r = Math.max(0.01, (w - d) / 2);
    if (up === undefined) up = Math.min(0.5, 0.14 + Math.max(w, d) * 0.018);
    var NU = 10, NV = 6;
    var slopeLen = Math.sqrt(hd * hd + h * h);
    var pos = [], uv = [], idx = [];
    function surfY(u, v) { return h * Math.pow(v, 1.7) + up * Math.pow(Math.abs(u), 3) * (1 - v) * (1 - v); }
    function patch(fx, flip) {
      var base = pos.length / 3, i, j;
      for (j = 0; j <= NV; j++) {
        var v = j / NV;
        for (i = 0; i <= NU; i++) {
          var u = i / NU * 2 - 1;
          var p = fx(u, v);
          pos.push(p[0], surfY(u, v), p[1]);
          uv.push(p[2], v * slopeLen);
        }
      }
      for (j = 0; j < NV; j++) for (i = 0; i < NU; i++) {
        var a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1;
        if (flip) idx.push(a, b, c, b, e, c);
        else idx.push(a, c, b, b, c, e);
      }
    }
    /* 北坡 / 南坡（梯形：檐口 → 正脊） */
    patch(function (u, v) { return [u * (hw + (r - hw) * v), -hd * (1 - v), u * w / 2 + hw]; }, false);
    patch(function (u, v) { return [u * (hw + (r - hw) * v),  hd * (1 - v), u * w / 2 + hw]; }, true);
    /* 东坡 / 西坡（三角：檐口 → 脊端） */
    patch(function (u, v) { return [ hw * (1 - v) + r * v, u * hd * (1 - v), u * d / 2 + hd + w]; }, false);
    patch(function (u, v) { return [-hw * (1 - v) - r * v, u * hd * (1 - v), u * d / 2 + hd + w]; }, true);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  /* 戗脊线（|u|=1）上 v 处的屋面坐标 */
  function hipPt(sx, sz, v, hw, hd, r, h, up) {
    return [sx * (hw + (r - hw) * v),
            h * Math.pow(v, 1.7) + up * (1 - v) * (1 - v) + 0.05,
            sz * hd * (1 - v)];
  }

  /* ---------- 四坡屋顶组件：凹曲屋面 + 戗角 + 垂脊 + 正脊吻兽 ---------- */
  function hipRoof(w, d, h, x, y, z, parent, clipFly, fly) {
    /* clipFly：±1 时裁掉该侧（局部 z 正/负）两角的「老戗外挑」飞尖——
       贴墙屋顶用，防止戗角尖（檐角外挑 0.55m）穿墙
       fly：戗角外挑距离（默认 0.55；转角亭等贴邻建筑的屋顶可收短，避免与相邻屋面角部相咬） */
    var flyOut = (fly === undefined) ? 0.55 : fly;
    var g = new THREE.Group(); g.position.set(x, y, z); (parent || S.scene).add(g);
    /* 进深大于面阔时自动换向：屋脊永远沿长轴（听荷/观鱼/文创书斋等窄进深厅修正） */
    if (d > w) { var t0 = w; w = d; d = t0; g.rotation.y = Math.PI / 2; }
    var up = Math.min(0.5, 0.14 + Math.max(w, d) * 0.018);
    var roof = new THREE.Mesh(hipGeo(w, d, h, up), M.tile);
    roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    /* 望板内衬：略缩的深色背面壳，檐下仰看为木板底而不是瓦面 */
    var liner = new THREE.Mesh(roof.geometry, M.rafter);
    liner.scale.set(0.985, 0.96, 0.985);
    liner.receiveShadow = true; g.add(liner);
    var ridgeLen = Math.max(0.01, w - d);
    var r = ridgeLen / 2, hw = w / 2, hd = d / 2;
    /* 正脊 + 脊端翘头 */
    box(ridgeLen + 0.9, 0.3, 0.36, M.tile, 0, h + 0.1, 0, 0, g);
    var e1 = box(0.36, 0.7, 0.3, M.tile, -(ridgeLen / 2 + 0.42), h + 0.28, 0, 0, g);
    var e2 = box(0.36, 0.7, 0.3, M.tile,  (ridgeLen / 2 + 0.42), h + 0.28, 0, 0, g);
    e1.rotation.z = 0.55; e2.rotation.z = -0.55;
    /* 吻兽：正脊两端兽首（身 + 翘尾，按细部图高 0.4m 级） */
    var wi, wo;
    for (wi = -1; wi <= 1; wi += 2) {
      wo = box(0.34, 0.5, 0.3, M.ink, wi * (ridgeLen / 2 + 0.42), h + 0.72, 0, 0, g);
      wo.rotation.z = -wi * 0.3;
      box(0.2, 0.26, 0.28, M.ink, wi * (ridgeLen / 2 + 0.28), h + 1.0, 0, 0, g);
    }
    /* 四条垂脊：沿戗脊线分两节贴合凹曲面，檐角外挑老戗上翘 */
    var ks = [[-1, -1], [1, -1], [1, 1], [-1, 1]], k;
    for (k = 0; k < 4; k++) {
      var sx = ks[k][0], sz = ks[k][1];
      var P1 = hipPt(sx, sz, 0.5, hw, hd, r, h, up);
      var P2 = hipPt(sx, sz, 0.98, hw, hd, r, h, up);
      bar3(sx * hw, up + 0.06, sz * hd, P1[0], P1[1], P1[2], 0.16, M.tile, g);
      bar3(P1[0], P1[1], P1[2], P2[0], P2[1], P2[2], 0.16, M.tile, g);
      if (clipFly && sz === clipFly) continue;   /* 贴墙侧不出飞戗，戗角尖不穿墙 */
      bar3(sx * (hw - 0.2), up * 0.85 + 0.06, sz * (hd - 0.2),
           sx * (hw + flyOut), up + 0.4, sz * (hd + flyOut), 0.13, M.tile, g);
    }
    /* 檐口封檐板（四边直线） */
    box(w, 0.1, 0.18, M.ink, 0, 0.02, -d / 2, 0, g);
    box(w, 0.1, 0.18, M.ink, 0, 0.02,  d / 2, 0, g);
    box(0.18, 0.1, d, M.ink, -w / 2, 0.02, 0, 0, g);
    box(0.18, 0.1, d, M.ink,  w / 2, 0.02, 0, 0, g);
    return g;
  }

  /* ---------- 牌匾 ---------- */
  function plaque(text, w, x, y, z, ry, parent) {
    var cw = text.length > 4 ? 512 : 256;
    var c = document.createElement('canvas'); c.width = cw; c.height = 64;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#1C1A17'; ctx.fillRect(0, 0, cw, 64);
    ctx.strokeStyle = '#8C3B2E'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, cw - 10, 54);
    ctx.fillStyle = '#EFE9DC';
    ctx.font = '38px "Songti SC","STSong","SimSun",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, 35);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 64 / cw),
      new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(x, y, z); if (ry) m.rotation.y = ry;
    (parent || S.scene).add(m);
    return m;
  }

  /* ---------- 假窗（外立面棂格窗） ---------- */
  function addWindow(x, y, z, ry, parent) {
    if (window.MuseumWindows && window.MuseumWindows.replace(x, y, z, ry, (parent || S.scene))) return null;
    var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    (parent || S.scene).add(g);
    box(1.5, 1.5, 0.1,  M.ink,   0, 0, 0,    0, g);
    box(1.3, 1.3, 0.12, M.paper, 0, 0, 0.01, 0, g);
    var i;
    for (i = -1; i <= 1; i++) box(0.06, 1.3, 0.14, M.ink, i * 0.43, 0, 0.02, 0, g);
    box(1.3, 0.06, 0.14, M.ink, 0, 0, 0.02, 0, g);
    return g;
  }

  /* ---------- 一段「石基 + 粉墙 + 砖边框 + 瓦压顶」墙 ---------- */
  function wallRun(x0, z0, x1, z1, hBase, hWall) {
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var ry = Math.abs(dz) > Math.abs(dx) ? Math.PI / 2 : 0;
    var hb = hBase || 0.5, hw = hWall || 1.7;
    if (hb > 0.01) box(len, hb, 0.5, M.stone, cx, hb / 2, cz, ry);
    box(len, hw, 0.4,  M.paper, cx, hb + hw / 2, cz, ry);
    box(len, 0.14, 0.46, M.ink, cx, hb + hw - 0.07, cz, ry);
    var capY = hb + hw + 0.08;
    var c1 = box(len, 0.07, 0.42, M.tile, cx, capY, cz, ry);
    var c2 = box(len, 0.07, 0.42, M.tile, cx, capY, cz, ry);
    c1.rotation.order = c2.rotation.order = 'YXZ';
    if (ry) { c1.rotation.x = 0.5; c1.position.x -= 0.14; c2.rotation.x = -0.5; c2.position.x += 0.14; }
    else    { c1.rotation.x = 0.5; c1.position.z -= 0.14; c2.rotation.x = -0.5; c2.position.z += 0.14; }
    box(len, 0.1, 0.12, M.tile, cx, capY + 0.12, cz, ry);
    var pts = spread(-len / 2 + 0.3, len / 2 - 0.3, 5.5), i;
    for (i = 0; i < pts.length; i++) {
      var px = cx + (ry ? 0 : pts[i]), pz = cz + (ry ? pts[i] : 0);
      box(0.5, hb + hw + 0.1, 0.56, M.paper, px, (hb + hw + 0.1) / 2, pz, ry);
      box(0.7, 0.12, 0.76, M.tile, px, hb + hw + 0.16, pz, ry);
    }
  }

  /* ---------- 月洞门（苏州园林正统做法：落地整圆洞径 3.4m、深色砖衬 + 双面砖雕镶边、
       4m 高墙身拔作门楼、小青瓦压顶，与两侧 3.6m 院墙成起伏；
       2026-10-05 扩洞：2.6m→3.4m，圆心 1.8m、洞顶 3.5m，净高不低于前大门门洞（3.4m）） ---------- */
  function moonGate(x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 1.226, z); g.rotation.y = ry; S.scene.add(g);
    /* 带整圆洞的墙身两片（canvas alpha 镂空：圆心 1.7m、半径 1.65m，洞底贴地只留 0.05m 门槛） */
    if (!M.moonWall) {
      var mc = document.createElement('canvas'); mc.width = mc.height = 512;
      var mx = mc.getContext('2d');
      mx.fillStyle = '#ffffff'; mx.fillRect(0, 0, 512, 512);
      mx.fillStyle = '#000000';
      mx.beginPath();
      mx.ellipse(256, 512 - 1.7 / 4.4 * 512, 1.65 / 4.4 * 512, 1.65 / 4.4 * 512, 0, 0, Math.PI * 2);
      mx.fill();
      M.moonWall = new THREE.MeshStandardMaterial({
        color: 0xe9e0c9, roughness: 0.95,
        alphaMap: new THREE.CanvasTexture(mc), alphaTest: 0.5, side: THREE.DoubleSide
      });
    }
    var w1 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), M.moonWall);
    w1.position.set(0, 2.2, -0.22); w1.receiveShadow = true; g.add(w1);
    var w2 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), M.moonWall);
    w2.position.set(0, 2.2, 0.22); w2.receiveShadow = true; g.add(w2);
    /* 洞口深色砖衬（整圆一圈，给洞口 0.44m 厚度） */
    var liningMat = M.ink.clone();
    liningMat.side = THREE.DoubleSide;
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.44, 64, 1, true), liningMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.7, 0);
    ring.castShadow = true;
    g.add(ring);
    /* 双面整圆砖雕镶边（遮住镂空切边，一眼读出圆月轮廓） */
    var trim1 = new THREE.Mesh(new THREE.TorusGeometry(1.71, 0.07, 12, 80), M.ink);
    trim1.position.set(0, 1.7, 0.23); trim1.castShadow = true; g.add(trim1);
    var trim2 = new THREE.Mesh(new THREE.TorusGeometry(1.71, 0.07, 12, 80), M.ink);
    trim2.position.set(0, 1.7, -0.23); trim2.castShadow = true; g.add(trim2);
    /* 整块青石门槛：下缘嵌入铺地，两端接门帮，顶缘倒角便于跨过。 */
    var sillShape = new THREE.Shape();
    sillShape.moveTo(-1.68, -0.025);
    sillShape.lineTo(1.68, -0.025);
    sillShape.lineTo(1.68, 0.14);
    sillShape.lineTo(-1.68, 0.14);
    sillShape.closePath();
    var sillGeo = new THREE.ExtrudeGeometry(sillShape, {
      depth: 0.56, bevelEnabled: true, bevelThickness: 0.025,
      bevelSize: 0.025, bevelSegments: 2, steps: 1
    });
    var sill = new THREE.Mesh(sillGeo, M.stoneDark);
    sill.name = 'moon-gate-stone-threshold';
    sill.position.z = -0.28;
    sill.castShadow = sill.receiveShadow = true;
    g.add(sill);
    /* 两侧墙柱 + 圆洞上方墙身（实体封口，与两侧院墙咬接） */
    box(0.55, 4.4, 0.44, M.paper, -1.925, 2.2, 0, 0, g);
    box(0.55, 4.4, 0.44, M.paper, 1.925, 2.2, 0, 0, g);
    box(4.4, 1.05, 0.44, M.paper, 0, 3.875, 0, 0, g);
    /* 墨线 + 小青瓦压顶 + 正脊 */
    box(4.6, 0.14, 0.56, M.ink, 0, 4.46, 0, 0, g);
    box(4.8, 0.16, 0.72, M.tile, 0, 4.61, 0, 0, g);
    box(4.9, 0.1, 0.14, M.tile, 0, 4.74, 0, 0, g);
    return g;
  }

  /* ---------- 三级马头墙 ---------- */
  function horseHeadWall(x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.scene.add(g);
    var tiers = [ [3.2, 2.6], [2.4, 3.4], [1.6, 4.2] ];
    var i;
    for (i = 0; i < 3; i++) {
      var w = tiers[i][0], top = tiers[i][1];
      box(w, top, 0.4,  M.paper, 0, top / 2, 0, 0, g);
      box(w + 0.14, 0.12, 0.5, M.ink, 0, top - 0.06, 0, 0, g);
      box(w + 0.3, 0.14, 0.66, M.tile, 0, top + 0.08, 0, 0, g);
    }
    box(3.6, 0.5, 0.56, M.stone, 0, 0.25, 0, 0, g);
    return g;
  }

  /* ---------- 一棵树（s≈1 时总高约 3.5m） ---------- */
  function plantTree(x, z, s2, seed, parent) {
    var gp = parent || S.scene;
    var g = new THREE.Group(); gp.add(g);
    cyl(0.14 * s2, 0.2 * s2, 2.2 * s2, 8, M.wood, x, 1.1 * s2, z, g);
    var c1 = new THREE.Mesh(blobGeo(1.5 * s2, 0.22, 0.85, seed), M.leaf);
    c1.position.set(x, 2.8 * s2, z);
    var c2 = new THREE.Mesh(blobGeo(1.0 * s2, 0.25, 0.9, seed + 7), M.leaf);
    c2.position.set(x + 0.7 * s2, 2.1 * s2, z + 0.3 * s2);
    c1.castShadow = c2.castShadow = true;
    c1.receiveShadow = c2.receiveShadow = true;
    g.add(c1); g.add(c2);
    S.slots.tree.push({ group: g, x: x, z: z, s: s2, seed: seed });
  }

  /* ---------- 一丛竹（高 3.0~3.9m，可缩放） ---------- */
  function bambooClump(x, z, seed, parent, sc) {
    var gp = parent || S.scene, s = seed >>> 0, j;
    var g = new THREE.Group(); gp.add(g);
    var k = sc || 1;
    for (j = 0; j < 7; j++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      var ox = ((s % 1000) / 1000 - 0.5) * 0.9 * k;
      s = (s * 1664525 + 1013904223) >>> 0;
      var oz = ((s % 1000) / 1000 - 0.5) * 0.9 * k;
      s = (s * 1664525 + 1013904223) >>> 0;
      var h = (3.0 + (s % 1000) / 1000 * 0.9) * k;
      var stalk = cyl(0.03 * k, 0.04 * k, h, 6, M.bamboo, x + ox, h / 2, z + oz, g);
      stalk.rotation.z = ox * 0.06;
      var l1 = box(0.34 * k, 0.02, 0.08 * k, M.bamboo, x + ox, h - 0.25 * k, z + oz, 0, g);
      var l2 = box(0.3 * k, 0.02, 0.07 * k, M.bamboo, x + ox, h - 0.55 * k, z + oz, 0, g);
      l1.rotation.y = j; l2.rotation.y = j + 1.2;
      l1.castShadow = l2.castShadow = false;
    }
    S.slots.bamboo.push({ group: g, x: x, z: z, k: k, seed: seed });
  }

  /* ---------- 水面与莲叶 ---------- */
  function waterPlane(x, z, w, d, y) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.water);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    S.scene.add(m);
    return m;
  }
  function lotus(x, z, r) {
    var pad = cyl(r, r * 1.08, 0.04, 8, M.leaf, x, 0.13, z);
    pad.castShadow = false;
  }

  /* ---------- 石狮 / 石灯 / 石桌凳 / 条石坐凳 / 陶罐 ---------- */
  /* ---------- 石狮：须弥座 + 蹲狮（通座高约 2.5m，可指定基面高度 y） ---------- */
  function lion(x, z, ry, y) {
    var g = new THREE.Group(); g.position.set(x, y || 0, z); g.rotation.y = ry; S.scene.add(g);
    /* 须弥座：下枋 + 束腰座身 + 上枋（比狮身大一圈，四边各留约 0.2m） */
    box(2.0, 0.14, 2.7, M.stoneDark, 0, 0.07, 0, 0, g);
    box(1.85, 0.5, 2.55, M.stone, 0, 0.39, 0, 0, g);
    box(1.95, 0.12, 2.65, M.stoneDark, 0, 0.7, 0, 0, g);
    var lg = new THREE.Group(); lg.position.y = 0.76; lg.scale.setScalar(1.8); g.add(lg);
    box(1.0, 0.4, 0.62, M.stone, 0, 0.2, 0, 0, lg);
    box(0.62, 0.6, 0.5, M.stoneDark, 0, 0.78, -0.03, 0, lg);
    box(0.44, 0.44, 0.42, M.stoneDark, 0, 1.28, 0.08, 0, lg);
    box(0.1, 0.16, 0.06, M.stoneDark, -0.14, 1.52, 0.08, 0, lg);
    box(0.1, 0.16, 0.06, M.stoneDark, 0.14, 1.52, 0.08, 0, lg);
    var tail = cyl(0.05, 0.07, 0.4, 6, M.stoneDark, 0, 1.05, -0.3, lg);
    tail.rotation.x = 0.5;
    S.slots.lion.push({ group: lg, x: x, y: (y || 0) + 0.76, z: z, ry: ry });
  }
  function lantern(x, z, parent) {
    var g = new THREE.Group(); g.position.set(x, 0, z); (parent || S.scene).add(g);
    box(0.56, 0.22, 0.56, M.stone, 0, 0.11, 0, 0, g);
    cyl(0.09, 0.11, 0.8, 8, M.stone, 0, 0.62, 0, g);
    box(0.42, 0.34, 0.42, M.stoneDark, 0, 1.2, 0, 0, g);
    box(0.24, 0.2, 0.24, M.lampPaper, 0, 1.2, 0, 0, g);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.42, 0.3, 4), M.stone);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(0, 1.52, 0);
    cap.castShadow = true;
    g.add(cap);
    cyl(0.05, 0.05, 0.14, 6, M.stone, 0, 1.74, 0, g);
  }
  function stoneTableSet(x, z, parent) {
    var g = new THREE.Group(); g.position.set(x, 0, z); (parent || S.scene).add(g);
    cyl(0.5, 0.5, 0.08, 12, M.stoneDark, 0, 0.66, 0, g);       // 桌面
    cyl(0.16, 0.2, 0.62, 8, M.stone, 0, 0.31, 0, g);           // 桌腿
    var seats = [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]], i;
    for (i = 0; i < 4; i++) cyl(0.18, 0.2, 0.4, 8, M.stone, seats[i][0], 0.2, seats[i][1], g);
  }
  function stoneBench(x, z, ry, parent) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; (parent || S.scene).add(g);
    box(1.6, 0.12, 0.45, M.wood, 0, 0.44, 0, 0, g);            // 条石坐凳（木面）
    box(0.14, 0.4, 0.4, M.stone, -0.6, 0.2, 0, 0, g);
    box(0.14, 0.4, 0.4, M.stone, 0.6, 0.2, 0, 0, g);
  }
  function potteryJar(x, z, parent) {
    var g = new THREE.Group(); g.position.set(x, 0, z); (parent || S.scene).add(g);
    cyl(0.22, 0.16, 0.5, 10, M.stoneDark, 0, 0.25, 0, g);
    cyl(0.13, 0.13, 0.1, 10, M.ink, 0, 0.55, 0, g);
  }

  /* =====================================================================
   *  通用展厅正房：台基 + 檐柱 + 粉墙棂窗 + 朱砂门 + 四坡瓦顶
   * ===================================================================== */
  function buildHall(cx, cz, w, d, entry, label, opts) {
    var g = new THREE.Group(); S.scene.add(g);
    var platTop = 0.5, wallH = 3.25, wallY0 = platTop + 0.12;
    box(w + 2.4, platTop, d + 2.4, M.stone, cx, platTop / 2, cz, 0, g);
    box(w + 1.6, 0.12, d + 1.6, M.stoneDark, cx, platTop + 0.06, cz, 0, g);
    var inset = 0.7;
    var xs = spread(cx - w / 2 + inset, cx + w / 2 - inset, 3.1);
    var zs = spread(cz - d / 2 + inset, cz + d / 2 - inset, 3.1);
    /* 门洞正中不落柱：有门的那排墙（正门轴线上的前后墙）让开 1.55m */
    var skipX = (entry === 'S' || entry === 'N');
    var i, j;
    for (i = 0; i < xs.length; i++) {
      if (skipX && Math.abs(xs[i] - cx) < 1.55) continue;
      for (j = 0; j < 2; j++) {
        var zc = j === 0 ? cz - d / 2 + inset : cz + d / 2 - inset;
        cyl(0.22, 0.26, 0.18, 8, M.stone, xs[i], platTop + 0.09, zc, g);
        cyl(0.15, 0.17, wallH, 10, M.wood, xs[i], wallY0 + wallH / 2, zc, g);
      }
    }
    for (j = 1; j < zs.length - 1; j++) {
      if (!skipX && Math.abs(zs[j] - cz) < 1.55) continue;
      for (i = 0; i < 2; i++) {
        var xc = i === 0 ? cx - w / 2 + inset : cx + w / 2 - inset;
        cyl(0.22, 0.26, 0.18, 8, M.stone, xc, platTop + 0.09, zs[j], g);
        cyl(0.15, 0.17, wallH, 10, M.wood, xc, wallY0 + wallH / 2, zs[j], g);
      }
    }
    var sides = [
      { key: 'N', ax: 'x', px: cx, pz: cz - d / 2 + 0.12, nx: 0,  nz: -1 },
      { key: 'S', ax: 'x', px: cx, pz: cz + d / 2 - 0.12, nx: 0,  nz: 1 },
      { key: 'W', ax: 'z', px: cx - w / 2 + 0.12, pz: cz, nx: -1, nz: 0 },
      { key: 'E', ax: 'z', px: cx + w / 2 - 0.12, pz: cz, nx: 1,  nz: 0 }
    ];
    var backKey = { N: 'S', S: 'N', E: 'W', W: 'E' }[entry];
    for (i = 0; i < 4; i++) {
      var sd = sides[i];
      var len = sd.ax === 'x' ? w : d;
      var isEntry = (sd.key === entry);
      var isBack = !!(opts && opts.backdoor && sd.key === backKey);   /* 【已停用】全园后门 2026-10-05 撤除，无任何调用点再传 backdoor；分支保留备查 */
      var doorW = isBack ? 1.8 : 2.6, doorH = isBack ? 2.2 : 2.4;
      if (isEntry || isBack) {
        var seg = (len - doorW) / 2;
        if (sd.ax === 'x') {
          box(seg, wallH, 0.24, M.paper, sd.px - (doorW + seg) / 2, wallY0 + wallH / 2, sd.pz, 0, g);
          box(seg, wallH, 0.24, M.paper, sd.px + (doorW + seg) / 2, wallY0 + wallH / 2, sd.pz, 0, g);
          box(doorW, wallH - doorH, 0.24, M.paper, sd.px, wallY0 + doorH + (wallH - doorH) / 2, sd.pz, 0, g);
        } else {
          box(0.24, wallH, seg, M.paper, sd.px, wallY0 + wallH / 2, sd.pz - (doorW + seg) / 2, 0, g);
          box(0.24, wallH, seg, M.paper, sd.px, wallY0 + wallH / 2, sd.pz + (doorW + seg) / 2, 0, g);
          box(0.24, wallH - doorH, doorW, M.paper, sd.px, wallY0 + doorH + (wallH - doorH) / 2, sd.pz, 0, g);
        }
        var ox = sd.px + sd.nx * 0.05, oz = sd.pz + sd.nz * 0.05;
        if (!isEntry) {   /* 后门朱砂双扇·完全敞开（内开 90° 贴帮，门洞全让出，后墙不再堵死）：
                             铰链贴门洞两帮，门扇内旋立于洞内两侧；架排已在中轴 |u|<1.4m 断开，立扇不与陈设相碰 */
          var leafW = (doorW - 0.12) / 2, i2, piv, leaf;
          for (i2 = -1; i2 <= 1; i2 += 2) {
            piv = new THREE.Group();
            if (sd.ax === 'x') piv.position.set(sd.px + i2 * (doorW / 2 - 0.06), wallY0, oz);
            else piv.position.set(ox, wallY0, sd.pz + i2 * (doorW / 2 - 0.06));
            g.add(piv);
            leaf = (sd.ax === 'x')
              ? box(leafW, doorH, 0.08, M.door, -i2 * leafW / 2, doorH / 2, 0, 0, piv)
              : box(0.08, doorH, leafW, M.door, 0, doorH / 2, -i2 * leafW / 2, 0, piv);
            leaf.castShadow = false;
            piv.rotation.y = sd.ax === 'x' ? -i2 * sd.nz * Math.PI / 2 : i2 * sd.nx * Math.PI / 2;
          }
        }
        if (isEntry && opts && opts.closedDoor) {
          /* 闭门展厅：朱砂双扇紧闭（嵌入门洞与墙面齐平），墨黑横档 + 鎏金铺首环；
             并登记门位表（靠近弹窗 / 门口拦阻 / 厅内落点朝向） */
          var cLW = doorW / 2 - 0.03, i3, lfx, lfz, ring;
          for (i3 = -1; i3 <= 1; i3 += 2) {
            if (sd.ax === 'x') {
              lfx = sd.px + i3 * (cLW / 2 + 0.015); lfz = sd.pz;
              box(cLW, doorH, 0.1, M.door, lfx, wallY0 + doorH / 2, lfz, 0, g);
              box(cLW - 0.14, 0.1, 0.12, M.ink, lfx, wallY0 + 0.5, lfz, 0, g);
              box(cLW - 0.14, 0.1, 0.12, M.ink, lfx, wallY0 + doorH - 0.5, lfz, 0, g);
              ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 14), M.brass);
              ring.position.set(sd.px + i3 * 0.2, wallY0 + 1.2, sd.pz + sd.nz * 0.08);
              g.add(ring);
            } else {
              lfx = sd.px; lfz = sd.pz + i3 * (cLW / 2 + 0.015);
              box(0.1, doorH, cLW, M.door, lfx, wallY0 + doorH / 2, lfz, 0, g);
              box(0.12, 0.1, cLW - 0.14, M.ink, lfx, wallY0 + 0.5, lfz, 0, g);
              box(0.12, 0.1, cLW - 0.14, M.ink, lfx, wallY0 + doorH - 0.5, lfz, 0, g);
              ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 14), M.brass);
              ring.rotation.y = Math.PI / 2;
              ring.position.set(sd.px + sd.nx * 0.08, wallY0 + 1.2, sd.pz + i3 * 0.2);
              g.add(ring);
            }
          }
          /* 门槛石（门下沿贴台基顶，压住扇脚） */
          if (sd.ax === 'x') box(doorW, 0.1, 0.3, M.stoneDark, sd.px, wallY0 + 0.05, sd.pz, 0, g);
          else               box(0.3, 0.1, doorW, M.stoneDark, sd.px, wallY0 + 0.05, sd.pz, 0, g);
          HALL_DOORS.push({
            tag: (opts && opts.tag) || label || '展厅',
            x: sd.px, z: sd.pz, nx: sd.nx, nz: sd.nz, tx: -sd.nz, tz: sd.nx, w: doorW,
            sx: sd.px - sd.nx * 2.2, sz: sd.pz - sd.nz * 2.2,
            syaw: Math.atan2(sd.nx, sd.nz)
          });
        }
        /* 展厅门洞一律敞口（不装门扇，与序厅小门做法统一）：只留门外石台/踏跺 */
        if (sd.ax === 'x') {
          box(doorW + 0.8, 0.24, 1.0, M.stone, sd.px, 0.36, sd.pz + sd.nz * 0.9, 0, g);
          box(doorW + 0.8, 0.24, 0.6, M.stone, sd.px, 0.12, sd.pz + sd.nz * 1.35, 0, g);
          if (isEntry) {   /* 正门两侧灌木球收边 */
            shrub(sd.px - doorW / 2 - 1.1, sd.pz + sd.nz * 1.5, 0.5, 300 + i * 7);
            shrub(sd.px + doorW / 2 + 1.1, sd.pz + sd.nz * 1.5, 0.5, 301 + i * 7);
          }
        } else {
          box(1.0, 0.24, doorW + 0.8, M.stone, sd.px + sd.nx * 0.9, 0.36, sd.pz, 0, g);
          box(0.6, 0.24, doorW + 0.8, M.stone, sd.px + sd.nx * 1.35, 0.12, sd.pz, 0, g);
          if (isEntry) {   /* 正门两侧灌木球收边 */
            shrub(sd.px + sd.nx * 1.5, sd.pz - doorW / 2 - 1.1, 0.5, 302 + i * 7);
            shrub(sd.px + sd.nx * 1.5, sd.pz + doorW / 2 + 1.1, 0.5, 303 + i * 7);
          }
        }
        if (label && isEntry) {
          plaque(label, 1.9,
            sd.px + sd.nx * 0.35, wallY0 + doorH + 0.32, sd.pz + sd.nz * 0.35,
            sd.ax === 'x' ? (sd.nz > 0 ? 0 : Math.PI) : (sd.nx > 0 ? Math.PI / 2 : -Math.PI / 2), g);
        }
      } else {
        if (sd.ax === 'x') box(len, wallH, 0.24, M.paper, sd.px, wallY0 + wallH / 2, sd.pz, 0, g);
        else               box(0.24, wallH, len, M.paper, sd.px, wallY0 + wallH / 2, sd.pz, 0, g);
      }
      if (sd.ax === 'x') box(len, 0.16, 0.3, M.ink, sd.px, wallY0 + wallH - 0.08, sd.pz, 0, g);
      else               box(0.3, 0.16, len, M.ink, sd.px, wallY0 + wallH - 0.08, sd.pz, 0, g);
      var wpts = spread(-len / 2 + 1.4, len / 2 - 1.4, 3.2);
      for (j = 0; j < wpts.length; j++) {
        if ((isEntry || isBack) && Math.abs(wpts[j]) < doorW / 2 + 1.0) continue;
        var wx = sd.ax === 'x' ? sd.px + wpts[j] : sd.px + sd.nx * 0.16;
        var wz = sd.ax === 'x' ? sd.pz + sd.nz * 0.16 : sd.pz + wpts[j];
        var wry = sd.ax === 'x' ? (sd.nz > 0 ? 0 : Math.PI) : (sd.nx > 0 ? Math.PI / 2 : -Math.PI / 2);
        addWindow(wx, wallY0 + 1.55, wz, wry, g);
      }
    }
    var beamY = wallY0 + wallH + 0.17;
    box(w + 0.6, 0.34, 0.26, M.wood, cx, beamY, cz - d / 2 + inset, 0, g);
    box(w + 0.6, 0.34, 0.26, M.wood, cx, beamY, cz + d / 2 - inset, 0, g);
    box(0.26, 0.34, d + 0.6, M.wood, cx - w / 2 + inset, beamY, cz, 0, g);
    box(0.26, 0.34, d + 0.6, M.wood, cx + w / 2 - inset, beamY, cz, 0, g);
    if (opts && opts.chongyan) {
      hipRoof(w + 5.0, d + 5.0, 1.1, cx, beamY - 0.75, cz, g);
    }
    var rw = w + 3.4, rd = d + 3.4;
    var rh = Math.min(Math.max(rw, rd) * 0.24, 4.4);
    hipRoof(rw, rd, rh, cx, beamY + 0.2, cz, g);
    /* 登记厅堂槽位：供室内陈设自动布展（位置 / 面阔进深 / 朝向 / 馆名） */
    S.slots.hall.push({ cx: cx, cz: cz, w: w, d: d, entry: entry, tag: (opts && opts.tag) || label || '' });
    return g;
  }

  /* ---------- 入口门楼（院墙上的大门：门柱 + 顶檐 + 朱砂门 + 台阶 + 匾） ---------- */
  function gateHouse(side, cx, cz, x0, x1, z0, z1, gateW, label) {
    var gx, gz, ry;
    if (side === 'S') { gx = cx; gz = z1; ry = 0; }
    if (side === 'N') { gx = cx; gz = z0; ry = Math.PI; }
    if (side === 'E') { gx = x1; gz = cz; ry = Math.PI / 2; }
    if (side === 'W') { gx = x0; gz = cz; ry = -Math.PI / 2; }
    var g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; S.scene.add(g);
    /* 门柱两根（0.7m 见方，3.2m 高） */
    var off = gateW / 2 + 0.35;
    box(0.7, 3.2, 0.7, M.stone, -off, 1.6, 0, 0, g);
    box(0.7, 3.2, 0.7, M.stone, off, 1.6, 0, 0, g);
    /* 门额墙 + 顶檐：保留原门楼高度，连廊檐口与此齐平 */
    box(gateW + 1.4, 0.9, 0.44, M.paper, 0, 3.55, 0, 0, g);
    box(gateW + 1.6, 0.12, 0.5, M.ink, 0, 3.96, 0, 0, g);
    hipRoof(gateW + 2.2, 1.8, 0.85, 0, 4.1, 0, g);
    /* 朱砂双扇门·完全敞开（内开 90° 立于门洞两侧，门洞全让出）：只有挂匾的正式院门才装门扇；
       后门/侧门小门楼一律敞口（与展厅门洞统一）。铰链 z=-0.05 略收进洞内，让开前侧抱鼓石；
       装扇院门撤内侧抱鼓石一对（让开门扇内旋立扇位置） */
    if (label) {
      var LW = gateW / 2 - 0.08, i2, piv, leaf;
      for (i2 = -1; i2 <= 1; i2 += 2) {
        piv = new THREE.Group(); piv.position.set(i2 * (gateW / 2 - 0.07), 0, -0.05); g.add(piv);
        leaf = box(LW, 2.4, 0.08, M.door, -i2 * LW / 2, 1.2, 0, 0, piv);
        leaf.castShadow = false;
        piv.rotation.y = -i2 * Math.PI / 2;
      }
    }
    /* 雀替（门柱顶部贴脸小斗） */
    var q1 = box(0.5, 0.34, 0.12, M.wood, -off + 0.3, 2.92, 0.28, 0, g);
    q1.rotation.z = 0.5;
    var q2 = box(0.5, 0.34, 0.12, M.wood, off - 0.3, 2.92, 0.28, 0, g);
    q2.rotation.z = -0.5;
    /* 挂落（柱间镂空木板） */
    box(gateW - 0.3, 0.34, 0.05, M.gualuo, 0, 2.9, 0.24, 0, g);
    /* 抱鼓石（门枕，前后各一）：须弥座 + 大鼓，鼓径随门面宽度（0.43~0.6m） */
    function drum(px, pz) {
      var dr = Math.min(0.6, 0.3 + gateW * 0.07);
      box(dr * 2 + 0.18, 0.32, dr * 2 + 0.18, M.stone, px, 0.16, pz, 0, g);
      var d = new THREE.Mesh(new THREE.CylinderGeometry(dr, dr, 0.2 + dr * 0.14, 20), M.stone);
      d.rotation.x = Math.PI / 2;
      d.position.set(px, 0.36 + dr, pz);
      d.castShadow = d.receiveShadow = true;
      g.add(d);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(dr * 0.32, 10, 8), M.stoneDark);
      cap.position.set(px, 0.36 + dr * 2 + dr * 0.1, pz);
      cap.castShadow = cap.receiveShadow = true;
      g.add(cap);
    }
    drum(-off, 0.62); drum(off, 0.62);
    if (!label) { drum(-off, -0.62); drum(off, -0.62); }   /* 装扇院门内鼓撤除（让开内旋立扇）；敞口小门楼前后鼓保留 */
    /* 门前两级台阶（朝外） */
    box(gateW + 1.2, 0.24, 0.9, M.stone, 0, 0.24, 0.75, 0, g);
    box(gateW + 1.2, 0.14, 0.5, M.stone, 0, 0.07, 1.35, 0, g);
    /* 门匾 */
    if (label) plaque(label, 1.7, 0, 3.5, 0.3, 0, g);
    /* 檐口红灯笼一对 */
    redLantern(-(gateW / 2 + 0.1), 3.88, 0.38, g);
    redLantern(gateW / 2 + 0.1, 3.88, 0.38, g);
    return g;
  }

  /* =====================================================================
   *  院落单元：围墙一圈 + 入口门楼 + 内院铺装 + 后部正房 + 树石点缀
   *  entry 为门楼朝向（'S'/'N'/'E'/'W'）
   * ===================================================================== */
  function buildCourtComplex(cx, cz, w, d, entry, label, opts) {
    opts = opts || {};
    if (label) opts.tag = label;
    var wallH = opts.wallH || 2.8;
    var gateW = opts.gateW || 3.0;
    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    var k, runs = {
      N: [x0, z0, x1, z0], S: [x0, z1, x1, z1],
      W: [x0, z0, x0, z1], E: [x1, z0, x1, z1]
    };
    for (k in runs) {
      var r = runs[k];
      if (k === entry) {
        if (k === 'N' || k === 'S') {
          fenceRun(r[0], r[1], cx - gateW / 2 - 0.7, r[1]);
          fenceRun(cx + gateW / 2 + 0.7, r[1], r[2], r[1]);
        } else {
          fenceRun(r[0], r[1], r[0], cz - gateW / 2 - 0.7);
          fenceRun(r[0], cz + gateW / 2 + 0.7, r[0], r[3]);
        }
        gateHouse(k, cx, cz, x0, x1, z0, z1, gateW, label);
      } else if (opts.backdoor && k === { N: 'S', S: 'N', E: 'W', W: 'E' }[entry]) {   /* 【已停用】后门小门楼随全园后门一并撤除 */
        /* 后门：后墙留 1.8m 门洞 + 小门楼（无匾） */
        if (k === 'N' || k === 'S') {
          fenceRun(r[0], r[1], cx - 0.9 - 0.35, r[1]);
          fenceRun(cx + 0.9 + 0.35, r[1], r[2], r[1]);
        } else {
          fenceRun(r[0], r[1], r[0], cz - 0.9 - 0.35);
          fenceRun(r[0], cz + 0.9 + 0.35, r[0], r[3]);
        }
        gateHouse(k, cx, cz, x0, x1, z0, z1, 1.8, null);
      } else if (opts.sideDoors && opts.sideDoors[k] !== undefined) {
        /* 侧门（对齐游廊端头）：围栏留 1.8m 门洞 + 小门楼（无匾），做法同后门 */
        var at = opts.sideDoors[k];
        if (k === 'N' || k === 'S') {
          fenceRun(r[0], r[1], at - 1.25, r[1]);
          fenceRun(at + 1.25, r[1], r[2], r[1]);
          gateHouse(k, at, cz, x0, x1, z0, z1, 1.8, null);
        } else {
          fenceRun(r[0], r[1], r[0], at - 1.25);
          fenceRun(r[0], at + 1.25, r[0], r[3]);
          gateHouse(k, cx, at, x0, x1, z0, z1, 1.8, null);
        }
      } else {
        fenceRun(r[0], r[1], r[2], r[3]);
      }
    }
    /* 内院青石铺装 */
    var g = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, d - 0.8), M.gravel);
    g.rotation.x = -Math.PI / 2; g.position.set(cx, 0.045, cz); g.receiveShadow = true;
    S.scene.add(g);
    /* 后部正房（面朝门楼）：贴后围栏 0.9m、两侧各留 1.1m，展厅尽量做大 */
    var hh = opts.hallD || 5;
    if (entry === 'S' || entry === 'N') {
      var hcz = entry === 'S' ? z0 + 0.9 + hh / 2 : z1 - 0.9 - hh / 2;
      buildHall(cx, hcz, w - 2.2, hh, entry, null, opts);
    } else {
      var hcx = entry === 'E' ? x0 + 0.9 + hh / 2 : x1 - 0.9 - hh / 2;
      buildHall(hcx, cz, hh, d - 2.2, entry, null, opts);
    }
    /* 背墙立轴：书斋/茶室/文创/临摹 各 2 幅（面朝院内，画心中心 y=1.5） */
    var _sc = { '书斋': [601, 602], '茶室': [603, 604], '文创': [605, 606], '临摹': [607, 608] }[opts.tag];
    if (_sc) {
      var _fd = (entry === 'W') ? -1 : 1;
      var _bw = (entry === 'W') ? (x1 - 0.9 - 0.12) : (x0 + 0.9 + 0.12);
      var _si;
      for (_si = 0; _si < 2; _si++) hangingScroll(_bw + _fd * 0.14, cz + (_si ? 2.5 : -2.5), _fd, _sc[_si]);
    }
    /* 院内树石 */
    var t = opts.treeScale || 0.9;
    if (entry === 'S' || entry === 'N') {
      plantTree(cx - w / 2 + 2.2, cz + (entry === 'S' ? 1 : -1) * (d / 4), t, 800 + w, S.scene);
      rock(cx + w / 2 - 2.2, 0.12, cz + (entry === 'S' ? 1 : -1) * (d / 4), 0.55, 0.4, 0.9, 810 + w);
    } else {
      plantTree(cx + (entry === 'E' ? 1 : -1) * (w / 4), cz - d / 2 + 2.2, t, 820 + w, S.scene);
      rock(cx + (entry === 'E' ? 1 : -1) * (w / 4), 0.12, cz + d / 2 - 2.2, 0.55, 0.4, 0.9, 830 + w);
    }
    /* 门楼内侧灌木对（柔化门柱基脚） */
    if (entry === 'S' || entry === 'N') {
      var gzI = entry === 'S' ? z1 - 1.7 : z0 + 1.7;
      shrub(cx - gateW / 2 - 1.4, gzI, 0.55, 700 + w);
      shrub(cx + gateW / 2 + 1.4, gzI, 0.55, 701 + w);
    } else {
      var gxI = entry === 'E' ? x1 - 1.7 : x0 + 1.7;
      shrub(gxI, cz - gateW / 2 - 1.4, 0.55, 702 + w);
      shrub(gxI, cz + gateW / 2 + 1.4, 0.55, 703 + w);
    }
  }

  /* =====================================================================
   *  区域构建函数（按官方总平面 + 细分参考图尺寸落位）
   * ===================================================================== */

  /* ---------- 外墙一周（北墙 z=-40 一线直墙——原中央 13m 外凸北门楼已整体拆除； ---------- *
   * ---------- 南墙中央内凹两级形成主入口外广场，x ±50 / z ±40 为外包络） ---------- */
  function buildBoundary() {
    /* 西墙、东墙：直墙 */
    wallRun(-50, -40, -50, 40);
    wallRun(50, -40, 50, 40);
    /* 北墙：一线直墙 z=-40（北门楼已整体拆除，中央 13m 外凸部随之取消） */
    wallRun(-50, -40, 50, -40);
    /* 南墙：角段 z=40（x ±26~±50）→ 内折 → 中段 z=36（x ±11~±26）→ 内折，中央 x±11 开口（序厅大门） */
    wallRun(26, 40, 50, 40);
    wallRun(26, 40, 26, 36);
    wallRun(26, 36, 11, 36);
    wallRun(11, 36, 11, 34.8);
    wallRun(-11, 34.8, -11, 36);
    wallRun(-11, 36, -26, 36);
    wallRun(-26, 36, -26, 40);
    wallRun(-26, 40, -50, 40);
    /* 入口两翼马头墙墩 */
    horseHeadWall(-11.6, 39.6, 0);
    horseHeadWall(11.6, 39.6, 0);
    /* 北墙原凸部两侧的马头墙墩（±7.2, -40）随北门楼一并撤除 */
  }

  /* ---------- 南入口（墙外）：六级大台阶从序厅门脸 z34.5 向南下 + 石狮 + 石灯 + 石板路 ---------- */
  function buildSouthEntry() {
    var i;
    for (i = 0; i < 6; i++) {
      /* 顶级与台基前缘齐平咬接（34.48~34.92），级级相叠 0.08，不留断缝 */
      box(14, 0.2, 0.44, M.stone, 0, 1.1 - i * 0.2, 34.7 + i * 0.36);
    }
    var z = 37.0;
    while (z < 47.5) {
      box(4.6, 0.1, 1.1, (Math.round(z * 10) % 2 === 0) ? M.stone : M.stoneDark, 0, 0.05, z + 0.55);
      z += 1.15;
    }
    /* 石狮守大门外：大台阶下两端、石板路入口两侧，地面座落，面朝南迎客（加大版） */
    lion(-5.9, 37.6, 0.15, 0);
    lion(5.9, 37.6, -0.15, 0);
    lantern(-3.4, 40.2); lantern(3.4, 40.2);
    lantern(-3.4, 44.6); lantern(3.4, 44.6);
  }

  /* ---------- 序厅组（14m 中院 + 左右各 4m 侧院，总宽 22m，高台 1.2m） ---------- */
  function buildXuting() {
    var g = new THREE.Group(); S.scene.add(g);
    /* 高台基：x -11~11, z 24.5~34.5 */
    box(22.6, 1.2, 10, M.stone, 0, 0.6, 29.5, 0, g);
    var pave = new THREE.Mesh(new THREE.PlaneGeometry(22, 9.68), M.plaza);
    pave.rotation.x = -Math.PI / 2;
    /* 北缘延至 34.48 与顶级踏步（34.48~34.92）咬接：门洞地面连续，不再露出低 0.026 的台基条带 */
    pave.position.set(0, 1.226, 29.64);
    pave.receiveShadow = true;
    g.add(pave);
    /* 前大门组件（z = 34.5，14m 宽 5m 高） */
    box(5.4, 5, 0.5, M.paper, -4.4, 1.2 + 2.5, 34.5, 0, g);
    box(5.4, 5, 0.5, M.paper, 4.4, 1.2 + 2.5, 34.5, 0, g);
    box(1.0, 5, 1.0, M.stone, -2.3, 1.2 + 2.5, 34.5, 0, g);
    box(1.0, 5, 1.0, M.stone, 2.3, 1.2 + 2.5, 34.5, 0, g);
    box(3.6, 1.6, 0.5, M.paper, 0, 1.2 + 4.2, 34.5, 0, g);
    box(13.6, 0.16, 0.6, M.ink, 0, 1.2 + 4.95, 34.5, 0, g);
    /* 大门顶面阔收至 14.0m（与门房墙两端齐）：东/西戗角尖端缩到 ±7.55，
       与两侧阙楼顶（檐缘 ±8.2）之间留出 0.65m 净缝，任何角度不再相切相穿 */
    hipRoof(14.0, 2.6, 1.1, 0, 1.2 + 5.1, 34.5, g);
    /* 朱砂双扇门·完全敞开（内开 90° 贴帮）：3.4m 门洞全让出，街面视线直抵青铜鼎；
       门扇绕两帮铰链内旋立于门洞两侧（扇面南缘 z=34.42，与抱鼓石 z 向净距 0.8m），
       每扇完整呈现竖板缝、抹头、门钉与铺首衔环（敞开后面朝院内） */
    (function () {
      function knocker(leaf, sx) {
        var boss = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.035, 16), M.brass);
        boss.rotation.x = Math.PI / 2; boss.position.set(sx, -0.15, 0.07);
        boss.castShadow = true; leaf.add(boss);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.014, 8, 22), M.brass);
        ring.position.set(sx, -0.29, 0.075); ring.castShadow = true; leaf.add(ring);
      }
      var i2, piv, leaf;
      for (i2 = -1; i2 <= 1; i2 += 2) {
        piv = new THREE.Group(); piv.position.set(i2 * 1.63, 1.2, 34.42); g.add(piv);
        leaf = box(1.7, 3.4, 0.1, M.door, -i2 * 0.85, 1.7, 0, 0, piv);
        knocker(leaf, -i2 * 0.58);
        piv.rotation.y = -i2 * Math.PI / 2;
      }
    })();
    /* 门洞两帮镶深色木门框（贴帮立梃，盖住白墙断面，门扇铰链贴其内角） */
    box(0.07, 3.5, 0.52, M.wood, -1.735, 1.2 + 1.75, 34.5, 0, g);
    box(0.07, 3.5, 0.52, M.wood,  1.735, 1.2 + 1.75, 34.5, 0, g);
    /* 匾挂在门额枋正面（抱厦屋顶之上、主顶檐口之下），不被任何构件遮挡 */
    plaque('云间入墨', 4.6, 0, 1.2 + 4.95, 34.9, 0, g);
    /* 门内抱厦（北侧院内：贴墙北皮双柱卷棚小顶，构成重檐入口）；
       屋顶中心 z=33.15（南缘 34.35 仅嵌入墙皮 0.1，不穿墙），双柱 z=32.35 正对檐下，
       柱加高至 3.8m，额枋 5.05m 嵌入屋面底——柱、枋、顶三者相接无缝 */
    cyl(0.2, 0.24, 0.16, 8, M.stone, -1.9, 1.2 + 0.08, 32.35, g);
    cyl(0.2, 0.24, 0.16, 8, M.stone,  1.9, 1.2 + 0.08, 32.35, g);
    cyl(0.14, 0.17, 3.8, 10, M.wood, -1.9, 1.2 + 1.9, 32.35, g);
    cyl(0.14, 0.17, 3.8, 10, M.wood,  1.9, 1.2 + 1.9, 32.35, g);
    box(4.8, 0.26, 0.26, M.wood, 0, 1.2 + 3.85, 32.35, 0, g);
    box(4.4, 0.3, 0.05, M.gualuo, 0, 1.2 + 3.58, 32.45, 0, g);
    hipRoof(5.4, 2.4, 0.85, 0, 1.2 + 3.55, 33.15, g, 1);   /* 南侧贴墙，裁掉南两角飞戗 */
    /* 大门两侧抱鼓石（门枕）：须弥座 + 大鼓 + 鼓顶圆珠，三级相切，整组落在第三级台阶上（z=35.42）。
       置于门柱前下方夹峙台阶——大敞门扇内旋贴帮（扇面南缘 z=34.42、x ±1.58~1.68），
       与鼓（z 35.22 起）z 向净距 0.8m，与墙/柱/门扇均不穿模，鼓面正南朝街见整圆 */
    box(0.9, 0.6, 0.4, M.stone, -2.3, 1.1, 35.42, 0, g);
    box(0.9, 0.6, 0.4, M.stone,  2.3, 1.1, 35.42, 0, g);
    var dr1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.26, 24), M.stone);
    dr1.rotation.x = Math.PI / 2; dr1.position.set(-2.3, 2.02, 35.42);
    dr1.castShadow = dr1.receiveShadow = true; g.add(dr1);
    var dr2 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.26, 24), M.stone);
    dr2.rotation.x = Math.PI / 2; dr2.position.set(2.3, 2.02, 35.42);
    dr2.castShadow = dr2.receiveShadow = true; g.add(dr2);
    var dc1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.stoneDark);
    dc1.position.set(-2.3, 2.84, 35.42); dc1.castShadow = true; g.add(dc1);
    var dc2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.stoneDark);
    dc2.position.set(2.3, 2.84, 35.42); dc2.castShadow = true; g.add(dc2);
    /* 大门檐口红灯笼一对（匾两侧） */
    redLantern(-3.1, 1.2 + 4.75, 34.85, g);
    redLantern(3.1, 1.2 + 4.75, 34.85, g);
    /* 照壁已迁至地面层中轴南院（z=20.2，见 buildAxisCourt）：四合院影壁正统位置是庭院入口的独立影壁，
       不再堵在台基北缘；中院北面就此敞开，视线直透水榭庭院，人从台基北缘中央大踏跺下院绕行影壁两侧 */
    /* 中院侧墙月洞门与廊门、游廊同轴：东门 z=26.5 对东廊门/东游廊，西门 z=28.5 对西廊门/西游廊，
       每侧一条直线：游廊 → 廊门 → 侧院 → 月洞门 → 中院；
       留空随洞径 3.4m 加宽到 ±1.95m（东门 24.55~28.45、西门 26.55~30.45），镶边圆环不与墙头相切 */
    wallRun(-7.25, 24.5, -7.25, 26.55, 0, 3.6);
    wallRun(-7.25, 30.45, -7.25, 34.5, 0, 3.6);
    wallRun(7.25, 24.5, 7.25, 24.55, 0, 3.6);
    wallRun(7.25, 28.45, 7.25, 34.5, 0, 3.6);
    moonGate(-7.25, 28.5, Math.PI / 2);
    moonGate(7.25, 26.5, Math.PI / 2);
    /* 左右侧院改透空围栏（各 4m 宽）+ 西南/东南角阙楼；
       东栏 z=26.5、西栏 z=28.5 各留 1.8m 廊门，与两条南花园游廊、两侧月洞门同轴对齐 */
    fenceRun(11.25, 24.5, 11.25, 25.25);
    fenceRun(11.25, 27.75, 11.25, 34.5);
    gateHouse('E', 0, 26.5, 0, 11.25, 0, 0, 1.8, null);
    fenceRun(-11.25, 24.5, -11.25, 27.25);
    fenceRun(-11.25, 29.75, -11.25, 34.5);
    gateHouse('W', 0, 28.5, -11.25, 0, 0, 0, 1.8, null);
    /* 廊门外侧踏跺：游廊在地面（y=0），侧院在高台（y=1.2），
       门外廊内各设四步石阶（步高 0.3m）登台入门 */
    var ti;
    for (ti = 0; ti < 4; ti++) {
      box(0.28, 0.3 * (ti + 1), 2.0, M.stone,  12.35 - 0.28 * ti, 0.15 * (ti + 1), 26.5);
      box(0.28, 0.3 * (ti + 1), 2.0, M.stone, -12.35 + 0.28 * ti, 0.15 * (ti + 1), 28.5);
    }
    /* 台基北缘中央大踏跺：五步（步高 0.24m）下中轴南院，两侧垂带石；
       落地即见影壁（z=20.2），绕其两侧入双廊、水榭庭院——轴线动线就此打通 */
    for (ti = 0; ti < 5; ti++) {
      var hh = 1.2 - 0.24 * ti, tz = 24.5 - 0.28 - 0.56 * ti;
      box(5.0, hh, 0.56, M.stone, 0, hh / 2, tz);
      box(0.34, hh + 0.1, 0.56, M.stoneDark, -2.67, (hh + 0.1) / 2, tz);
      box(0.34, hh + 0.1, 0.56, M.stoneDark, 2.67, (hh + 0.1) / 2, tz);
    }
    /* 台基北缘寻杖栏杆：望柱 + 栏板 + 木寻杖，中央留 5.2m 踏跺口（凭栏北望中轴南院） */
    (function () {
      var runs = [[-11, -2.6], [2.6, 11]], ri, i;
      for (ri = 0; ri < 2; ri++) {
        var x0 = runs[ri][0], x1 = runs[ri][1], len = x1 - x0, n = Math.round(len / 1.4);
        for (i = 0; i <= n; i++) {
          var px = x0 + len * i / n;
          cyl(0.07, 0.09, 0.85, 8, M.stone, px, 1.2 + 0.425, 24.62);
          var cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.stoneDark);
          cap.position.set(px, 1.2 + 0.9, 24.62); cap.castShadow = true; S.scene.add(cap);
        }
        box(len, 0.34, 0.06, M.paper, (x0 + x1) / 2, 1.2 + 0.42, 24.62);
        box(len, 0.09, 0.12, M.wood, (x0 + x1) / 2, 1.2 + 0.82, 24.62);
        box(len, 0.08, 0.12, M.stone, (x0 + x1) / 2, 1.2 + 0.05, 24.62);
      }
    })();
    /* 南侧阙楼一对：侧院墙改围栏后加四柱落地成亭（柱础在台基面 y1.2 起）；
       北移至 z=33.0：屋顶南缘 34.3，让开前墙（z=34.5，高 6.2m）不穿插；
       外移至 ±9.5（檐缘 ±8.2），与收窄后的大门顶戗尖（±7.55）净距 0.65m */
    var qx = [-9.5, 9.5], qo = [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]], qi, qb;
    for (qi = 0; qi < 2; qi++) {
      hipRoof(2.6, 2.6, 1.2, qx[qi], 4.9, 33.0, g);
      for (qb = 0; qb < 4; qb++) {
        cyl(0.2, 0.24, 0.14, 8, M.stone, qx[qi] + qo[qb][0], 1.27, 33.0 + qo[qb][1], g);
        cyl(0.11, 0.13, 3.6, 8, M.wood, qx[qi] + qo[qb][0], 3.07, 33.0 + qo[qb][1], g);
      }
    }
    /* 侧院南墙封口 + 正立面两端三级马头墙（按正立面图两翼跌落） */
    wallRun(-11.25, 34.5, -7.25, 34.5, 0, 3.4);
    wallRun(7.25, 34.5, 11.25, 34.5, 0, 3.4);
    horseHeadWall(-9.25, 34.82, 0);
    horseHeadWall(9.25, 34.82, 0);
    /* 棂格花窗：大门两侧门房墙各一樘（面南迎客，高度与匾下沿齐），
       中院两侧高墙各两樘（面朝侧院，与月洞门、廊门成景） */
    addWindow(-4.4, 3.6, 34.76, 0, g);
    addWindow(4.4, 3.6, 34.76, 0, g);
    addWindow(-7.44, 2.3, 31.5, -Math.PI / 2);
    addWindow(-7.44, 2.3, 33.3, -Math.PI / 2);
    addWindow(7.44, 2.3, 29.5, Math.PI / 2);
    addWindow(7.44, 2.3, 32.5, Math.PI / 2);
    /* 中庭铜鼎：3m 见方石座 + 三足两耳大鼎（通高约 2.4m）；向序厅内侧退 2.5m，远离正门 */
    var dingZ = 27.0;
    box(3, 0.5, 3, M.stoneDark, 0, 1.2 + 0.25, dingZ, 0, g);
    var dingY = 1.2 + 0.5, legA;
    var dingG = new THREE.Group(); g.add(dingG);
    for (legA = 0; legA < 3; legA++) {
      var la = legA * 2.094;
      cyl(0.09, 0.12, 0.7, 8, M.ink, Math.cos(la) * 0.55, dingY + 0.35, dingZ + Math.sin(la) * 0.55, dingG);
    }
    cyl(0.95, 0.75, 1.0, 16, M.ink, 0, dingY + 1.15, dingZ, dingG);
    cyl(1.02, 1.02, 0.16, 16, M.ink, 0, dingY + 1.72, dingZ, dingG);
    box(0.14, 0.5, 0.3, M.ink, -0.6, dingY + 2.0, dingZ, 0, dingG);
    box(0.14, 0.5, 0.3, M.ink, 0.6, dingY + 2.0, dingZ, 0, dingG);
    S.slots.ding.push({ group: dingG, x: 0, y: dingY, z: dingZ });
    /* 导览序厅陈设：铜鼎四周木柱红绳护栏（南面留观瞻口）+ 展签 + 门内两侧导览立牌 + 暖光 */
    (function () {
      var py = 1.2;   /* 台基面 */
      var posts = [], pi;
      for (pi = 0; pi < posts.length; pi++) {
        cyl(0.045, 0.055, 0.85, 8, M.wood, posts[pi][0], py + 0.425, dingZ + posts[pi][1], g);
        var pb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.ink);
        pb.position.set(posts[pi][0], py + 0.9, dingZ + posts[pi][1]); pb.castShadow = true; g.add(pb);
      }
      var yUp = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
      for (pi = 0; pi < posts.length; pi++) {
        var q0 = posts[pi], q1 = posts[(pi + 1) % posts.length];
        if (q0[1] === 2.3 && q1[1] === 2.3) continue;   /* 南面留观瞻口 */
        var rl = Math.sqrt((q1[0] - q0[0]) * (q1[0] - q0[0]) + (q1[1] - q0[1]) * (q1[1] - q0[1]));
        var rope = cyl(0.02, 0.02, rl, 6, M.lampRed, (q0[0] + q1[0]) / 2, py + 0.68, dingZ + (q0[1] + q1[1]) / 2, g);
        dir.set(q1[0] - q0[0], 0, q1[1] - q0[1]).normalize();
        rope.quaternion.setFromUnitVectors(yUp, dir);
      }
      /* 展签：斜面小牌，立在观瞻口东侧 */
      var lbC = document.createElement('canvas'); lbC.width = 256; lbC.height = 128;
      var lc = lbC.getContext('2d');
      lc.fillStyle = '#26241f'; lc.fillRect(0, 0, 256, 128);
      lc.strokeStyle = '#8a8478'; lc.lineWidth = 4; lc.strokeRect(6, 6, 244, 116);
      lc.fillStyle = '#e8e2d2'; lc.textAlign = 'center';
      lc.font = '44px "Songti SC","STSong","SimSun",serif';
      lc.fillText('青铜方鼎', 128, 58);
      lc.font = '25px "Songti SC","STSong","SimSun",serif';
      lc.fillText('商周礼器 · 复陈', 128, 100);
      var lbT = new THREE.CanvasTexture(lbC); lbT.encoding = THREE.sRGBEncoding;
      var lbG = new THREE.Group(); lbG.position.set(1.75, py, 29.1); lbG.rotation.y = 0.35; g.add(lbG);
      cyl(0.03, 0.035, 0.72, 6, M.wood, 0, 0.36, 0, lbG);
      var lbB = box(0.62, 0.4, 0.03, M.wood, 0, 0.86, 0, 0, lbG); lbB.rotation.x = -0.42;
      var lbP = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), new THREE.MeshBasicMaterial({ map: lbT }));
      lbP.position.set(0, 0.91, 0.095); lbP.rotation.x = -0.42; lbG.add(lbP);
      /* 导览立牌：门内两侧，纸面墨字，牌面朝南迎客 */
      function guideBoard(x, z, ry, title, lines) {
        var gb = new THREE.Group(); gb.position.set(x, py, z); gb.rotation.y = ry; g.add(gb);
        cyl(0.05, 0.06, 1.75, 8, M.wood, -0.52, 0.875, 0, gb);
        cyl(0.05, 0.06, 1.75, 8, M.wood, 0.52, 0.875, 0, gb);
        box(1.2, 1.32, 0.05, M.wood, 0, 1.06, 0, 0, gb);
        var bc = document.createElement('canvas'); bc.width = 256; bc.height = 320;
        var b2 = bc.getContext('2d');
        b2.fillStyle = '#ece3cd'; b2.fillRect(0, 0, 256, 320);
        b2.strokeStyle = '#4a3a2c'; b2.lineWidth = 5; b2.strokeRect(8, 8, 240, 304);
        b2.fillStyle = '#8C3B2E'; b2.textAlign = 'center';
        b2.font = '42px "Songti SC","STSong","SimSun",serif';
        b2.fillText(title, 128, 56);
        b2.fillStyle = '#2a2724'; b2.textAlign = 'left';
        b2.font = '24px "Songti SC","STSong","SimSun",serif';
        var li;
        for (li = 0; li < lines.length; li++) b2.fillText(lines[li], 26, 108 + li * 34);
        var bt = new THREE.CanvasTexture(bc); bt.encoding = THREE.sRGBEncoding;
        var bp = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.24), new THREE.MeshBasicMaterial({ map: bt }));
        bp.position.set(0, 1.06, 0.032); gb.add(bp);
      }
      /* 序厅展品旁不设置导览牌。 */
      /* 序厅暖光一盏（夜间与其他厅同步增强） */
      var xpl = new THREE.PointLight(0xffe9cf, 1.45, 14, 1);
      xpl.position.set(0, 3.6, 29.8); S.scene.add(xpl);
    })();
    /* 大踏跺落地两侧石灯一对（±3.3, 22.4），夹峙踏步、框住影壁对景 */
    lantern(-3.3, 22.4);
    lantern(3.3, 22.4);
    return g;
  }


  /* ---------- 展厅群（细分参考图尺寸，殿厅加大版） ----------
   * 花鸟 22×16.5 主厅重檐 / 山水 17.5×15 / 人物 17.5×11 / 景韵轩 12×9.5
   * 文创雅集馆 11×27（由文创/临摹连续合并） / 书斋 8×27（由书斋/茶室连续合并） */
  function buildHuaniao()  { buildCourtComplex(0, -29.25, 22, 16.5, 'S', '花鸟', { gateW: 4, wallH: 3.4, hallD: 8.5, chongyan: true, treeScale: 1.0, closedDoor: true }); }
  function buildShanshui() { buildCourtComplex(-39.25, -12.5, 21.5, 15, 'E', '山水', { gateW: 4, wallH: 3.4, hallD: 8.5, treeScale: 1.0, closedDoor: true }); }
  function buildRenwu()    { buildCourtComplex(38.75, -15.5, 21.5, 11, 'S', '人物', { gateW: 4, wallH: 3.2, hallD: 5.5, sideDoors: { W: -16 }, closedDoor: true }); }
  function buildYaji()     { buildHall(-38, -29.5, 12, 7, 'S', '雅集'); }
  function buildJingyun()  { buildCourtComplex(39, -30, 12, 9.5, 'S', '景韵', { gateW: 2.4, wallH: 3.0, hallD: 4.8, treeScale: 0.75 }); }
  /* （收藏室已取消，兰竹庭院东侧留作绿地） */
  function buildWenchuang() {
    buildCourtComplex(-41.5, 21.5, 15, 27, 'E', '文创雅集馆', { gateW: 2.4, wallH: 2.8, hallD: 6, closedDoor: true });
  }
  function buildShuzhaiChashi() {
    /* 书斋入口明确朝西，门心对准中央道路；开敞门洞避免俯视时误读成南向入口。 */
    buildCourtComplex(40, 19.5, 12, 27, 'W', '书斋', { gateW: 2.4, wallH: 2.8, hallD: 5.5, closedDoor: true });
  }
  /* （西南 / 东南角门房已取消，留作绿地） */

  /* ---------- 红灯笼（宫灯：挂杆 + 灯笼身 + 上下盖 + 流苏） ---------- */
  function redLantern(x, y, z, parent) {
    var g = new THREE.Group(); g.position.set(x, y, z); (parent || S.scene).add(g);
    cyl(0.012, 0.012, 0.14, 6, M.ink, 0, -0.05, 0, g);
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), M.lampRed);
    body.scale.y = 0.8; body.position.y = -0.26; body.castShadow = true; g.add(body);
    cyl(0.06, 0.08, 0.05, 8, M.ink, 0, -0.14, 0, g);
    cyl(0.07, 0.05, 0.05, 8, M.ink, 0, -0.38, 0, g);
    var tas = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8), M.lampRed);
    tas.rotation.x = Math.PI; tas.position.y = -0.5; g.add(tas);
    return g;
  }

  /* ---------- 灌木球（收建筑基脚 / 门两侧） ---------- */
  function shrub(x, z, r, seed) {
    var m = new THREE.Mesh(blobGeo(r, 0.22, 0.68, seed), M.leaf);
    m.position.set(x, r * 0.62, z);
    m.castShadow = m.receiveShadow = true;
    S.scene.add(m);
    return m;
  }

  /* ---------- 游廊：双列木柱 + 双坡瓦顶 + 坐槛，默认廊宽 2.2m（cw 可加宽），柱距约 3m ----------
     * gapBench：{side:±1, c:沿廊中心坐标, hw:半宽} 在该侧坐槛开一个过人口（檐枋不断）
     * cw：自定义廊宽（画廊式游廊加宽用，保证看画视距） */
  function corridor(x0, z0, x1, z1, gapBench, cw, roofY) {
    var w = cw || 2.2, eaveY = roofY || 2.5, postH = eaveY - 0.2, postY = 0.14 + postH / 2, beamY = eaveY - 0.08;
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    g.rotation.y = Math.atan2(dx, dz);
    S.scene.add(g);
    var bays = Math.max(1, Math.round(len / 3)), i, t;
    /* 廊内地板：青石板满铺通长（不再半草半板） */
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, len + 0.3), M.plaza);
    fl.rotation.x = -Math.PI / 2; fl.position.y = 0.045; fl.receiveShadow = true;
    g.add(fl);
    for (i = 0; i <= bays; i++) {
      t = -len / 2 + len * i / bays;
      cyl(0.14, 0.17, 0.14, 8, M.stone, -w / 2 + 0.2, 0.07, t, g);
      cyl(0.14, 0.17, 0.14, 8, M.stone,  w / 2 - 0.2, 0.07, t, g);
      cyl(0.09, 0.11, postH, 8, M.wood, -w / 2 + 0.2, postY, t, g);
      cyl(0.09, 0.11, postH, 8, M.wood,  w / 2 - 0.2, postY, t, g);
    }
    /* 坐槛（美人靠矮凳）与檐枋；gapBench 一侧断出 1.9m 过人口 */
    var bi, sideX, segs, si, b0, b1;
    for (bi = 0; bi < 2; bi++) {
      sideX = bi === 0 ? -w / 2 + 0.2 : w / 2 - 0.2;
      segs = [[-len / 2, len / 2]];
      if (gapBench && ((bi === 0) === (gapBench.side < 0))) {
        segs = [[-len / 2, gapBench.c - gapBench.hw], [gapBench.c + gapBench.hw, len / 2]];
      }
      for (si = 0; si < segs.length; si++) {
        b0 = segs[si][0]; b1 = segs[si][1];
        if (b1 - b0 > 0.05) box(0.3, 0.42, b1 - b0, M.wood, sideX, 0.33, (b0 + b1) / 2, 0, g);
      }
    }
    box(0.12, 0.18, len, M.wood, -w / 2 + 0.2, beamY, 0, 0, g);
    box(0.12, 0.18, len, M.wood,  w / 2 - 0.2, beamY, 0, 0, g);
    /* 挂落（檐下柱间镂空木板，两面） */
    box(0.05, 0.34, len, M.gualuo, -w / 2 + 0.2, eaveY - 0.32, 0, 0, g);
    box(0.05, 0.34, len, M.gualuo,  w / 2 - 0.2, eaveY - 0.32, 0, 0, g);
    /* 双坡小青瓦顶，屋脊顺廊向 */
    var rf = hipRoof(len + 0.7, w + 0.8, 0.85, 0, eaveY, 0, g);
    rf.rotation.y = Math.PI / 2;
  }

  /* ---------- 廊道挂画：立轴国画（宣纸画心 + 绫边装裱 + 天地杆轴头 + 暖光洗画灯带） ---------- */
  function scrollTex(seed) {
    if (window.MuseumGallery && window.MuseumGallery.tex) {
      var _real = window.MuseumGallery.tex(seed);
      if (_real) return _real;
    }
    return canvasTex(128, function (ctx, s2) {
      ctx.fillStyle = '#e9e0c9'; ctx.fillRect(0, 0, s2, s2);
      var s = seed >>> 0, i, x;
      function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
      /* 淡墨远山三层 */
      for (i = 0; i < 3; i++) {
        var y0 = s2 * (0.34 + i * 0.13), amp = s2 * 0.1 * (0.5 + rnd());
        ctx.fillStyle = 'rgba(58,62,58,' + (0.22 + i * 0.14) + ')';
        ctx.beginPath(); ctx.moveTo(0, y0);
        for (x = 0; x <= s2; x += 6) ctx.lineTo(x, y0 - Math.abs(Math.sin(x * 0.06 + seed * 0.7 + i * 2.1)) * amp - rnd() * 3);
        ctx.lineTo(s2, s2); ctx.lineTo(0, s2); ctx.closePath(); ctx.fill();
      }
      /* 近景浓墨数笔（树石） */
      ctx.strokeStyle = 'rgba(38,40,38,0.85)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (i = 0; i < 4; i++) {
        ctx.beginPath();
        var sx = s2 * (0.15 + rnd() * 0.7), sy = s2 * (0.55 + rnd() * 0.2);
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + rnd() * 20 - 10, sy - 14, sx + rnd() * 26 - 13, sy - 26, sx + rnd() * 30 - 15, sy - 34 - rnd() * 10);
        ctx.stroke();
      }
      /* 留白题款 + 朱红印章 */
      ctx.fillStyle = 'rgba(50,50,48,0.7)';
      for (i = 0; i < 4; i++) ctx.fillRect(s2 * 0.12, s2 * (0.08 + i * 0.035), 2.5, 2.5);
      ctx.fillStyle = '#a83a2a'; ctx.fillRect(s2 * 0.12, s2 * 0.24, s2 * 0.075, s2 * 0.075);
    }, 1, 1);
  }
  function hangingScroll(x, z, faceDir, seed, k, ryAbs, yOffset) {
    var g = new THREE.Group(); g.position.set(x, yOffset || 0, z);
    g.rotation.y = (ryAbs !== undefined) ? ryAbs : (faceDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (k) g.scale.setScalar(k);
    S.scene.add(g);
    box(0.9, 1.72, 0.02, M.wood, 0, 1.5, 0, 0, g);              /* 绫边装裱 */
    /* 优先使用本地真实国画素材，缺图时才回退到程序化水墨卷轴。 */
    var galleryTex = (window.MuseumGallery && window.MuseumGallery.tex)
      ? window.MuseumGallery.tex(seed) : null;
    var paint = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.42),
      new THREE.MeshStandardMaterial({ map: galleryTex || scrollTex(seed), roughness: 0.92 }));
    paint.position.set(0, 1.5, 0.015); g.add(paint);
    var r1 = cyl(0.016, 0.016, 0.98, 6, M.wood, 0, 2.4, 0.02, g); r1.rotation.z = Math.PI / 2;   /* 天杆 */
    var r2 = cyl(0.035, 0.035, 1.0, 8, M.wood, 0, 0.62, 0.03, g); r2.rotation.z = Math.PI / 2;   /* 地杆 */
    var k1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.ink); k1.position.set(-0.53, 0.62, 0.03); k1.castShadow = true; g.add(k1);
    var k2 = k1.clone(); k2.position.x = 0.53; g.add(k2);
    /* 暖光洗画灯带（自发光灯箱，斜向下洗到画面） */
    if (!S.lampGlow) S.lampGlow = new THREE.MeshStandardMaterial({ color: 0x4a3f2c, emissive: 0xffd9a0, emissiveIntensity: 1.15 });
    var strip = box(0.86, 0.05, 0.07, S.lampGlow, 0, 2.32, 0.1, 0, g);
    strip.rotation.x = 0.5;
  }
  /* 半壁廊墙：廊外侧重柱间封墙（墙脚石 + 纸筋白墙 + 墨瓦压顶）+ 每开间一幅立轴 */
  function galleryWall(x, faceDir, topY) {    var len = 10.4, zc = 15.5, wallTop = topY || 2.42, wallH = wallTop - 0.12;   /* 南端收进内转角亭（z=22.4 一线），让出台基与侧墙 */
    box(0.2, 0.12, len + 0.1, M.stoneDark, x, 0.06, zc);
    box(0.15, wallH, len, M.paper, x, 0.12 + wallH / 2, zc);
    box(0.22, 0.14, len + 0.1, M.ink, x, wallTop, zc);
    var zs = [11.6, 14.2, 16.8, 19.4], i;
    for (i = 0; i < zs.length; i++) hangingScroll(x + faceDir * 0.14, zs[i], faceDir, 350 + i * 7 + (x > 0 ? 100 : 0), 1, undefined, 0.35);
  }

  /* 横向半壁廊墙（东长廊用，画面朝南）：同 galleryWall 做法，沿 x 展开 */
  function galleryWallX(z, x0, x1) {
    var len = x1 - x0, xc = (x0 + x1) / 2;
    box(len + 0.1, 0.12, 0.2, M.stoneDark, xc, 0.06, z);
    box(len, 2.3, 0.15, M.paper, xc, 1.25, z);
    box(len + 0.1, 0.14, 0.22, M.ink, xc, 2.42, z);
    var n = Math.floor(len / 2.86), i;
    for (i = 0; i < n; i++) {
      hangingScroll(x0 + len * (i + 0.5) / n, z + 0.14, 0, 640 + i * 11, 1, 0);
    }
  }

  /* ---------- 临水半亭：背壁白粉墙 + 前檐双柱 + 单披顶 + 大立轴 + 美人靠 + 红灯笼（面西隔水） ---------- */
  function halfPavilion(x, z) {
    var g = new THREE.Group(); S.scene.add(g);
    box(0.16, 2.7, 2.8, M.paper, x + 0.75, 1.42, z, 0, g);   /* 背壁（顶 2.77） */
    box(0.24, 0.16, 3.0, M.ink, x + 0.75, 2.85, z, 0, g);    /* 瓦压顶 */
    box(0.26, 0.14, 3.0, M.stoneDark, x + 0.75, 0.07, z, 0, g);
    box(2.0, 0.3, 3.0, M.stone, x, 0.15, z, 0, g);           /* 石台基 */
    cyl(0.16, 0.19, 0.14, 8, M.stone, x - 0.7, 0.37, z - 1.1, g);
    cyl(0.16, 0.19, 0.14, 8, M.stone, x - 0.7, 0.37, z + 1.1, g);
    cyl(0.1, 0.12, 2.1, 8, M.wood, x - 0.7, 1.4, z - 1.1, g);
    cyl(0.1, 0.12, 2.1, 8, M.wood, x - 0.7, 1.4, z + 1.1, g);
    box(0.14, 0.2, 2.6, M.wood, x - 0.7, 2.5, z, 0, g);      /* 檐枋 */
    box(0.05, 0.3, 2.4, M.gualuo, x - 0.7, 2.26, z, 0, g);   /* 挂落 */
    hipRoof(2.8, 3.6, 1.0, x, 2.62, z, g);
    box(0.28, 0.42, 2.2, M.wood, x - 0.45, 0.55, z, 0, g);   /* 美人靠 */
    hangingScroll(x + 0.62, z, -1, 999, 1.15);               /* 背壁大立轴（面西） */
    redLantern(x - 0.7, 2.44, z - 1.1, g);
    redLantern(x - 0.7, 2.44, z + 1.1, g);
  }

  /* ---------- 石栏杆一段（望柱 + 扶手 + 地栿，高 0.6m） ---------- */
  function railing(x0, z0, x1, z1, y0) {
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var ry = Math.abs(dz) > Math.abs(dx) ? Math.PI / 2 : 0;
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = y0 || 0;
    box(len, 0.09, 0.14, M.stone, cx, y + 0.55, cz, ry);
    box(len, 0.06, 0.1, M.stone, cx, y + 0.1, cz, ry);
    var pts = spread(-len / 2, len / 2, 1.1), i;
    for (i = 0; i < pts.length; i++) {
      var px = cx + (ry ? 0 : pts[i]), pz = cz + (ry ? pts[i] : 0);
      box(0.12, 0.6, 0.12, M.stone, px, y + 0.3, pz, ry);
    }
  }

  /* ---------- 庭院围栏：石地栿 + 木望柱（莲珠柱头）+ 寻杖/中枋双横杆，总高约 1.1m ----------
     * 透空栏杆取代实心围墙，园内园外景色互见；门楼、月洞门墙、花窗墙仍保留墙体 */
  function fenceRun(x0, z0, x1, z1, parent) {
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.4) return;
    var ry = Math.abs(dz) > Math.abs(dx) ? Math.PI / 2 : 0;
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, gp = parent || S.scene;
    box(len, 0.16, 0.28, M.stone, cx, 0.08, cz, ry, gp);   // 石地栿
    box(len, 0.1, 0.13, M.wood, cx, 1.02, cz, ry, gp);     // 寻杖（上横杆）
    box(len, 0.07, 0.1, M.wood, cx, 0.56, cz, ry, gp);     // 中枋（下横杆）
    var pts = spread(-len / 2, len / 2, 1.6), i;
    for (i = 0; i < pts.length; i++) {
      var px = ry ? cx : cx + pts[i], pz = ry ? cz + pts[i] : cz;
      box(0.15, 1.06, 0.15, M.wood, px, 0.61, pz, ry, gp); // 望柱
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.stone);
      head.position.set(px, 1.18, pz);
      head.castShadow = true; head.receiveShadow = true;
      gp.add(head);                                        // 莲珠柱头
    }
  }

  /* ---------- 倚墙半廊：靠背矮墙 + 单列柱 + 坐槛 + 三叠单坡瓦披 ----------
     * side = ±1：柱列相对墙线的偏移方向（沿墙走向的左手/右手侧） */
  function halfCorridor(x0, z0, x1, z1, side) {
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var ux = dx / len, uz = dz / len;
    var px = -uz * side, pz = ux * side;      // 单位法向（指向院内）
    wallRun(x0, z0, x1, z1, 0.35, 1.0);       // 靠背矮墙（总高约 1.4m）
    var n = Math.max(1, Math.round(len / 3)), i, t;
    for (i = 0; i <= n; i++) {
      t = i / n;
      cyl(0.14, 0.17, 0.14, 8, M.stone, x0 + dx * t + px * 1.1, 0.07, z0 + dz * t + pz * 1.1);
      cyl(0.09, 0.11, 2.1, 8, M.wood, x0 + dx * t + px * 1.1, 1.19, z0 + dz * t + pz * 1.1);
    }
    var ry = Math.abs(dz) > Math.abs(dx) ? Math.PI / 2 : 0;
    var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    box(len, 0.4, 0.28, M.wood, mx + px * 1.1, 0.32, mz + pz * 1.1, ry);   // 坐槛
    box(len, 0.14, 0.14, M.wood, mx + px * 1.1, 2.3, mz + pz * 1.1, ry);   // 檐枋
    var k;
    for (k = 0; k < 3; k++) {               // 三叠瓦披，从墙顶披到柱列
      var off2 = 0.22 + k * 0.55, yy = 2.6 - k * 0.17;
      box(len + 0.4, 0.07, 0.62, M.tile, mx + px * off2, yy, mz + pz * off2, ry);
    }
    box(len + 0.4, 0.1, 0.12, M.ink, mx + px * 1.42, 2.14, mz + pz * 1.42, ry);  // 檐口线
  }

  /* ---------- 花窗墙：粉墙上等距嵌冰裂棂窗，side = ±1 为窗朝向 ---------- */
  function windowWall(x0, z0, x1, z1, hBase, hWall, n, side) {
    wallRun(x0, z0, x1, z1, hBase, hWall);
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var ux = dx / len, uz = dz / len;
    var px = -uz * side, pz = ux * side;
    var vertical = Math.abs(dz) > Math.abs(dx);
    var ry = vertical ? (px > 0 ? Math.PI / 2 : -Math.PI / 2) : (pz > 0 ? 0 : Math.PI);
    var i, t;
    for (i = 1; i <= n; i++) {
      t = i / (n + 1);
      addWindow(x0 + dx * t + px * 0.21, (hBase || 0.5) + 1.35, z0 + dz * t + pz * 0.21, ry);
    }
  }

  /* ---------- 游廊转角亭：四柱 + 柱础 + 口字檐枋 + 小坡顶（罩住 90° 转角，亭顶高于廊顶） ----------
     * rw：攒尖顶面宽（默认 3.4；内转角亭接加宽双廊用 4.0，南缘仍让开台基 0.1m） */
  function cornerPavilion(x, z, rw) {
    var g = new THREE.Group(); g.position.set(x, 0, z); S.scene.add(g);
    var o = [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]], i;
    for (i = 0; i < 4; i++) {
      cyl(0.2, 0.24, 0.14, 8, M.stone, o[i][0], 0.07, o[i][1], g);
      cyl(0.11, 0.13, 3.5, 8, M.wood, o[i][0], 1.82, o[i][1], g);
    }
    box(2.6, 0.22, 0.24, M.wood, 0, 3.5, -0.95, 0, g);
    box(2.6, 0.22, 0.24, M.wood, 0, 3.5, 0.95, 0, g);
    box(0.24, 0.22, 2.6, M.wood, -0.95, 3.5, 0, 0, g);
    box(0.24, 0.22, 2.6, M.wood, 0.95, 3.5, 0, 0, g);
    hipRoof(rw || 3.4, rw || 3.4, 1.3, 0, 3.66, 0, g, undefined, 0.32);   /* 戗角收短：贴邻廊门/横廊，飞尖不与相邻屋面角部相咬 */
  }

  /* ---------- Rodin 环形连廊：整圈 GLB，加载后按真实包围盒缩放至中央庭院 ---------- */
  function buildRodinRingCorridor() {
    if (!THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load('assets/models/rodin-ring-corridor.glb', function (gltf) {
      var ring = gltf.scene;
      ring.name = 'rodin-ring-corridor';
      ring.updateMatrixWorld(true);
      var bounds = new THREE.Box3().setFromObject(ring);
      var size = bounds.getSize(new THREE.Vector3());
      if (!size.x || !size.z) return;
      /* 红线范围约 58×48m：留出主厅外墙与池塘驳岸的安全间距。 */
      var scale = Math.min(58 / size.x, 48 / size.z);
      ring.scale.setScalar(scale);
      ring.updateMatrixWorld(true);
      bounds.setFromObject(ring);
      var center = bounds.getCenter(new THREE.Vector3());
      ring.position.set(-center.x, -bounds.min.y, -2 - center.z);
      ring.traverse(function (node) {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
      });
      S.scene.add(ring);
    }, undefined, function (err) {
      console.warn('[云间入墨] Rodin 环形连廊加载失败：', err);
    });
  }

  /* ---------- 连廊端门：开敞垂花门，标出厅—院—廊转换而不封堵动线 ---------- */
  function corridorDoorway(x, z, dx, dz) {
    var len = Math.sqrt(dx * dx + dz * dz);
    if (!len) return;
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(dx, dz);
    S.scene.add(g);
    [-1, 1].forEach(function (side) {
      cyl(0.18, 0.22, 0.14, 8, M.stone, side * 1.16, 0.07, 0, g);
      cyl(0.12, 0.14, 3.12, 8, M.wood, side * 1.16, 1.7, 0, g);
    });
    box(2.72, 0.24, 0.28, M.wood, 0, 3.15, 0, 0, g);
    box(2.24, 0.3, 0.07, M.gualuo, 0, 2.9, 0.14, 0, g);
    hipRoof(3.28, 1.45, 0.58, 0, 3.28, 0, g);
  }

  /* 转角地坪：青石板一块，高出廊内地坪 1cm（避免共面闪烁），盖住转角节点柱础 */
  function pavPatch(x, z, sx, sz) {
    var p = new THREE.Mesh(new THREE.PlaneGeometry(sx || 4.2, sz || 4.2), M.plaza);
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.055, z); p.receiveShadow = true;
    S.scene.add(p);
  }

  /* 古镇青砖墁地：主通道/广场满铺（y=0.02，低于各庭院地坪 0.03+ 不共面） */
  function pave(x0, z0, x1, z1) {
    var w = x1 - x0, d = z1 - z0;
    var t = M.brickT(Math.max(1, Math.round(w / 1.28)), Math.max(1, Math.round(d / 1.28)));
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
    m.receiveShadow = true; S.scene.add(m);
  }

  /* ---------- 全馆游廊系统：只保留序厅后方的展厅连廊与画墙 ---------- */
  function buildCorridors() {
    /* 序厅后方原有展厅连廊：连接序厅后侧与两翼展厅，必须保留。 */
    corridor(-7, 9.5, -7, 20.4, undefined, 3.8, 4.1);
    corridor(7, 9.5, 7, 20.4, undefined, 3.8, 4.1);
    /* 新增的六段弧形红线连廊已撤除；不再生成与五个展厅重叠的外侧连廊。 */
    /* 双廊北端不做收头门楼：廊顶（庑殿式收头）尽端即敞口，出廊即中轴南院，北对水榭庭院南门 */
    /* 中轴双廊画廊墙随廊加宽外移至 ±8.9（外柱 8.4 外侧 0.5m，仍在廊顶覆盖内）：半壁墙 + 每开间立轴 + 暖光洗画 */
    /* 东长廊画墙随北侧加宽北移至 −17.7（北柱 −17.2 外侧 0.5m，廊顶北缘 −17.8 覆盖），画面朝南 */
    galleryWall(-8.9, 1, 3.58);
    galleryWall(8.9, -1, 3.58);
  }

  /* ---------- 中轴拱桥：序厅方向跨中心湖，连接北侧园路 ---------- */
  function buildCentralArchBridge() {
    var g = new THREE.Group();
    g.name = 'central-arch-bridge';
    /* 桥的本地长轴沿 X 建模，整体旋转 90° 后落到世界 Z 轴：俯视图竖向，
       从序厅向北跨湖，避免误放成东西向横桥。 */
    g.rotation.y = Math.PI / 2;
    S.scene.add(g);
    var x0 = -10.0, x1 = 5.45, steps = 18, width = 2.45, i;
    function archY(x) {
      var t = (x - x0) / (x1 - x0);
      return 0.42 + 0.78 * Math.sin(Math.PI * t);
    }
    /* 连续石拱券墙：桥下必须有完整的拱洞，而不是一排悬空方块。 */
    var outer = new THREE.Shape();
    outer.moveTo(x0, 0); outer.lineTo(x1, 0); outer.lineTo(x1, archY(x1) + 0.72);
    for (i = steps; i >= 0; i--) {
      var ox = x0 + (x1 - x0) * i / steps;
      outer.lineTo(ox, archY(ox) + 0.72);
    }
    outer.closePath();
    var opening = new THREE.Path();
    var hx0 = x0 + 1.25, hx1 = x1 - 1.25;
    opening.moveTo(hx0, 0); opening.lineTo(hx0, 0.24);
    for (i = 0; i <= steps; i++) {
      var hx = hx0 + (hx1 - hx0) * i / steps;
      var ht = (hx - hx0) / (hx1 - hx0);
      opening.lineTo(hx, 0.24 + 1.18 * Math.sin(Math.PI * ht));
    }
    opening.lineTo(hx1, 0); opening.closePath();
    outer.holes.push(opening);
    var wallGeo = new THREE.ExtrudeGeometry(outer, { depth: width, bevelEnabled: false, curveSegments: 4, steps: 1 });
    wallGeo.translate(0, 0, -width / 2);
    var wall = new THREE.Mesh(wallGeo, M.stone);
    wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    /* 桥面铺石阶，沿拱线分段抬高，避免平顶穿出拱券。 */
    for (i = 0; i < steps; i++) {
      var a = x0 + (x1 - x0) * i / steps;
      var b = x0 + (x1 - x0) * (i + 1) / steps;
      var mid = (a + b) / 2;
      var dy = archY(b) - archY(a);
      var seg = box(b - a + 0.10, 0.18, width + 0.12, M.stone, mid, archY(mid) + 0.78, 0, Math.atan2(dy, b - a), g);
      seg.receiveShadow = true;
      [-1, 1].forEach(function (side) {
        var post = cyl(0.075, 0.09, 0.78, 8, M.stone, mid, archY(mid) + 1.20, side * (width / 2 - 0.2), g);
        post.rotation.z = Math.atan2(dy, b - a);
      });
    }
    /* 低矮栏杆沿桥拱线分段，保持中轴通行宽度。 */
    for (i = 0; i < steps; i++) {
      var c = x0 + (x1 - x0) * i / steps;
      var d = x0 + (x1 - x0) * (i + 1) / steps;
      var cm = (c + d) / 2, rise = archY(cm) + 1.68;
      [-1, 1].forEach(function (side) {
        var rail = box(d - c + 0.04, 0.09, 0.09, M.stoneDark, cm, rise, side * (width / 2 - 0.2), Math.atan2(archY(d) - archY(c), d - c), g);
        rail.castShadow = true;
      });
    }
    /* 两端用石踏步收桥，不做门楼，避免遮挡序厅中轴。 */
    for (i = 0; i < 2; i++) {
      var endX = i ? x1 + 0.55 : x0 - 0.55;
      box(1.1, 0.18, width + 0.55, M.stone, endX, 0.20, 0, 0, g);
    }
  }

  /* ---------- 中轴真实拱桥：使用 Rodin 导出的单桥 GLB，跨中心湖连接序厅与山水方向 ---------- */
  function loadCentralArchBridge() {
    if (!THREE.GLTFLoader) { buildCentralArchBridge(); return; }
    new THREE.GLTFLoader().load('assets/models/rodin_bridge_single.glb', function (gltf) {
      var bridge = gltf.scene;
      bridge.name = 'rodin-central-arch-bridge';
      bridge.updateMatrixWorld(true);
      var raw = new THREE.Box3().setFromObject(bridge);
      var rawSize = raw.getSize(new THREE.Vector3());
      var longAxis = Math.max(rawSize.x, rawSize.z);
      if (!longAxis) { buildCentralArchBridge(); return; }
      /* 湖面约 16×8m：桥沿湖的短轴南北跨越，桥头分别落在南北两岸的湖边。 */
      /* 只把桥的长度拉到两岸距离；高度、宽度保持原模型比例，避免等比放大后变成巨型悬桥。 */
      bridge.scale.set(15.0 / rawSize.x, 2.6 / rawSize.y, 2.2 / rawSize.z);
      if (rawSize.x >= rawSize.z) bridge.rotation.y = Math.PI / 2;
      bridge.updateMatrixWorld(true);
      var fitted = new THREE.Box3().setFromObject(bridge);
      var center = fitted.getCenter(new THREE.Vector3());
      var group = new THREE.Group();
      group.name = 'central-arch-bridge-glb';
      group.add(bridge);
      group.position.set(-center.x, 0.06 - fitted.min.y, -2.2 - center.z);
      bridge.traverse(function (node) {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
      });
      S.scene.add(group);
    }, undefined, function (err) {
      console.warn('[云间入墨] 桥 GLB 加载失败，回退程序桥：', err);
      buildCentralArchBridge();
    });
  }

  /* ---------- 中心庭（17×13 碎石广场 + 内院 5×5m：中心树 + 太湖石 + 石桌凳 + 条凳 + 石灯 + 陶罐） ---------- */
  function buildZhongxinCourt() {
    /* 中央庭院只保留一块更大的自然曲池；与序厅后方连廊及两侧展厅均留出通行余量。 */
    irregularPond(0, -2.2, 16.0, 8.0, 55);
    /* 使用 Rodin 导出的单桥 GLB：桥长沿南北中轴，桥底贴湖面；加载失败才回退程序桥。 */
    loadCentralArchBridge();
    return;
    /* 周边碎石广场 */
    var g = new THREE.Mesh(new THREE.PlaneGeometry(17, 13), M.gravel);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0.04, -13); g.receiveShadow = true;
    S.scene.add(g);
    /* 青石收边：碎石广场与草坪之间的深色过渡带 */
    box(18, 0.08, 0.5, M.stoneDark, 0, 0.06, -19.5);
    box(18, 0.08, 0.5, M.stoneDark, 0, 0.06, -6.5);
    box(0.5, 0.08, 13.5, M.stoneDark, -8.5, 0.06, -13);
    box(0.5, 0.08, 13.5, M.stoneDark, 8.5, 0.06, -13);
    /* 收边外侧绿篱环：北至花鸟馆甬道、西至西长廊、东至东长廊三处留口，南贴水榭不设 */
    box(6.5, 0.4, 0.35, M.leaf, -5.25, 0.2, -20.15);
    box(6.5, 0.4, 0.35, M.leaf, 5.25, 0.2, -20.15);
    box(0.35, 0.4, 5.6, M.leaf, -9.15, 0.2, -16.7);
    box(0.35, 0.4, 5.0, M.leaf, -9.15, 0.2, -9.0);
    box(0.35, 0.4, 2.2, M.leaf, 9.15, 0.2, -18.4);
    box(0.35, 0.4, 8.1, M.leaf, 9.15, 0.2, -10.55);
    /* 5×5 内院：围栏已撤（主树四周敞开，树石直接落在碎石广场上） */
    /* 中心主景树（冠幅大树，约 6m） */
    plantTree(0, -13.4, 1.6, 55);
    /* 太湖石主景（约 2m 高，与 6m 主树相称）+ 次景石 */
    rock(-1.5, 0.3, -14.4, 0.9, 0.5, 1.2, 71);
    rock(1.4, 0.08, -12.0, 0.4, 0.4, 0.9, 72);
    /* 石桌凳 / 条石坐凳 / 石灯 / 陶罐 */
    stoneTableSet(5.8, -9.5);
    stoneBench(-5.8, -9.5, 0);
    lantern(3.6, -16.5);
    potteryJar(-4.0, -16.3);
    /* 南带筒车水院：中轴对景，北衬内院主树、南迎水榭北门（王祯《农书》筒车形制，大轮缓转提水） */
    waterwheel(0, -9.0);
    var m = new THREE.Mesh(blobGeo(0.5, 0.2, 0.7, 77), M.leaf);
    m.position.set(2.2, 0.3, -16.2); m.castShadow = m.receiveShadow = true;
    S.scene.add(m);
  }

  /* ---------- 水榭庭院（14×12m 围墙院落：5.5×4.5 水池 + 曲桥 + 水榭 + 假山 + 主树） ---------- */
  function buildShuixieCourt() {
    /* 四面透空围栏：南面留 2.4m 正门，北面留 2.4m 北门直通中心庭（与筒车水院对景） */
    fenceRun(-7, -5, -1.2, -5);
    fenceRun(1.2, -5, 7, -5);
    fenceRun(-7, 7, -1.2, 7);
    fenceRun(1.2, 7, 7, 7);
    fenceRun(-7, -5, -7, 7);
    fenceRun(7, -5, 7, 7);
    /* 北门楼（2.4m 宽，面北朝中心庭） */
    var gn = new THREE.Group(); gn.position.set(0, 0, -5); S.scene.add(gn);
    box(0.6, 2.8, 0.6, M.stone, -1.2, 1.4, 0, 0, gn);
    box(0.6, 2.8, 0.6, M.stone, 1.2, 1.4, 0, 0, gn);
    box(3.0, 0.7, 0.4, M.paper, 0, 3.05, 0, 0, gn);
    hipRoof(4.2, 1.6, 0.8, 0, 3.5, 0, gn);
    redLantern(-0.85, 3.42, -0.32, gn);
    redLantern(0.85, 3.42, -0.32, gn);
    /* 北门 → 中心庭收边的石板路径（两块错色） */
    box(2.4, 0.08, 0.8, M.stone, 0, 0.04, -5.4);
    box(2.4, 0.08, 0.8, M.stoneDark, 0, 0.04, -6.15);
    /* 南门楼（2.4m 宽） */
    var g = new THREE.Group(); g.position.set(0, 0, 7); S.scene.add(g);
    box(0.6, 2.8, 0.6, M.stone, -1.2, 1.4, 0, 0, g);
    box(0.6, 2.8, 0.6, M.stone, 1.2, 1.4, 0, 0, g);
    box(3.0, 0.7, 0.4, M.paper, 0, 3.05, 0, 0, g);
    hipRoof(4.2, 1.6, 0.8, 0, 3.5, 0, g);
    plaque('水榭庭院', 1.8, 0, 3.0, 0.26, 0, g);
    redLantern(-0.85, 3.42, 0.32, g);
    redLantern(0.85, 3.42, 0.32, g);
    /* 青石板地 */
    var p = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 11.2), M.plaza);
    p.rotation.x = -Math.PI / 2; p.position.set(0, 0.05, 1); p.receiveShadow = true;
    S.scene.add(p);
    /* 水池 5.5×4.5（偏西南，x -5.5~0.5, z 1~5.5） */
    box(6.3, 0.3, 0.3, M.stone, -2.5, 0.15, 1.0);
    box(6.3, 0.3, 0.3, M.stone, -2.5, 0.15, 5.5);
    box(0.3, 0.3, 4.5, M.stone, -5.5, 0.15, 3.25);
    box(0.3, 0.3, 4.5, M.stone, 0.5, 0.15, 3.25);
    box(5.5, 0.1, 4.5, M.ink, -2.5, -0.2, 3.25);
    waterPlane(-2.5, 3.25, 5.5, 4.5, 0.08);
    lotus(-4.4, 2.0, 0.28); lotus(-3.0, 4.4, 0.32); lotus(-1.2, 2.6, 0.3);
    lotus(-0.4, 4.6, 0.24); lotus(-4.8, 3.8, 0.26);
    /* 曲桥：三段折板过池 */
    box(0.9, 0.12, 2.2, M.wood, -2.2, 0.28, 1.9);
    box(1.8, 0.12, 0.9, M.wood, -1.3, 0.28, 2.9);
    box(0.9, 0.12, 2.6, M.wood, -0.4, 0.28, 4.2);
    /* 水榭平台 3.2×2.2（东北角临水） + 四柱小顶 + 美人靠 */
    box(3.2, 0.4, 2.2, M.stone, 4.2, 0.2, 0.6);
    var px = [2.9, 5.5], pz = [-0.2, 1.4], pi, pj;
    for (pi = 0; pi < 2; pi++) for (pj = 0; pj < 2; pj++)
      cyl(0.09, 0.11, 2.0, 8, M.wood, px[pi], 1.4, pz[pj]);
    hipRoof(4.4, 3.2, 1.0, 4.2, 2.5, 0.6);
    box(0.3, 0.08, 1.8, M.wood, 2.7, 0.75, 0.6);   // 美人靠（西面临水）
    redLantern(2.9, 2.46, -0.2);
    redLantern(2.9, 2.46, 1.4);
    /* 假山（西北角，最高约 2.6m）+ 主树 + 竹丛 + 石灯 + 石桌凳 */
    rock(-4.6, 0.35, -2.6, 1.3, 0.5, 1.5, 81);
    rock(-3.0, 0.18, -3.4, 0.7, 0.42, 1.1, 82);
    rock(-5.6, 0.12, -1.2, 0.5, 0.4, 0.9, 84);
    plantTree(3.2, 5.3, 1.0, 83);
    bambooClump(-5.8, -3.8, 213, S.scene, 0.8);
    stoneTableSet(3.6, -3.4);
    lantern(1.6, 5.6);
    lantern(-6.0, 6.0);
    /* 水榭平台三面石栏杆（西面临水为美人靠） */
    railing(2.6, -0.5, 5.8, -0.5, 0.4);
    railing(5.8, -0.5, 5.8, 1.7, 0.4);
    railing(2.6, 1.7, 5.8, 1.7, 0.4);
    /* 曲桥两侧矮栏杆 */
    railing(-2.65, 0.9, -2.65, 2.9, 0.34);
    railing(-1.75, 0.9, -1.75, 2.9, 0.34);
    railing(-2.1, 2.45, -0.5, 2.45, 0.34);
    railing(-2.1, 3.35, -0.5, 3.35, 0.34);
    railing(-0.85, 3.0, -0.85, 5.4, 0.34);
    railing(0.05, 3.0, 0.05, 5.4, 0.34);
    /* 东南角临水半亭：白墙 + 大立轴，隔水可赏 */
    halfPavilion(6.0, 4.2);
    /* 北墙已改围栏，原冰裂棂花窗移除（全院围栏统一） */
  }

  /* 序厅后方原挡墙：整墙无门，收在两侧连廊内缘之间，不与连廊重叠。 */
  function buildAxisScreenWall() {
    box(6.4, 0.5, 1.05, M.stoneDark, 0, 0.25, 18.8);
    box(6.0, 0.26, 0.82, M.stone, 0, 0.63, 18.8);
    box(5.8, 3.4, 0.5, M.paper, 0, 2.46, 18.8);
    box(6.0, 0.16, 0.66, M.ink, 0, 4.24, 18.8);
    box(6.4, 0.2, 1.05, M.tile, 0, 4.42, 18.8);
    box(3.6, 2.3, 0.14, M.ink, 0, 2.46, 19.12);
    box(3.2, 1.9, 0.16, M.plaza, 0, 2.46, 19.14);
    box(3.6, 2.3, 0.14, M.ink, 0, 2.46, 18.48);
    box(3.2, 1.9, 0.16, M.plaza, 0, 2.46, 18.46);
  }
  /* ---------- 中轴南院：开阔青砖广场（z 8~24.5）——大踏跺、影壁、水榭南门一线贯通，不压亭子 ---------- */
  function buildAxisCourt() {
    var g = new THREE.Mesh(new THREE.PlaneGeometry(14, 16.5), M.plaza);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0.03, 16.25); g.receiveShadow = true;
    S.scene.add(g);
    /* 中轴影壁（z=18.8，收窄并后移，避开序厅大踏跺；整墙无门）：
       南面墨边框壁心迎序厅大踏跺，北面素壁心对水榭庭院南门；须弥座 + 墨瓦压顶 */
    box(6.4, 0.5, 1.05, M.stoneDark, 0, 0.25, 18.8);
    box(6.0, 0.26, 0.82, M.stone, 0, 0.63, 18.8);
    box(5.8, 3.4, 0.5, M.paper, 0, 2.46, 18.8);
    box(6.0, 0.16, 0.66, M.ink, 0, 4.24, 18.8);
    box(6.4, 0.2, 1.05, M.tile, 0, 4.42, 18.8);
    box(3.6, 2.3, 0.14, M.ink, 0, 2.46, 18.8 + 0.32);
    box(3.2, 1.9, 0.16, M.plaza, 0, 2.46, 18.8 + 0.34);
    box(3.6, 2.3, 0.14, M.ink, 0, 2.46, 18.8 - 0.32);
    box(3.2, 1.9, 0.16, M.plaza, 0, 2.46, 18.8 - 0.34);
    /* 中轴甬道两侧：陶罐与灌木球交替成列（让开影壁与大踏跺轴线） */
    var zzs = [10.5, 13.7, 16.9], zzi;
    for (zzi = 0; zzi < zzs.length; zzi++) {
      potteryJar(-2.4, zzs[zzi]);
      shrub(2.4, zzs[zzi], 0.44, 500 + Math.round(zzs[zzi] * 10));
    }
    /* 影壁两侧一对陶罐灌木，框住绕壁通道 */
    potteryJar(-4.7, 19.4);
    shrub(4.7, 19.4, 0.44, 694);
  }

  /* ---------- 山石庭院（13×12 碎石场，内院 5×4m：主景山石 2.8m + 造型松 + 石桌凳 + 石灯） ---------- */
  function buildShanshiCourt() {
    var g = new THREE.Mesh(new THREE.PlaneGeometry(13, 12), M.gravel);
    g.rotation.x = -Math.PI / 2; g.position.set(-20, 0.035, 0); g.receiveShadow = true;
    S.scene.add(g);
    /* 围栏围合（与其他庭院统一）：东临通道留 2m 口、南面临中轴留 2.4m 口 */
    fenceRun(-26.5, -6, -13.5, -6);
    fenceRun(-26.5, 6, -21.2, 6);
    fenceRun(-18.8, 6, -13.5, 6);
    fenceRun(-26.5, -6, -26.5, 6);
    fenceRun(-13.5, -6, -13.5, -1);
    fenceRun(-13.5, 1, -13.5, 6);
    /* 主景山石（约 3.9m 高太湖石峰）与配石 */
    rock(-21.2, 0.55, -0.6, 1.3, 0.5, 1.5, 91);
    rock(-18.6, 0.3, 1.2, 0.75, 0.45, 1.2, 92);
    rock(-22.4, 0.18, 2.6, 0.55, 0.42, 1.1, 93);
    rock(-19.5, 0.14, -3.2, 0.48, 0.4, 1.0, 94);
    /* 造型松 / 石桌凳 / 石灯 / 灌木 */
    plantTree(-16.4, -3.4, 0.75, 95);
    stoneTableSet(-17.2, 3.4);
    lantern(-23.4, -3.6);
    var m = new THREE.Mesh(blobGeo(0.5, 0.2, 0.75, 96), M.leaf);
    m.position.set(-23.6, 0.35, 1.4); m.castShadow = m.receiveShadow = true;
    S.scene.add(m);
    bambooClump(-24.2, 4.4, 203, S.scene, 0.85);
  }

  /* ---------- 荷池庭院：10×8m 天然驳岸大荷池（两侧小厅已取消），四周围栏，南岸门楼 ---------- */
  function buildHechiCourt() {
    /* 大荷池：椭圆水面 + 驳岸石 + 莲叶（pond 自带） */
    pond(21, 11, 5.0, 4.0, 96);
    /* 四周围栏（全院统一），南岸留门楼口 */
    fenceRun(15.5, 5.9, 26.5, 5.9);
    fenceRun(15.5, 17, 19.6, 17);
    fenceRun(22.4, 17, 26.5, 17);
    fenceRun(15.5, 5.9, 15.5, 17);
    fenceRun(26.5, 5.9, 26.5, 17);
    /* 池西北岸山石组 */
    rockery(16.8, 7.6, 0.9, 97);
    /* 南岸门楼（保留）：双柱 + 门额 + 瓦顶 + 匾 + 门前台阶 + 石灯 */
    box(1.0, 3.4, 1.0, M.stone, 20.2, 1.7, 17);
    box(1.0, 3.4, 1.0, M.stone, 21.8, 1.7, 17);
    box(2.6, 1.0, 0.5, M.paper, 21, 3.6, 17);
    hipRoof(4.4, 2.2, 0.9, 21, 4.2, 17);
    plaque('荷池庭院', 2.0, 21, 3.5, 17.62, 0);
    box(3.2, 0.3, 0.9, M.stone, 21, 0.15, 17.7);
    box(3.2, 0.2, 0.6, M.stone, 21, 0.1, 18.35);
    box(3.2, 0.1, 0.4, M.stone, 21, 0.05, 18.8);
    lantern(19.2, 15.6); lantern(22.8, 15.6);
  }

  /* ---------- 兰竹庭院（6×4m 内院 + 南侧 6m 门厅，x 28~38, z -4~6） ---------- */
  function buildLanzhuCourt() {
    /* 南侧门厅（6m 宽 3m 深，墙 4m 高带月洞窗；后门已随全园后门一并撤除，内院隔栏观赏） */
    buildHall(33, 4.4, 6, 3, 'S', '兰竹');
    /* 内院：x 30~36, z -3~1 */
    var g = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), M.plaza);
    g.rotation.x = -Math.PI / 2; g.position.set(33, 0.045, -1); g.receiveShadow = true;
    S.scene.add(g);
    /* 内院三面改透空围栏（望柱莲珠头 + 双横杆），竹石越栏可见 */
    fenceRun(30, -3, 36, -3);
    fenceRun(30, -3, 30, 1);
    fenceRun(36, -3, 36, 1);
    /* 竹丛三簇 + 兰花景石两组 + 假山石 */
    bambooClump(31, -1.8, 211, S.scene, 0.8);
    bambooClump(35, -1.6, 212, S.scene, 0.8);
    bambooClump(33, 0.2, 213, S.scene, 0.7);
    rock(34.6, 0.12, -0.4, 0.5, 0.42, 1.0, 97);
    box(1.6, 0.28, 1.0, M.leaf, 31.2, 0.14, 0.2);
    box(1.4, 0.26, 0.9, M.leaf, 34.8, 0.13, -2.2);
    lantern(30.8, 0.8);
  }

  /* ---------- 景观庭院（4m 宽 × 6m 长窄院，x 11.5~15.5, z -15~-9） ---------- */
  /* 扩至 x 11.5~18 × z -15~-7（约 6.5×8m），北门楼拆除，南北留敞口，
     影壁题刻墙南移到底，东半部添石桌凳与石树小景 */
  function buildJingguanCourt() {
    /* 四面透空围栏：北、南各留 1.4m 敞口（无门楼，径直出入） */
    fenceRun(11.5, -15, 12.8, -15);
    fenceRun(14.2, -15, 18, -15);
    fenceRun(11.5, -7, 15.2, -7);   /* 南口东移（15.2~16.8），避开影壁轴线 */
    fenceRun(16.8, -7, 18, -7);
    fenceRun(11.5, -15, 11.5, -7);
    fenceRun(18, -15, 18, -7);
    bambooClump(12.3, -11.7, 221, S.scene, 0.7);
    /* 北口门槛石：过栏即上东长廊地板，西行直抵中心庭 */
    box(1.8, 0.07, 0.5, M.stoneDark, 13.5, 0.045, -14.92);
    /* 青石铺地满铺 */
    var g = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 7.6), M.plaza);
    g.rotation.x = -Math.PI / 2; g.position.set(14.75, 0.05, -11); g.receiveShadow = true;
    S.scene.add(g);
    /* 影壁题刻墙（南端正对北敞口）：青石面板竖排题「清泉石上流」，朝北迎客 */
    box(2.0, 2.4, 0.24, M.paper, 13.5, 1.5, -7.7);
    box(2.2, 0.12, 0.34, M.ink, 13.5, 2.66, -7.7);
    box(2.3, 0.14, 0.5, M.tile, 13.5, 2.8, -7.7);
    box(1.06, 1.46, 0.06, M.ink, 13.5, 1.45, -7.84);
    var tk = document.createElement('canvas'); tk.width = 96; tk.height = 128;
    var tc = tk.getContext('2d');
    tc.fillStyle = '#26241f'; tc.fillRect(0, 0, 96, 128);
    tc.strokeStyle = '#8a8478'; tc.lineWidth = 3; tc.strokeRect(4, 4, 88, 120);
    tc.fillStyle = '#e8e2d2'; tc.font = '30px "Songti SC","STSong","SimSun",serif';
    tc.textAlign = 'center'; tc.textBaseline = 'middle';
    var verse = '清泉石上流', vi;
    for (vi = 0; vi < verse.length; vi++) tc.fillText(verse[vi], 48, 20 + vi * 22);
    var tt = new THREE.CanvasTexture(tk); tt.encoding = THREE.sRGBEncoding;
    var tp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshBasicMaterial({ map: tt }));
    tp.position.set(13.5, 1.45, -7.88); tp.rotation.y = Math.PI; S.scene.add(tp);
    /* 西半原景：假山石 + 主树 + 竹 + 石灯 */
    rock(12.4, 0.25, -10.4, 0.7, 0.48, 1.5, 98);
    plantTree(14.7, -13.3, 0.55, 99);
    bambooClump(12.2, -13.8, 220, S.scene, 0.7);
    lantern(14.8, -10.2);
    /* 东半新景：石桌凳 + 姿态树 + 配石 + 石灯 */
    stoneTableSet(16.3, -9.0);
    plantTree(16.7, -13.6, 0.7, 226);
    rock(16.5, 0.16, -12.3, 0.5, 0.42, 1.0, 224);
    lantern(16.9, -14.2);
  }

  /* ---------- 间隙花园 ---------- */
  function pocket(cx, cz, w, d, seed, noWest) {
    box(w, 0.45, 0.35, M.leaf, cx, 0.22, cz - d / 2);
    box(w, 0.45, 0.35, M.leaf, cx, 0.22, cz + d / 2);
    if (!noWest) box(0.35, 0.45, d, M.leaf, cx - w / 2, 0.22, cz);
    box(0.35, 0.45, d, M.leaf, cx + w / 2, 0.22, cz);
    plantTree(cx - w * 0.22, cz - d * 0.15, 0.8, seed);
    if (w > 12) plantTree(cx + w * 0.25, cz + d * 0.2, 0.7, seed + 3);
    rock(cx + w * 0.18, 0.12, cz - d * 0.22, 0.55, 0.4, 0.85, seed + 5);
    var m = new THREE.Mesh(blobGeo(0.5, 0.2, 0.75, seed + 9), M.leaf);
    m.position.set(cx - w * 0.3, 0.35, cz + d * 0.25);
    m.castShadow = m.receiveShadow = true;
    S.scene.add(m);
  }
  function buildPocketGardens() {
    pocket(-21, 23.8, 18, 6.4, 301);   // 南花园西廊北侧，整体南移让出廊道
    pocket(18, 30.6, 13, 4.6, 302);    // 南花园东廊北侧，让出廊道
    /* 圈选清理：北侧四处附属口袋庭院已撤除。 */
    pocket(-41, 1.5, 5, 11, 307);
  }

  /* ---------- 自然水池：椭圆水面 + 深色池底 + 驳岸石一圈 + 莲叶 ---------- */
  function pond(cx, cz, rx, rz, seed) {
    var s = seed >>> 0, i;
    var bed = new THREE.Mesh(new THREE.CircleGeometry(1, 28), M.ink);
    bed.rotation.x = -Math.PI / 2; bed.scale.set(rx * 1.04, rz * 1.04, 1);
    bed.position.set(cx, -0.14, cz); S.scene.add(bed);
    var w = new THREE.Mesh(new THREE.CircleGeometry(1, 28), M.water);
    w.rotation.x = -Math.PI / 2; w.scale.set(rx, rz, 1);
    w.position.set(cx, 0.06, cz); w.receiveShadow = true; S.scene.add(w);
    /* 驳岸：池缘一圈天然石 */
    var n = Math.max(12, Math.round((rx + rz) * 3.6));
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      s = (s * 1664525 + 1013904223) >>> 0;
      var rr = 0.2 + (s % 100) / 100 * 0.15;
      var st = new THREE.Mesh(blobGeo(rr, 0.3, 0.62, seed + i), M.rock);
      st.position.set(cx + Math.cos(a) * (rx + 0.12), rr * 0.32, cz + Math.sin(a) * (rz + 0.12));
      st.rotation.y = a * 2.3;
      st.castShadow = st.receiveShadow = true;
      S.scene.add(st);
    }
    for (i = 0; i < 4; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      lotus(cx + ((s % 100) / 100 - 0.5) * rx * 1.1,
            cz + ((s % 97) / 97 - 0.5) * rz * 1.1, 0.22 + (s % 50) / 500);
    }
  }

  /* ---------- 中央自然曲池：非规则池岸，较普通椭圆更有园林水面延展感 ---------- */
  function irregularPond(cx, cz, rx, rz, seed) {
    var s = seed >>> 0, i, n = 32, points = [], bedPoints = [], shore = [];
    /* 池岸以轻微不等的半径起伏，北侧稍收、南侧舒展，避免规则椭圆的生硬轮廓。 */
    function radiusAt(a) {
      return 0.95 + 0.075 * Math.sin(a * 3 + 0.6) + 0.045 * Math.sin(a * 5 - 0.9);
    }
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var r = radiusAt(a), x = Math.cos(a) * rx * r, z = Math.sin(a) * rz * r;
      points.push(new THREE.Vector2(x, -z));
      bedPoints.push(new THREE.Vector2(x * 1.035, -z * 1.05));
      shore.push({ a: a, r: r });
    }
    var bedShape = new THREE.Shape(bedPoints);
    var bed = new THREE.Mesh(new THREE.ShapeGeometry(bedShape), M.ink);
    bed.rotation.x = -Math.PI / 2; bed.position.set(cx, -0.14, cz); S.scene.add(bed);
    var waterShape = new THREE.Shape(points);
    var water = new THREE.Mesh(new THREE.ShapeGeometry(waterShape), M.water);
    water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.06, cz); water.receiveShadow = true; S.scene.add(water);
    /* 变长驳岸石顺池岸排布，仍完全落在中央院子内。 */
    var stones = Math.max(18, Math.round((rx + rz) * 3.9));
    for (i = 0; i < stones; i++) {
      var t = i / stones * n, k0 = Math.floor(t) % n, k1 = (k0 + 1) % n, f = t - Math.floor(t);
      var rr0 = shore[k0].r + (shore[k1].r - shore[k0].r) * f;
      var aa = i / stones * Math.PI * 2;
      s = (s * 1664525 + 1013904223) >>> 0;
      var sr = 0.19 + (s % 100) / 100 * 0.15;
      var st = new THREE.Mesh(blobGeo(sr, 0.28, 0.62, seed + i), M.rock);
      st.position.set(cx + Math.cos(aa) * (rx * rr0 + 0.14), sr * 0.31,
        cz + Math.sin(aa) * (rz * rr0 + 0.14));
      st.rotation.y = aa * 2.3; st.castShadow = st.receiveShadow = true; S.scene.add(st);
    }
    for (i = 0; i < 6; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      lotus(cx + ((s % 100) / 100 - 0.5) * rx * 1.15,
        cz + ((s % 97) / 97 - 0.5) * rz * 1.05, 0.22 + (s % 50) / 500);
    }
  }

  /* ---------- 旱景石床（枯山水式：碎石浅床 + 沿边自然石一圈 + 床内立石组） ---------- */
  function dryBed(cx, cz, rx, rz, seed) {
    var s = seed >>> 0, i;
    var bed = new THREE.Mesh(new THREE.CircleGeometry(1, 28), M.gravel);
    bed.rotation.x = -Math.PI / 2; bed.scale.set(rx, rz, 1);
    bed.position.set(cx, 0.035, cz); bed.receiveShadow = true; S.scene.add(bed);
    var n = Math.max(12, Math.round((rx + rz) * 3.2));
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      s = (s * 1664525 + 1013904223) >>> 0;
      var rr = 0.2 + (s % 100) / 100 * 0.15;
      var st = new THREE.Mesh(blobGeo(rr, 0.3, 0.62, seed + i), M.rock);
      st.position.set(cx + Math.cos(a) * (rx + 0.1), rr * 0.32, cz + Math.sin(a) * (rz + 0.1));
      st.rotation.y = a * 2.3;
      st.castShadow = st.receiveShadow = true;
      S.scene.add(st);
    }
    rock(cx - rx * 0.25, 0.16, cz - rz * 0.2, 0.5, 0.45, 1.1, seed + 40);
    rock(cx + rx * 0.3, 0.1, cz + rz * 0.25, 0.36, 0.4, 0.9, seed + 41);
    rock(cx + rx * 0.05, 0.07, cz - rz * 0.42, 0.28, 0.38, 0.8, seed + 42);
  }

  /* ---------- 筒车水院（按王祯《农书》筒车形制） ----------
     双排辐条大立轮 + 轮周受水板 + 斜系竹水筒 + 叉桩木架 + 高架木槽：
     轮下半浸于池，水推受水板驱车缓转，水筒升水过顶倾入木槽，槽尾泻回池中成循环 */
  function waterwheel(x, z) {
    var g = new THREE.Group(); g.position.set(x, 0, z); S.scene.add(g);
    /* 涟漪水面 / 池底 / 泡沫 / 泻水帘材质（同心波纹贴图在主循环缓慢旋转） */
    if (!M.waterRipple) {
      M.poolBed = new THREE.MeshPhongMaterial({ color: C(0x2e4a4e), shininess: 60, specular: new THREE.Color(0x9fc4c8) });
      M.foam = new THREE.MeshBasicMaterial({ color: C(0xf2fafc), transparent: true, opacity: 0.5, depthWrite: false });
      M.waterJet = new THREE.MeshPhongMaterial({
        color: C(0xa8cede), transparent: true, opacity: 0.5,
        shininess: 150, specular: new THREE.Color(0xe8f4f8), side: THREE.DoubleSide, depthWrite: false
      });
      var rc = document.createElement('canvas'); rc.width = rc.height = 256;
      var rx = rc.getContext('2d');
      rx.fillStyle = '#3d6a72'; rx.fillRect(0, 0, 256, 256);
      var ri;
      for (ri = 0; ri < 26; ri++) {
        rx.beginPath();
        rx.arc(128, 128, 6 + ri * 5.2, 0, Math.PI * 2);
        rx.strokeStyle = ri % 2 ? 'rgba(190,226,232,0.20)' : 'rgba(24,48,54,0.22)';
        rx.lineWidth = 2.2;
        rx.stroke();
      }
      var rt = new THREE.CanvasTexture(rc);
      rt.center.set(0.5, 0.5);
      M.waterRipple = new THREE.MeshPhongMaterial({
        color: C(0x9fc8d2), map: rt, transparent: true, opacity: 0.88,
        shininess: 160, specular: new THREE.Color(0xd8eef2)
      });
      S.rippleTex = rt;
    }
    /* 石砌长方池（内净 3.6×2.0m，轮下半浸于池中）：条石池壁 + 深色压顶 + 暗底 + 涟漪水面 */
    box(4.6, 0.6, 0.5, M.stone, 0, 0.3, -1.25, 0, g);
    box(4.6, 0.6, 0.5, M.stone, 0, 0.3, 1.25, 0, g);
    box(0.5, 0.6, 2.0, M.stone, -2.05, 0.3, 0, 0, g);
    box(0.5, 0.6, 2.0, M.stone, 2.05, 0.3, 0, 0, g);
    box(4.72, 0.12, 0.62, M.stoneDark, 0, 0.66, -1.25, 0, g);
    box(4.72, 0.12, 0.62, M.stoneDark, 0, 0.66, 1.25, 0, g);
    box(0.62, 0.12, 2.0, M.stoneDark, -2.05, 0.66, 0, 0, g);
    box(0.62, 0.12, 2.0, M.stoneDark, 2.05, 0.66, 0, 0, g);
    var bed = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), M.poolBed);
    bed.rotation.x = -Math.PI / 2; bed.position.y = 0.08; g.add(bed);
    var wat = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), M.waterRipple);
    wat.rotation.x = -Math.PI / 2; wat.position.y = 0.45; g.add(wat);
    /* 叉桩木架（池内两对，石墩立足）：斜柱合十承轴，柱间横枨 */
    var fs, fz = [-0.75, 0.75];
    for (fs = 0; fs < 2; fs++) {
      box(0.42, 0.5, 0.42, M.stoneDark, -0.55, 0.25, fz[fs], 0, g);
      box(0.42, 0.5, 0.42, M.stoneDark, 0.55, 0.25, fz[fs], 0, g);
      var p1 = cyl(0.07, 0.09, 1.95, 8, M.wood, -0.31, 1.05, fz[fs], g); p1.rotation.z = 0.30;
      var p2 = cyl(0.07, 0.09, 1.95, 8, M.wood, 0.31, 1.05, fz[fs], g); p2.rotation.z = -0.30;
      box(1.0, 0.1, 0.12, M.wood, 0, 0.95, fz[fs], 0, g);
    }
    /* 粗木轮轴（合抱轴，横穿两架） */
    var axle = cyl(0.08, 0.08, 2.3, 10, M.wood, 0, 1.75, 0, g); axle.rotation.x = Math.PI / 2;
    /* 大立轮（直径 3m，轴心 1.75，轮底 0.25 浸水 0.2m）：双外弦 + 十二辐 + 受水板 + 斜系水筒 */
    var wg = new THREE.Group(); wg.position.set(0, 1.75, 0); g.add(wg);
    var hub = cyl(0.13, 0.13, 0.9, 10, M.wood, 0, 0, 0, wg); hub.rotation.x = Math.PI / 2;
    var rimZ = [-0.26, 0.26], ri3, si3;
    for (ri3 = 0; ri3 < 2; ri3++) {
      var rim = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 8, 40), M.wood);
      rim.position.z = rimZ[ri3]; rim.castShadow = true; wg.add(rim);
      for (si3 = 0; si3 < 6; si3++) {
        var sp = cyl(0.035, 0.035, 2.84, 6, M.wood, 0, 0, rimZ[ri3], wg);
        sp.rotation.z = si3 * Math.PI / 6;
      }
    }
    var ti3;
    for (ti3 = 0; ti3 < 12; ti3++) {
      var pv = new THREE.Group(); pv.rotation.z = ti3 * Math.PI / 6; wg.add(pv);
      box(0.3, 0.04, 0.56, M.wood, 0, 1.45, 0, 0, pv);              /* 受水板（隔板装斗） */
      if (ti3 % 2 === 0) {
        var tube = cyl(0.045, 0.045, 0.55, 6, M.gualuo, 0, 1.5, 0, pv);  /* 斜系竹水筒 */
        tube.rotation.x = Math.PI / 2 - 0.35;
      }
    }
    /* 高架木槽（笕）：轮顶接水，顺坡南泻回池 */
    var tg = new THREE.Group(); tg.position.set(0, 2.85, 0.6); tg.rotation.x = 0.12; g.add(tg);
    box(0.36, 0.05, 0.85, M.wood, 0, 0, 0, 0, tg);
    box(0.04, 0.13, 0.85, M.wood, -0.16, 0.07, 0, 0, tg);
    box(0.04, 0.13, 0.85, M.wood, 0.16, 0.07, 0, 0, tg);
    box(0.28, 0.03, 0.8, M.waterJet, 0, 0.06, 0, 0, tg);
    cyl(0.05, 0.06, 2.9, 6, M.wood, 0, 1.45, 0.3, g);
    cyl(0.05, 0.06, 2.72, 6, M.wood, 0, 1.36, 0.92, g);
    /* 槽尾泻水帘 + 落水泡沫 + 轮底/落点涟漪（主循环驱动） */
    box(0.09, 2.3, 0.05, M.waterJet, 0, 1.62, 1.0, 0, g);
    var foamDip = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), M.foam);
    foamDip.rotation.x = Math.PI / 2; foamDip.position.set(0, 0.47, 0); g.add(foamDip);
    var foamSpill = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 20), M.foam);
    foamSpill.rotation.x = Math.PI / 2; foamSpill.position.set(0, 0.48, 0.95); g.add(foamSpill);
    var ripples = [], rl;
    for (rl = 0; rl < 2; rl++) {
      var rm = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.02, 6, 36),
        new THREE.MeshBasicMaterial({ color: C(0xd8eef2), transparent: true, opacity: 0.3, depthWrite: false }));
      rm.rotation.x = Math.PI / 2;
      rm.position.set(0, 0.47, rl === 0 ? 0 : 0.95);
      g.add(rm); ripples.push(rm);
    }
    S.anims.push({ wheel: wg, foam: [foamDip, foamSpill], ripples: ripples, phase: (x * 7 + z * 13) % 6 });
    return g;
  }

  /* ---------- 山石小品：主石 + 双配石 + 灌木收脚 ---------- */
  function rockery(cx, cz, s2, seed) {
    rock(cx, 0.2 * s2, cz, 0.7 * s2, 0.5, 1.4, seed);
    rock(cx + 0.95 * s2, 0.1, cz + 0.5 * s2, 0.45 * s2, 0.45, 1.1, seed + 1);
    rock(cx - 0.85 * s2, 0.08, cz + 0.42 * s2, 0.38 * s2, 0.4, 0.9, seed + 2);
    shrub(cx + 0.4 * s2, cz - 0.95 * s2, 0.48, seed + 3);
    shrub(cx - 1.1 * s2, cz - 0.55 * s2, 0.4, seed + 4);
  }

  /* ---------- 山谷园林台地：园区落在谷底，四周缓坡向外抬升 ---------- */
  function valleySlope(x0, z0, x1, z1, ox0, oz0, ox1, oz1, h0, h1, mat) {
    var seg = 18, pos = [], idx = [], i;
    for (i = 0; i <= seg; i++) {
      var t = i / seg;
      var ix = x0 + (x1 - x0) * t, iz = z0 + (z1 - z0) * t;
      var bx = ox0 + (ox1 - ox0) * t, bz = oz0 + (oz1 - oz0) * t;
      var hh = h0 + (h1 - h0) * t;
      pos.push(ix, 0.02, iz, bx, hh, bz, bx, -0.04, bz);
    }
    for (i = 0; i < seg; i++) {
      var a = i * 3, b = a + 3;
      idx.push(a, b, a + 1, b, b + 1, a + 1);       // 斜坡面
      idx.push(a + 1, b + 1, a + 2, b + 1, b + 2, a + 2); // 外侧土壁
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    var m = new THREE.Mesh(g, mat || M.valley);
    m.castShadow = false; m.receiveShadow = true; S.scene.add(m);
    return m;
  }

  function buildValleyTerraces() {
    /* 内缘贴着园区围墙外侧，外缘抬高；南侧留出谷口，不做封闭山顶。 */
    valleySlope(-52, 43, 52, 43, -88, 78, 88, 78, 8.5, 10.5, M.valley);
    valleySlope(-52, -43, -22, -43, -84, -72, -30, -72, 5.0, 6.5, M.valley);
    valleySlope(22, -43, 52, -43, 30, -72, 84, -72, 6.5, 5.0, M.valley);
    valleySlope(-52, -43, -52, 43, -82, -72, -84, 76, 7.5, 10.0, M.valley);
    valleySlope(52, 43, 52, -43, 84, 76, 82, -72, 10.0, 7.5, M.valley);

    /* 分层石坎，让高差读成山谷园林台地而不是一圈平板。 */
    wallRun(-62, 55, 62, 55, 0.8, 0.7);
    wallRun(-62, -55, -22, -55, 0.6, 0.65);
    wallRun(22, -55, 62, -55, 0.6, 0.65);
    wallRun(-62, -55, -62, 55, 0.8, 0.7);
    wallRun(62, 55, 62, -55, 0.8, 0.7);

    /* 远处山石、松树与小溪，控制在园区外，避免遮挡展厅。 */
    rockery(-72, 67, 2.8, 1301); rockery(72, 68, 2.7, 1302);
    rockery(-72, -63, 2.4, 1303); rockery(72, -64, 2.5, 1304);
    plantTree(-76, 70, 1.8, 1311); plantTree(-60, 72, 1.35, 1312);
    plantTree(76, 70, 1.8, 1313); plantTree(60, 72, 1.35, 1314);
    plantTree(-76, -66, 1.6, 1315); plantTree(76, -66, 1.6, 1316);

    /* 低模山坡体：山体放在围墙外，中心留出开阔谷口，避免像孤立山顶。 */
    function hill(x, z, sx, sy, sz, seed) {
      var h = new THREE.Mesh(blobGeo(1, 0.22, 1.0, seed), M.valleyHill);
      h.position.set(x, sy * 0.55 - 0.05, z);
      h.scale.set(sx, sy, sz);
      h.castShadow = false; h.receiveShadow = true; S.scene.add(h);
    }
    /* 旧的近距离圆包山体会遮挡门楼和展厅，暂不生成；远山改由下面的山脊背景承担。 */

    /*
     * 远山山谷背景：用连续的低模山脊替代孤立圆包。
     * 山脊只放在园区外，底部压到地面以下，不参与碰撞；前后两层颜色
     * 逐渐变淡，配合雾效形成“山谷中的园林台地”纵深。中轴方向留出谷口。
     */
    function ridge(points, z, depth, mat) {
      var pos = [], idx = [], i, n = points.length;
      /* 远景改成薄纸片布景：保留山形剪影，去掉厚重低模山体。 */
      var paperDepth = 0.04;
      for (i = 0; i < n; i++) pos.push(points[i][0], points[i][1], z - paperDepth / 2);
      for (i = 0; i < n; i++) pos.push(points[i][0], points[i][1], z + paperDepth / 2);
      for (i = 0; i < n - 1; i++) {
        idx.push(i, i + 1, n + i + 1, i, n + i + 1, n + i);
      }
      for (i = 0; i < n - 1; i++) {
        idx.push(i, n + i, n + i + 1, i, n + i + 1, i + 1);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      var m = new THREE.Mesh(g, mat);
      if (m.material) m.material.side = THREE.DoubleSide;
      m.castShadow = false; m.receiveShadow = false; S.scene.add(m);
      return m;
    }
    var nearRidge = [
      [-112, 0], [-100, 8], [-88, 16], [-76, 10], [-64, 22], [-52, 13],
      [-38, 28], [-24, 17], [-10, 24], [0, 12], [10, 24], [24, 17],
      [38, 28], [52, 13], [64, 22], [76, 10], [88, 16], [100, 8], [112, 0]
    ];
    var farRidge = [
      [-124, 4], [-108, 18], [-92, 25], [-76, 20], [-58, 36], [-42, 24],
      [-22, 42], [-8, 31], [0, 22], [8, 31], [22, 42], [42, 24],
      [58, 36], [76, 20], [92, 25], [108, 18], [124, 4]
    ];
    /* 旧的程序化三角山脊已撤除。真实山景纸片会在下面按远、中、近三层生成，
       避免白色低模剪影露出来破坏远景。 */

    /* 多张独立纸片远景：山形卡片在后，树形卡片在中前景。
     * 每棵树都是独立的平面实体，按 z 分层后从第一视角叠成山林，而不是一张整图。 */
    function paperMountain(points, z, texture, scale) {
      var minX = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < points.length; i++) {
        minX = Math.min(minX, points[i][0]); maxX = Math.max(maxX, points[i][0]);
        maxY = Math.max(maxY, points[i][1]);
      }
      /* 用山脊轮廓本身做 ShapeGeometry，彻底去掉照片天空的矩形底。 */
      var shape = new THREE.Shape();
      shape.moveTo(points[0][0] * (scale || 1), 0);
      for (var si = 0; si < points.length; si++) {
        shape.lineTo(points[si][0] * (scale || 1), points[si][1] * (scale || 1));
      }
      shape.lineTo(points[points.length - 1][0] * (scale || 1), 0);
      shape.closePath();
      var geo = new THREE.ShapeGeometry(shape);
      var mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: false, fog: true })
      );
      mesh.position.set(0, 0, z);
      mesh.rotation.y = arguments.length > 4 ? (arguments[4] || 0) : 0;
      mesh.name = 'paper-mountain-card';
      S.scene.add(mesh);
      return mesh;
    }
    function paperTree(x, z, h, color, variant) {
      var file = variant === 1 ? 'fir-tree-card.png' : 'tree-card.png';
      new THREE.TextureLoader().load('assets/images/paper-cards/' + file, function (tex) {
        tex.encoding = THREE.sRGBEncoding;
        var mat = new THREE.SpriteMaterial({
          map: tex,
          color: 0xffffff,
          transparent: true,
          alphaTest: 0.04,
          depthWrite: false,
          fog: true
        });
        var tree = new THREE.Sprite(mat);
        tree.position.set(x, h * 0.5, z);
        tree.scale.set(h * 0.72, h, 1);
        tree.name = 'paper-tree-card';
        S.scene.add(tree);
      });
    }
    new THREE.TextureLoader().load('assets/images/mountain-real.jpg', function (mountainTex) {
      /* 直接把原图下半部裁成独立纹理，避免 WebGL UV 上下方向差异把天空贴进山峰。 */
      var src = mountainTex.image;
      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = 1024; cropCanvas.height = 512;
      var cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(src, 0, src.height * 0.42, src.width, src.height * 0.58, 0, 0, 1024, 512);
      var pixels = cropCtx.getImageData(0, 0, 1024, 512);
      for (var p = 0; p < pixels.data.length; p += 4) {
        var rr = pixels.data[p], gg = pixels.data[p + 1], bb = pixels.data[p + 2];
        /* 山体是深灰蓝，天空是明亮偏蓝；只抠除天空，不切掉山脊纹理。 */
        if (rr > 150 && gg > 155 && bb > 160 && bb >= rr * 0.96) pixels.data[p + 3] = 0;
      }
      cropCtx.putImageData(pixels, 0, 0);
      mountainTex = new THREE.CanvasTexture(cropCanvas);
      mountainTex.encoding = THREE.sRGBEncoding;
      mountainTex.wrapS = mountainTex.wrapT = THREE.ClampToEdgeWrapping;
      paperMountain([[-115, 0], [-102, 7], [-94, 13], [-84, 10], [-76, 7], [-65, 16], [-53, 25], [-43, 17], [-31, 9], [-18, 20], [-4, 29], [10, 20], [22, 10], [35, 17], [49, 24], [60, 15], [73, 8], [84, 13], [98, 16], [108, 7], [115, 0]], -76, mountainTex, 1.0);
      paperMountain([[-120, 0], [-108, 10], [-95, 18], [-82, 14], [-65, 11], [-52, 23], [-38, 34], [-25, 22], [-8, 16], [6, 24], [20, 30], [36, 20], [52, 12], [67, 18], [82, 25], [101, 13], [120, 0]], -88, mountainTex, 0.92);
      paperMountain([[-118, 0], [-101, 8], [-87, 15], [-70, 11], [-54, 21], [-39, 17], [-25, 27], [-9, 19], [8, 26], [23, 16], [41, 23], [58, 13], [76, 20], [94, 10], [118, 0]], -101, mountainTex, 0.86);
      /* 四面环景：北/南两面 + 东/西两面，旋转后仍保持远山连续。 */
      paperMountain([[-115, 0], [-96, 12], [-74, 8], [-54, 22], [-31, 13], [-8, 28], [14, 18], [38, 26], [62, 12], [86, 20], [115, 0]], 76, mountainTex, 0.98);
      paperMountain([[-120, 0], [-98, 9], [-76, 22], [-52, 14], [-29, 30], [-4, 18], [21, 27], [46, 13], [72, 23], [98, 10], [120, 0]], 90, mountainTex, 0.90);
      var east = paperMountain([[-105, 0], [-84, 13], [-63, 9], [-43, 23], [-18, 16], [5, 29], [29, 18], [53, 25], [79, 11], [105, 0]], 0, mountainTex, 0.90, Math.PI / 2);
      east.position.x = 82; east.position.z = 0;
      var west = paperMountain([[-105, 0], [-84, 10], [-61, 21], [-38, 14], [-14, 27], [10, 17], [33, 24], [57, 12], [82, 19], [105, 0]], 0, mountainTex, 0.84, Math.PI / 2);
      west.position.x = -82; west.position.z = 0;
    });
    /* 山顶云雾：独立的柔边 2D 云层，压在山片上方而不是画进同一张背景图。 */
    var cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256; cloudCanvas.height = 96;
    var cloudCtx = cloudCanvas.getContext('2d');
    var cloudGrad = cloudCtx.createRadialGradient(128, 48, 8, 128, 48, 116);
    cloudGrad.addColorStop(0, 'rgba(255,255,255,0.92)');
    cloudGrad.addColorStop(0.55, 'rgba(235,244,247,0.58)');
    cloudGrad.addColorStop(1, 'rgba(255,255,255,0)');
    cloudCtx.fillStyle = cloudGrad; cloudCtx.fillRect(0, 0, 256, 96);
    var cloudTex = new THREE.CanvasTexture(cloudCanvas);
    [[-70, -68, 28, 7], [-43, -75, 36, 9], [-10, -70, 30, 8], [22, -78, 42, 10], [61, -69, 34, 8], [94, -76, 27, 7]].forEach(function (c, ci) {
      var cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.86, fog: true }));
      cloud.position.set(c[0], c[3] + 20 + (ci % 2) * 2.2, c[1] + 1.5);
      cloud.scale.set(c[2], c[3], 1);
      cloud.name = 'paper-mountain-mist';
      S.scene.add(cloud);
    });
    [[-64, 78, 31, 7], [-25, 86, 38, 9], [18, 80, 34, 8], [58, 88, 42, 10], [-78, 0, 30, 7], [82, 0, 36, 8]].forEach(function (c, ci) {
      var cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.78, fog: true }));
      cloud.position.set(c[0], c[3] + 20 + (ci % 2) * 2.2, c[1]);
      cloud.scale.set(c[2], c[3], 1);
      cloud.name = 'paper-mountain-mist';
      S.scene.add(cloud);
    });
    var treeCards = [
      [-96, -69, 9.5, 0x45564a, 0], [-82, -67, 7.0, 0x536452, 1], [-68, -64, 11.5, 0x3f5145, 0],
      [-51, -66, 6.5, 0x68715a, 1], [-34, -63, 9.0, 0x4c5d4e, 0], [-18, -67, 7.2, 0x68715a, 1],
      [18, -67, 8.4, 0x536452, 0], [35, -64, 10.8, 0x3f5145, 1], [53, -66, 6.7, 0x68715a, 0],
      [70, -63, 9.7, 0x4c5d4e, 1], [86, -67, 7.3, 0x536452, 0], [101, -69, 10.2, 0x45564a, 1]
    ];
    for (var ti = 0; ti < treeCards.length; ti++) paperTree(treeCards[ti][0], treeCards[ti][1], treeCards[ti][2], treeCards[ti][3], treeCards[ti][4]);
    /* 四周树卡：远景不是一张背景图，而是环绕相机的独立实体。 */
    for (var tj = 0; tj < treeCards.length; tj++) {
      paperTree(treeCards[tj][0], -treeCards[tj][1], treeCards[tj][2] * 0.92, treeCards[tj][3], treeCards[tj][4]);
      paperTree(-treeCards[tj][1], treeCards[tj][0], treeCards[tj][2] * 0.86, treeCards[tj][3], treeCards[tj][4]);
      paperTree(treeCards[tj][1], treeCards[tj][0], treeCards[tj][2] * 0.82, treeCards[tj][3], treeCards[tj][4]);
    }
  }

  /* ---------- 空旷草地填充：西北枯山水回廊院 / 东北石景 / 西南与东南沿墙山水带（水景收进中心庭院，边缘不再设池） ---------- */
  function buildLandscapeFill() {
    /* 圈选清理：西北枯山水回廊院及东北附属石景均已撤除。 */
    /* 西南沿墙：大石组两处（与竹丛带错落；北侧石组让开山水馆西墙） */
    rockery(-47.5, 4, 1.15, 613);
    rockery(-47.3, 24, 1.05, 623);
    /* 东南沿墙：石组 + 乔木（原狭长水池已撤） */
    rockery(45.2, 12.5, 1.1, 614);
    plantTree(44.6, 24.5, 1.05, 624);
  }

  /* ---------- 草坪与沿墙树阵 ---------- */
  function buildGreenery() {
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.lawn);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    S.scene.add(ground);
    buildValleyTerraces();
    /* 古镇式青砖满铺：主通道与广场一律墁地，草坪只留庭院花园与沿墙绿化带 */
    pave(-16, 34.5, 16, 36.8);       /* 正门前广场 */
    pave(-13.5, 22.5, 13.5, 34.5);   /* 序厅台基四周 */
    pave(-9.5, 7.5, 9.5, 22.4);      /* 中轴南院（双廊—影壁） */
    pave(9.5, 18.1, 34.0, 20.9);     /* 书斋西门直达中轴：门中心 (34,19.5)，道路正对门洞 */
    pave(-34.0, 20.1, -9.5, 22.9);   /* 文创东门直达中轴：门中心 (-34,21.5)，道路正对门洞 */
    pave(-9.5, -21, 9.5, -5.5);      /* 中轴北段（中心庭—水榭庭院） */
    pave(-29, -15, -9.5, -10);       /* 西长廊通道（山水馆方向） */
    pave(9.5, -22.4, 38.75, -19.6);  /* 人物南门直达中轴：门中心 (38.75,-21)，道路正对门洞 */
    var x, z;
    for (x = -44; x <= 44; x += 8) {
      if (Math.abs(x) > 9) plantTree(x, -38.2, 0.95, 400 + x);
    }
    for (z = -34; z <= 34; z += 8) {
      plantTree(-48, z, 0.9, 500 + z);
      plantTree(48, z, 0.9, 600 + z);
    }
    plantTree(-15.8, 39.0, 1.1, 701);   /* 前墙外西侧树：外移让开西马头墙（原 -14.5 时树冠咬墙头） */
    plantTree(15.8, 39.0, 1.1, 702);    /* 前墙外东侧树：同理 */
    plantTree(-13, 43.5, 1.0, 703);
    plantTree(13, 43.5, 1.0, 704);
    /* 沿东西墙竹丛带（与乔木错落；山水馆西、人物馆东扩处的两丛贴到外墙根） */
    for (z = -30; z <= 30; z += 12) {
      bambooClump(z === -18 ? -48.2 : -46.2, z + 4, 910 + z, S.scene, 1.25);
      bambooClump(z === -18 ? 48.2 : 46.2, z, 960 + z, S.scene, 1.25);
    }
    /* 水景旁的姿态树（水榭东、荷池南、山石庭院北） */
    plantTree(9.8, 4.5, 1.25, 991);
    plantTree(24.5, 19.6, 1.15, 992);
    plantTree(-14.5, -8.6, 1.1, 993);
  }

  /* =====================================================================
   *  材质初始化 + 总装
   * ===================================================================== */
  function initMaterials() {
    var lawnT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#7d8a63'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 900, ['#728058', '#8a9670', '#687652'], 1.5, 5, 0.25);
    }, 40, 40);
    var gravelT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#b3a892'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 1600, ['#a69b85', '#c0b7a2', '#98917c'], 0.8, 2.2, 0.5);
    }, 8, 8);
    var plazaT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#B9B0A0'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 700, ['#aca393', '#c4bba9'], 1, 3.5, 0.35);
      ctx.strokeStyle = '#8f8676'; ctx.lineWidth = 3;
      var k;
      for (k = 0; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(k * 128, 0); ctx.lineTo(k * 128, s2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, k * 128); ctx.lineTo(s2, k * 128); ctx.stroke();
      }
    }, 5, 5);
    var tileT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#484139'; ctx.fillRect(0, 0, s2, s2);
      var x, y, g2;
      for (x = 0; x < s2; x += 32) {
        g2 = ctx.createLinearGradient(x, 0, x + 32, 0);
        g2.addColorStop(0, '#3a342e'); g2.addColorStop(0.5, '#575046'); g2.addColorStop(1, '#3a342e');
        ctx.fillStyle = g2; ctx.fillRect(x, 0, 32, s2);
      }
      ctx.fillStyle = 'rgba(28,26,23,0.4)';
      for (y = 0; y < s2; y += 64) ctx.fillRect(0, y, s2, 4);
      speckle(ctx, s2, 260, ['#332e28', '#5d564c'], 1, 3, 0.2);
    });
    var plasterT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#EFE9DC'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 320, ['#e3dcc9', '#f5f0e4'], 2, 6, 0.18);
    }, 2, 2);
    var doorT = canvasTex(256, function (ctx, s2) {
      /* 朱漆板门：漆面色差 + 竖拼板缝 + 三道抹头 + 鎏金门钉（门扇纹理纵向约拉伸 2 倍，绘制预压扁 0.5） */
      var lg = ctx.createLinearGradient(0, 0, s2, 0);
      lg.addColorStop(0, '#7e3222'); lg.addColorStop(0.5, '#98422b'); lg.addColorStop(1, '#7e3222');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 260, ['#8c3a26', '#a04a30'], 1, 3, 0.25);
      ctx.strokeStyle = 'rgba(70,26,16,0.5)'; ctx.lineWidth = 2;
      var pi;
      for (pi = 1; pi < 5; pi++) {
        ctx.beginPath(); ctx.moveTo(pi * s2 / 5, 0); ctx.lineTo(pi * s2 / 5, s2); ctx.stroke();
      }
      var rails = [0.08, 0.52, 0.92], ri2;
      ctx.fillStyle = 'rgba(94,34,20,0.85)';
      for (ri2 = 0; ri2 < 3; ri2++) ctx.fillRect(0, rails[ri2] * s2 - 10, s2, 20);
      ctx.strokeStyle = 'rgba(48,17,9,0.8)';
      for (ri2 = 0; ri2 < 3; ri2++) ctx.strokeRect(-2, rails[ri2] * s2 - 10, s2 + 4, 20);
      var a, b;
      for (a = 0; a < 5; a++) for (b = 0; b < 9; b++) {
        ctx.save();
        ctx.translate((a + 0.5) * s2 / 5, (b + 0.5) * s2 / 9);
        ctx.scale(1, 0.5);
        var rg = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 7);
        rg.addColorStop(0, '#f0d489'); rg.addColorStop(0.55, '#c9a24a'); rg.addColorStop(1, '#6e4f1c');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 6.2832); ctx.fill();
        ctx.restore();
      }
    });
    var stoneT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#B9B0A0'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 800, ['#aca393', '#c6bdab', '#9d9484'], 0.8, 2.6, 0.3);
    }, 3, 3);

    /* 青砖错缝贴砖工厂：1.28m 一循环（条砖 0.32×0.16m），按地块尺寸取整 repeat */
    M.brickT = function (rx2, ry2) {
      return canvasTex(256, function (ctx, s2) {
        ctx.fillStyle = '#85847d'; ctx.fillRect(0, 0, s2, s2);
        speckle(ctx, s2, 700, ['#7b7a73', '#908f87', '#6f6e68'], 1, 3, 0.3);
        ctx.strokeStyle = '#5d5c56'; ctx.lineWidth = 2;
        var row, col, bh = 32, bw = 64;
        for (row = 0; row <= s2 / bh; row++) {
          ctx.beginPath(); ctx.moveTo(0, row * bh); ctx.lineTo(s2, row * bh); ctx.stroke();
          var off = (row % 2) * bw / 2;
          for (col = -1; col <= s2 / bw; col++) {
            ctx.beginPath(); ctx.moveTo(col * bw + off, row * bh); ctx.lineTo(col * bw + off, (row + 1) * bh); ctx.stroke();
          }
        }
      }, rx2, ry2);
    };

    M.lawn    = new THREE.MeshLambertMaterial({ map: lawnT });
    M.valley  = new THREE.MeshLambertMaterial({ color: C(0x657653), side: THREE.DoubleSide });
    M.valleyHill = new THREE.MeshLambertMaterial({ color: C(0x536547), side: THREE.DoubleSide });
    M.valleyRidgeNear = new THREE.MeshLambertMaterial({ color: C(0x718675), side: THREE.DoubleSide });
    M.valleyRidgeFar = new THREE.MeshLambertMaterial({ color: C(0x9aaca0), side: THREE.DoubleSide });
    M.gravel  = new THREE.MeshLambertMaterial({ map: gravelT });
    M.plaza   = new THREE.MeshLambertMaterial({ map: plazaT, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.tile    = new THREE.MeshLambertMaterial({ map: tileT, side: THREE.DoubleSide });
    M.paper   = new THREE.MeshLambertMaterial({ map: plasterT });
    var gualuoT = canvasTex(128, function (ctx, s2) {
      ctx.fillStyle = '#6D5544'; ctx.fillRect(0, 0, s2, s2);
      ctx.strokeStyle = '#3d3126'; ctx.lineWidth = 6;
      var k;
      for (k = 10; k < s2; k += 24) {
        ctx.beginPath(); ctx.moveTo(k, 4); ctx.lineTo(k, s2 - 4); ctx.stroke();
      }
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(s2, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 52); ctx.lineTo(s2, 52); ctx.stroke();
      ctx.strokeStyle = '#8a7358'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, s2 - 2, s2 - 2);
    }, 4, 1);
    M.gualuo  = new THREE.MeshLambertMaterial({ map: gualuoT, side: THREE.DoubleSide });
    M.door    = new THREE.MeshLambertMaterial({ map: doorT });
    /* 鎏金铜件：门钉铺首、衔环 */
    M.brass   = new THREE.MeshPhongMaterial({ color: C(0xc9a24a), shininess: 70, specular: new THREE.Color(0x8a6f2a) });
    M.stone   = new THREE.MeshLambertMaterial({ map: stoneT });
    M.stoneDark = new THREE.MeshLambertMaterial({ color: C(0x8f8676) });
    M.wood    = new THREE.MeshLambertMaterial({ color: C(WOOD) });
    /* 望板：屋面内衬深色木板（BackSide 只从檐下可见） */
    M.rafter  = new THREE.MeshLambertMaterial({ color: C(0x4a3a2c), side: THREE.BackSide });
    M.ink     = new THREE.MeshLambertMaterial({ color: C(INK) });
    M.rock    = new THREE.MeshLambertMaterial({ color: C(0x9a948a) });
    M.leaf    = new THREE.MeshLambertMaterial({ color: C(0x5c6a4a) });
    M.bamboo  = new THREE.MeshLambertMaterial({ color: C(0x6f7d4f) });
    M.water   = new THREE.MeshPhongMaterial({
      color: C(0x527a6e), transparent: true, opacity: 0.78,
      shininess: 110, specular: new THREE.Color(0xd8ecf2)
    });
    WATERS.push(M.water);
    M.lampPaper = new THREE.MeshLambertMaterial({
      color: C(PAPER), emissive: C(0xc9a05a), emissiveIntensity: 0.55
    });
    /* 红灯笼纸（微发光，挂在门楼 / 亭榭檐口） */
    M.lampRed = new THREE.MeshLambertMaterial({
      color: C(0xc8432a), emissive: C(0xb03a22), emissiveIntensity: 0.5
    });
  }

  /* ---------- 总装入口 ---------- */
  function build(scene) {
    S.scene = scene;
    initMaterials();
    buildGreenery();
    buildBoundary();
    buildSouthEntry();
    buildXuting();            // 序厅组（22m 宽：14m 中院 + 两侧 4m 侧院）
    /* 北门楼已整体拆除（用户定案 2026-10-05）：北墙拉直 z=-40，不再外凸 */
    buildHuaniao();           // 花鸟 18×15（重檐正房）
    buildShanshui();          // 山水 15×15
    buildRenwu();             // 人物 16×9
    /* 圈选清理：雅集室、景韵轩已撤除。 */
    buildWenchuang();         // 文创 / 临摹（各 10×13，正房 10×5 + 前院）
    buildShuzhaiChashi();     // 书斋 / 茶室（各 8×13，小筑 8×4 + 前院）
    buildZhongxinCourt();     // 中心庭（17×13 广场 + 5×5 内院）
    /* 中央庭院只保留 buildZhongxinCourt() 的大水池；其余旧内院不再装配。 */
    buildAxisScreenWall();    // 序厅后方原无门挡墙（收在双廊内缘之间）
    buildCorridors();         // 游廊系统（中轴双廊 + 东西横廊 + 南花园两廊）
    buildPocketGardens();
    buildLandscapeFill();     // 空旷草地：曲池、曲廊、山石组
    return { waters: WATERS };
  }

  return { build: build, slots: S.slots, mats: M, ctx: S };
})();
/* ---------- 原型的日光与半球光（从原型主控段自动抓取） ---------- */
window.MuseumExteriorLayout.addLights = function (scene) {
var sun = new THREE.DirectionalLight(0xfff2e0, 1.45);
  sun.position.set(-48, 66, 62);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 280;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  var hemi = new THREE.HemisphereLight(0xe4eef6, 0x8a9578, 0.85);
  scene.add(hemi);
};
