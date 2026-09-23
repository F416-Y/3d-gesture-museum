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
  var S = { scene: null, slots: { rock: [], tree: [], bamboo: [], lion: [], ding: [], hall: [] } };
  var M = {};
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
  function hipRoof(w, d, h, x, y, z, parent) {
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
      bar3(sx * (hw - 0.2), up * 0.85 + 0.06, sz * (hd - 0.2),
           sx * (hw + 0.55), up + 0.4, sz * (hd + 0.55), 0.13, M.tile, g);
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

  /* ---------- 月洞门 ---------- */
  function moonGate(x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.scene.add(g);
    box(0.9, 2.6, 0.4, M.paper, -1.55, 1.55, 0, 0, g);
    box(0.9, 2.6, 0.4, M.paper, 1.55, 1.55, 0, 0, g);
    box(4.0, 0.55, 0.4, M.paper, 0, 2.88, 0, 0, g);
    box(4.2, 0.14, 0.5, M.ink, 0, 3.12, 0, 0, g);
    box(4.4, 0.14, 0.66, M.tile, 0, 3.28, 0, 0, g);
    box(4.4, 0.5, 0.56, M.stone, 0, 0.25, 0, 0, g);
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 24, 1, true), M.paper);
    ring.rotation.z = Math.PI / 2;
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 1.55, 0);
    ring.castShadow = true;
    g.add(ring);
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
      var isBack = !!(opts && opts.backdoor && sd.key === backKey);
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
        var leafW = (doorW - 0.24) / 2;
        if (sd.ax === 'x') {
          box(doorW + 0.8, 0.24, 1.0, M.stone, sd.px, 0.36, sd.pz + sd.nz * 0.9, 0, g);
          box(doorW + 0.8, 0.24, 0.6, M.stone, sd.px, 0.12, sd.pz + sd.nz * 1.35, 0, g);
          var lf1 = box(leafW, doorH - 0.08, 0.08, M.door, ox - leafW / 2 - 0.02, wallY0 + doorH / 2, oz + sd.nz * 0.1, 0, g);
          var lf2 = box(leafW, doorH - 0.08, 0.08, M.door, ox + leafW / 2 + 0.02, wallY0 + doorH / 2, oz + sd.nz * 0.1, 0, g);
          var _op = 1.42;
          lf1.position.x = ox - doorW / 2 + 0.12 + (leafW / 2) * Math.cos(_op);
          lf1.position.z = oz + sd.nz * (0.1 + (leafW / 2) * Math.sin(_op));
          lf1.rotation.y = -_op;
          lf2.position.x = ox + doorW / 2 - 0.12 - (leafW / 2) * Math.cos(_op);
          lf2.position.z = oz + sd.nz * (0.1 + (leafW / 2) * Math.sin(_op));
          lf2.rotation.y = _op;
          if (isEntry) {   /* 正门两侧灌木球收边 */
            shrub(sd.px - doorW / 2 - 1.1, sd.pz + sd.nz * 1.5, 0.5, 300 + i * 7);
            shrub(sd.px + doorW / 2 + 1.1, sd.pz + sd.nz * 1.5, 0.5, 301 + i * 7);
          }
        } else {
          box(1.0, 0.24, doorW + 0.8, M.stone, sd.px + sd.nx * 0.9, 0.36, sd.pz, 0, g);
          box(0.6, 0.24, doorW + 0.8, M.stone, sd.px + sd.nx * 1.35, 0.12, sd.pz, 0, g);
          var lf3 = box(0.08, doorH - 0.08, leafW, M.door, ox + sd.nx * 0.1, wallY0 + doorH / 2, oz - leafW / 2 - 0.02, 0, g);
          var lf4 = box(0.08, doorH - 0.08, leafW, M.door, ox + sd.nx * 0.1, wallY0 + doorH / 2, oz + leafW / 2 + 0.02, 0, g);
          var _op2 = 1.42;
          lf3.position.z = oz - doorW / 2 + 0.12 + (leafW / 2) * Math.cos(_op2);
          lf3.position.x = ox + sd.nx * (0.1 + (leafW / 2) * Math.sin(_op2));
          lf3.rotation.y = _op2;
          lf4.position.z = oz + doorW / 2 - 0.12 - (leafW / 2) * Math.cos(_op2);
          lf4.position.x = ox + sd.nx * (0.1 + (leafW / 2) * Math.sin(_op2));
          lf4.rotation.y = -_op2;
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
    /* 门额墙 + 顶檐 */
    box(gateW + 1.4, 0.9, 0.44, M.paper, 0, 3.55, 0, 0, g);
    box(gateW + 1.6, 0.12, 0.5, M.ink, 0, 3.96, 0, 0, g);
    hipRoof(gateW + 2.2, 1.8, 0.85, 0, 4.1, 0, g);
    /* 朱砂双扇门（半开） */
    var d1 = box(gateW / 2 - 0.08, 2.4, 0.08, M.door, -gateW / 4 - 0.02, 1.2, 0.1, 0, g);
    var d2 = box(gateW / 2 - 0.08, 2.4, 0.08, M.door, gateW / 4 + 0.02, 1.2, 0.1, 0, g);
    d1.rotation.y = 0.45; d2.rotation.y = -0.45;
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
    drum(-off, 0.62); drum(off, 0.62); drum(-off, -0.62); drum(off, -0.62);
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
      } else if (opts.backdoor && k === { N: 'S', S: 'N', E: 'W', W: 'E' }[entry]) {
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

  /* ---------- 外墙一周（按官方墙体平面图：北墙中央 13m 外凸 3m 作北门楼， ---------- *
   * ---------- 南墙中央内凹两级形成主入口外广场，x ±50 / z ±40 为外包络） ---------- */
  function buildBoundary() {
    /* 西墙、东墙：直墙 */
    wallRun(-50, -40, -50, 40);
    wallRun(50, -40, 50, 40);
    /* 北墙：主线 z=-40，中央 x±6.5 外凸至 z=-43（北门楼跨坐凸出部） */
    wallRun(-50, -40, -6.5, -40);
    wallRun(-6.5, -40, -6.5, -43);
    wallRun(-6.5, -43, 6.5, -43);
    wallRun(6.5, -43, 6.5, -40);
    wallRun(6.5, -40, 50, -40);
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
    horseHeadWall(-7.2, -40, Math.PI);
    horseHeadWall(7.2, -40, Math.PI);
  }

  /* ---------- 南入口（墙外）：六级大台阶从序厅门脸 z34.5 向南下 + 石狮 + 石灯 + 石板路 ---------- */
  function buildSouthEntry() {
    var i;
    for (i = 0; i < 6; i++) {
      box(14, 0.2, 0.4, M.stone, 0, 1.1 - i * 0.2, 34.9 + i * 0.36);
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
    var pave = new THREE.Mesh(new THREE.PlaneGeometry(22, 9.4), M.plaza);
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(0, 1.215, 29.5);
    pave.receiveShadow = true;
    g.add(pave);
    /* 前大门组件（z = 34.5，14m 宽 5m 高） */
    box(5.4, 5, 0.5, M.paper, -4.4, 1.2 + 2.5, 34.5, 0, g);
    box(5.4, 5, 0.5, M.paper, 4.4, 1.2 + 2.5, 34.5, 0, g);
    box(1.0, 5, 1.0, M.stone, -2.3, 1.2 + 2.5, 34.5, 0, g);
    box(1.0, 5, 1.0, M.stone, 2.3, 1.2 + 2.5, 34.5, 0, g);
    box(3.6, 1.6, 0.5, M.paper, 0, 1.2 + 4.2, 34.5, 0, g);
    box(14.4, 0.16, 0.6, M.ink, 0, 1.2 + 4.95, 34.5, 0, g);
    hipRoof(15.2, 2.6, 1.1, 0, 1.2 + 5.1, 34.5, g);
    var d1 = box(1.7, 3.4, 0.1, M.door, -0.9, 1.2 + 1.7, 34.3, 0, g);
    var d2 = box(1.7, 3.4, 0.1, M.door, 0.9, 1.2 + 1.7, 34.3, 0, g);
    d1.rotation.y = 0.5; d2.rotation.y = -0.5;
    plaque('江南文人国画博物馆', 4.6, 0, 1.2 + 4.15, 34.86, 0, g);
    /* 门前抱厦（按正立面图：大门前双柱卷棚小顶，构成重檐入口） */
    cyl(0.2, 0.24, 0.16, 8, M.stone, -1.9, 1.2 + 0.08, 34.15, g);
    cyl(0.2, 0.24, 0.16, 8, M.stone,  1.9, 1.2 + 0.08, 34.15, g);
    cyl(0.14, 0.17, 3.3, 10, M.wood, -1.9, 1.2 + 1.65, 34.15, g);
    cyl(0.14, 0.17, 3.3, 10, M.wood,  1.9, 1.2 + 1.65, 34.15, g);
    box(4.8, 0.26, 0.26, M.wood, 0, 1.2 + 3.4, 34.15, 0, g);
    box(4.4, 0.3, 0.05, M.gualuo, 0, 1.2 + 3.1, 34.3, 0, g);
    hipRoof(5.4, 2.4, 0.85, 0, 1.2 + 3.55, 34.7, g);
    /* 大门两侧抱鼓石（台基上）：1m 须弥座 + 大鼓 + 鼓顶圆珠，通高约 1.9m */
    box(1.0, 0.4, 1.0, M.stone, -2.3, 1.2 + 0.2, 34.05, 0, g);
    box(1.0, 0.4, 1.0, M.stone,  2.3, 1.2 + 0.2, 34.05, 0, g);
    var dr1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.26, 24), M.stone);
    dr1.rotation.x = Math.PI / 2; dr1.position.set(-2.3, 1.2 + 1.07, 34.05);
    dr1.castShadow = dr1.receiveShadow = true; g.add(dr1);
    var dr2 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.26, 24), M.stone);
    dr2.rotation.x = Math.PI / 2; dr2.position.set(2.3, 1.2 + 1.07, 34.05);
    dr2.castShadow = dr2.receiveShadow = true; g.add(dr2);
    var dc1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.stoneDark);
    dc1.position.set(-2.3, 1.2 + 1.76, 34.05); dc1.castShadow = true; g.add(dc1);
    var dc2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.stoneDark);
    dc2.position.set(2.3, 1.2 + 1.76, 34.05); dc2.castShadow = true; g.add(dc2);
    /* 大门檐口红灯笼一对（匾两侧） */
    redLantern(-3.1, 1.2 + 4.75, 34.85, g);
    redLantern(3.1, 1.2 + 4.75, 34.85, g);
    /* 后墙照壁（z = 25，14m 宽 5m 高）：中央照壁心不动，左右各开一樘 1.6m 小门，
       进门穿洞下四步踏跺，直通中轴南院观澜亭 */
    box(1.4, 5, 0.5, M.paper, -6.3, 1.2 + 2.5, 25, 0, g);
    box(8.0, 5, 0.5, M.paper, 0, 1.2 + 2.5, 25, 0, g);
    box(1.4, 5, 0.5, M.paper, 6.3, 1.2 + 2.5, 25, 0, g);
    box(1.6, 2.6, 0.5, M.paper, -4.8, 1.2 + 3.7, 25, 0, g);   /* 门上过梁墙 */
    box(1.6, 2.6, 0.5, M.paper, 4.8, 1.2 + 3.7, 25, 0, g);
    box(14.3, 0.16, 0.6, M.ink, 0, 1.2 + 4.9, 25, 0, g);
    box(14.6, 0.18, 0.9, M.tile, 0, 1.2 + 5.08, 25, 0, g);
    box(5.6, 3.0, 0.14, M.ink, 0, 1.2 + 2.6, 25.32, 0, g);
    box(5.2, 2.6, 0.16, M.plaza, 0, 1.2 + 2.6, 25.34, 0, g);
    /* 左右小门：暗腔 + 双扇木门（虚掩）+ 石门坎 + 北侧四步踏跺下高台 */
    var dxi, dxx;
    for (dxi = 0; dxi < 2; dxi++) {
      dxx = dxi === 0 ? -4.8 : 4.8;
      var dcc = box(1.5, 2.4, 0.44, M.ink, dxx, 1.2 + 1.2, 25, 0, g);
      dcc.castShadow = false;
      var lf1 = box(0.72, 2.3, 0.08, M.door, dxx - 0.38, 1.2 + 1.15, 25, 0, g);
      var lf2 = box(0.72, 2.3, 0.08, M.door, dxx + 0.38, 1.2 + 1.15, 25, 0, g);
      lf1.rotation.y = 0.55; lf2.rotation.y = -0.55;
      box(1.9, 0.12, 0.74, M.stoneDark, dxx, 1.26, 25, 0, g);
      for (ti = 0; ti < 4; ti++) {
        box(1.9, 0.3, 0.25, M.stone, dxx, 0.15 + ti * 0.3, 24.58 - ti * 0.25, 0, g);
      }
    }
    /* 中院侧墙（各带一樘月洞门通向北院） */
    wallRun(-7.25, 27.5, -7.25, 34.5, 0, 3.6);
    wallRun(7.25, 27.5, 7.25, 34.5, 0, 3.6);
    wallRun(-7.25, 24.8, -7.25, 25.4, 0, 3.6);
    wallRun(7.25, 24.8, 7.25, 25.4, 0, 3.6);
    moonGate(-7.25, 26.4, Math.PI / 2);
    moonGate(7.25, 26.4, Math.PI / 2);
    /* 左右侧院改透空围栏（各 4m 宽）+ 西南/东南角阙楼；
       东栏 z=26.5、西栏 z=28.5 各留 1.8m 廊门，对齐两条南花园游廊端头，
       进门穿侧院经月洞门入中院（东侧廊门与月洞门几乎正对，成一条动线） */
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
    /* 四角阙楼：侧院墙改围栏后加四柱落地成亭（柱础在台基面 y1.2 起） */
    var qx = [-9.2, 9.2], qz = [25.4, 33.6], qo = [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]], qi, qj, qb;
    for (qi = 0; qi < 2; qi++) for (qj = 0; qj < 2; qj++) {
      hipRoof(2.6, 2.6, 1.2, qx[qi], 4.9, qz[qj], g);
      for (qb = 0; qb < 4; qb++) {
        cyl(0.2, 0.24, 0.14, 8, M.stone, qx[qi] + qo[qb][0], 1.27, qz[qj] + qo[qb][1], g);
        cyl(0.11, 0.13, 3.6, 8, M.wood, qx[qi] + qo[qb][0], 3.07, qz[qj] + qo[qb][1], g);
      }
    }
    /* 侧院南墙封口 + 正立面两端三级马头墙（按正立面图两翼跌落） */
    wallRun(-11.25, 34.5, -7.25, 34.5, 0, 3.4);
    wallRun(7.25, 34.5, 11.25, 34.5, 0, 3.4);
    horseHeadWall(-9.25, 34.82, 0);
    horseHeadWall(9.25, 34.82, 0);
    /* 中庭铜鼎：3m 见方石座 + 三足两耳大鼎（通高约 2.4m） */
    box(3, 0.5, 3, M.stoneDark, 0, 1.2 + 0.25, 29.5, 0, g);
    var dingY = 1.2 + 0.5, legA;
    var dingG = new THREE.Group(); g.add(dingG);
    for (legA = 0; legA < 3; legA++) {
      var la = legA * 2.094;
      cyl(0.09, 0.12, 0.7, 8, M.ink, Math.cos(la) * 0.55, dingY + 0.35, 29.5 + Math.sin(la) * 0.55, dingG);
    }
    cyl(0.95, 0.75, 1.0, 16, M.ink, 0, dingY + 1.15, 29.5, dingG);
    cyl(1.02, 1.02, 0.16, 16, M.ink, 0, dingY + 1.72, 29.5, dingG);
    box(0.14, 0.5, 0.3, M.ink, -0.6, dingY + 2.0, 29.5, 0, dingG);
    box(0.14, 0.5, 0.3, M.ink, 0.6, dingY + 2.0, 29.5, 0, dingG);
    S.slots.ding.push({ group: dingG, x: 0, y: dingY, z: 29.5 });
    return g;
  }

  /* ---------- 北门楼（13m，跨坐北墙外凸部，z -42.6~-40.6） ---------- */
  function buildNorthGate() {
    var g = new THREE.Group(); S.scene.add(g);
    var z = -41.6;
    box(3.2, 3.2, 1.1, M.paper, -4.9, 1.6, z, 0, g);
    box(3.2, 3.2, 1.1, M.paper, 4.9, 1.6, z, 0, g);
    box(6.6, 1.1, 1.1, M.paper, 0, 3.0, z, 0, g);
    box(6.4, 2.6, 0.3, M.ink, 0, 1.3, z, 0, g);
    var d1 = box(1.5, 2.5, 0.1, M.door, -0.78, 1.25, z + 0.35, 0, g);
    var d2 = box(1.5, 2.5, 0.1, M.door, 0.78, 1.25, z + 0.35, 0, g);
    d1.castShadow = d2.castShadow = false;
    var xs = [-5.8, 5.8], zs = [z - 1.0, z + 1.0], i, j;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
      cyl(0.26, 0.3, 0.35, 8, M.stone, xs[i], 3.6, zs[j], g);
      cyl(0.17, 0.19, 2.2, 10, M.wood, xs[i], 4.85, zs[j], g);
    }
    box(12.6, 0.3, 0.26, M.wood, 0, 6.1, z - 1.0, 0, g);
    box(12.6, 0.3, 0.26, M.wood, 0, 6.1, z + 1.0, 0, g);
    hipRoof(14.2, 4.8, 2.2, 0, 6.3, z, g);
    plaque('北门', 1.6, 0, 4.6, z + 1.35, 0, g);
    return g;
  }

  /* ---------- 展厅群（细分参考图尺寸，殿厅加大版） ----------
   * 花鸟 22×16.5 主厅重檐 / 山水 17.5×15 / 人物 17.5×11 / 景韵轩 12×9.5
   * 文创·临摹 各 11×13（正房加深至 6m） / 书斋·茶室 各 8×13（小筑加深至 5.5m） */
  function buildHuaniao()  { buildCourtComplex(0, -29.25, 22, 16.5, 'S', '花鸟', { gateW: 4, wallH: 3.4, hallD: 8.5, chongyan: true, treeScale: 1.0, backdoor: true }); }
  function buildShanshui() { buildCourtComplex(-37.25, -12.5, 17.5, 15, 'E', '山水', { gateW: 4, wallH: 3.4, hallD: 8.5, treeScale: 1.0, backdoor: true }); }
  function buildRenwu()    { buildCourtComplex(36.75, -15.5, 17.5, 11, 'S', '人物', { gateW: 4, wallH: 3.2, hallD: 5.5, backdoor: true, sideDoors: { W: -16 } }); }
  function buildYaji()     { buildHall(-38, -29.5, 12, 7, 'S', '雅集', { backdoor: true }); }
  function buildJingyun()  { buildCourtComplex(39, -30, 12, 9.5, 'S', '景韵', { gateW: 2.4, wallH: 3.0, hallD: 4.8, treeScale: 0.75, backdoor: true }); }
  /* （收藏室已取消，兰竹庭院东侧留作绿地） */
  function buildWenchuang() {
    buildCourtComplex(-39.5, 14.5, 11, 13, 'E', '文创', { gateW: 2.4, wallH: 2.8, hallD: 6, backdoor: true });
    buildCourtComplex(-39.5, 28.5, 11, 13, 'E', '临摹', { gateW: 2.4, wallH: 2.8, hallD: 6, backdoor: true });
  }
  function buildShuzhaiChashi() {
    buildCourtComplex(38, 12.5, 8, 13, 'W', '书斋', { gateW: 2.4, wallH: 2.8, hallD: 5.5, backdoor: true });
    buildCourtComplex(38, 26.5, 8, 13, 'W', '茶室', { gateW: 2.4, wallH: 2.8, hallD: 5.5, backdoor: true });
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

  /* ---------- 游廊：双列木柱 + 双坡瓦顶 + 坐槛，廊宽 2.2m，柱距约 3m ---------- */
  function corridor(x0, z0, x1, z1) {
    var w = 2.2;
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    g.rotation.y = Math.atan2(dx, dz);
    S.scene.add(g);
    var bays = Math.max(1, Math.round(len / 3)), i, t;
    for (i = 0; i <= bays; i++) {
      t = -len / 2 + len * i / bays;
      cyl(0.14, 0.17, 0.14, 8, M.stone, -w / 2 + 0.2, 0.07, t, g);
      cyl(0.14, 0.17, 0.14, 8, M.stone,  w / 2 - 0.2, 0.07, t, g);
      cyl(0.09, 0.11, 2.3, 8, M.wood, -w / 2 + 0.2, 1.29, t, g);
      cyl(0.09, 0.11, 2.3, 8, M.wood,  w / 2 - 0.2, 1.29, t, g);
    }
    /* 坐槛（美人靠矮凳）与檐枋 */
    box(0.3, 0.42, len, M.wood, -w / 2 + 0.2, 0.33, 0, 0, g);
    box(0.3, 0.42, len, M.wood,  w / 2 - 0.2, 0.33, 0, 0, g);
    box(0.12, 0.18, len, M.wood, -w / 2 + 0.2, 2.42, 0, 0, g);
    box(0.12, 0.18, len, M.wood,  w / 2 - 0.2, 2.42, 0, 0, g);
    /* 挂落（檐下柱间镂空木板，两面） */
    box(0.05, 0.34, len, M.gualuo, -w / 2 + 0.2, 2.18, 0, 0, g);
    box(0.05, 0.34, len, M.gualuo,  w / 2 - 0.2, 2.18, 0, 0, g);
    /* 双坡小青瓦顶，屋脊顺廊向 */
    var rf = hipRoof(len + 0.7, w + 0.8, 0.85, 0, 2.5, 0, g);
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
  function hangingScroll(x, z, faceDir, seed, k) {
    var g = new THREE.Group(); g.position.set(x, 0, z);
    g.rotation.y = faceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (k) g.scale.setScalar(k);
    S.scene.add(g);
    box(0.9, 1.72, 0.02, M.wood, 0, 1.5, 0, 0, g);              /* 绫边装裱 */
    var paint = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.42),
      new THREE.MeshStandardMaterial({ map: scrollTex(seed), roughness: 0.92 }));
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
  function galleryWall(x, faceDir) {
    var len = 12.9, zc = 16.75;
    box(0.2, 0.12, len + 0.1, M.stoneDark, x, 0.06, zc);
    box(0.15, 2.3, len, M.paper, x, 1.15 + 0.1, zc);
    box(0.22, 0.14, len + 0.1, M.ink, x, 2.42, zc);
    var zs = [10.93, 13.79, 16.65, 19.51, 22.37], i;
    for (i = 0; i < zs.length; i++) hangingScroll(x + faceDir * 0.14, zs[i], faceDir, 350 + i * 7 + (x > 0 ? 100 : 0));
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

  /* ---------- 游廊尽端收头：双柱 + 柱础 + 门楣 + 小坡顶（门洞通行，出廊即入院） ---------- */
  function corridorEnd(x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; S.scene.add(g);
    cyl(0.2, 0.24, 0.16, 8, M.stone, -1.0, 0.08, 0, g);
    cyl(0.2, 0.24, 0.16, 8, M.stone, 1.0, 0.08, 0, g);
    box(0.26, 2.5, 0.26, M.wood, -1.0, 1.41, 0, 0, g);
    box(0.26, 2.5, 0.26, M.wood, 1.0, 1.41, 0, 0, g);
    box(2.6, 0.22, 0.24, M.wood, 0, 2.62, 0, 0, g);
    box(2.2, 0.3, 0.05, M.gualuo, 0, 2.34, 0, 0, g);
    hipRoof(3.2, 1.7, 0.7, 0, 2.76, 0, g);
  }

  /* ---------- 全馆游廊系统：中轴双廊 + 东西横廊 + 南花园两廊 ---------- */
  function buildCorridors() {
    corridor(-7, 9.5, -7, 23.8);         // 中轴南院西廊
    corridor(7, 9.5, 7, 23.8);           // 中轴南院东廊
    corridor(-8.5, -12.5, -28.5, -12.5); // 西长廊：中心庭 → 山水馆东门
    corridor(8.5, -16, 27.9, -16);       // 东长廊：中心庭 → 人物馆西侧门
    corridor(11, 26.5, 34, 26.5);        // 南花园东廊：序厅东廊门 → 茶室西门
    corridor(-11, 28.5, -34, 28.5);      // 南花园西廊：序厅西廊门 → 临摹体验东门
    /* 双廊南端：四步石阶登上序厅高台（台高 1.2m；到顶绕照壁两侧入侧院、经月洞门进中院） */
    var si;
    for (si = 0; si < 4; si++) {
      box(2.2, 0.3, 0.25, M.stone, -7, 0.15 + si * 0.3, 23.72 + si * 0.25);
      box(2.2, 0.3, 0.25, M.stone,  7, 0.15 + si * 0.3, 23.72 + si * 0.25);
    }
    /* 双廊北端收头门洞：出廊即中轴南院，北对水榭庭院南门 */
    corridorEnd(-7, 9.5);
    corridorEnd(7, 9.5);
    /* 中轴双廊改画廊：外侧半壁墙封廊，每开间一幅立轴国画 + 暖光洗画 */
    galleryWall(-8.1, 1);
    galleryWall(8.1, -1);
  }

  /* ---------- 中心庭（17×13 碎石广场 + 内院 5×5m：中心树 + 太湖石 + 石桌凳 + 条凳 + 石灯 + 陶罐） ---------- */
  function buildZhongxinCourt() {
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
    /* 5×5 内院：统一改透空围栏一圈，南岸东段留 1.6m 口 */
    fenceRun(-2.5, -15.5, 2.5, -15.5);
    fenceRun(-2.5, -10.5, 0.9, -10.5);
    fenceRun(-2.5, -15.5, -2.5, -10.5);
    fenceRun(2.5, -15.5, 2.5, -10.5);
    /* 中心主景树（冠幅大树，约 6m，树冠越出内院围栏） */
    plantTree(0, -13.4, 1.6, 55);
    /* 太湖石主景（约 2m 高，与 6m 主树相称）+ 次景石 */
    rock(-1.5, 0.3, -14.4, 0.9, 0.5, 1.2, 71);
    rock(1.4, 0.08, -12.0, 0.4, 0.4, 0.9, 72);
    /* 石桌凳 / 条石坐凳 / 石灯 / 陶罐 */
    stoneTableSet(5.8, -9.5);
    stoneBench(-5.8, -9.5, 0);
    lantern(3.6, -16.5);
    potteryJar(-4.0, -16.3);
    /* 南带叠水喷泉：中轴对景，北衬内院主树、南迎水榭北门 */
    fountain(0, -8.3);
    var m = new THREE.Mesh(blobGeo(0.5, 0.2, 0.7, 77), M.leaf);
    m.position.set(2.2, 0.3, -16.2); m.castShadow = m.receiveShadow = true;
    S.scene.add(m);
  }

  /* ---------- 水榭庭院（14×12m 围墙院落：5.5×4.5 水池 + 曲桥 + 水榭 + 假山 + 主树） ---------- */
  function buildShuixieCourt() {
    /* 四面围墙全部改透空围栏（与其他庭院统一），南面留 2.4m 正门，门楼保留 */
    fenceRun(-7, -5, 7, -5);
    fenceRun(-7, 7, -1.2, 7);
    fenceRun(1.2, 7, 7, 7);
    fenceRun(-7, -5, -7, 7);
    fenceRun(7, -5, 7, 7);
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

  /* ---------- 中轴南院：铺装广场 + 观澜亭（z 8~24.5） ---------- */
  function buildAxisCourt() {
    var g = new THREE.Mesh(new THREE.PlaneGeometry(14, 16.5), M.plaza);
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0.03, 16.25); g.receiveShadow = true;
    S.scene.add(g);
    var xg = new THREE.Group(); S.scene.add(xg);
    box(4.2, 0.45, 4.2, M.stone, 0, 0.225, 16, 0, xg);
    var offs = [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]], i;
    for (i = 0; i < 4; i++) {
      cyl(0.2, 0.24, 0.15, 8, M.stone, offs[i][0], 0.52, 16 + offs[i][1], xg);
      cyl(0.14, 0.16, 2.6, 10, M.wood, offs[i][0], 1.9, 16 + offs[i][1], xg);
    }
    box(3.7, 0.26, 0.22, M.wood, 0, 3.3, 14.5, 0, xg);
    box(3.7, 0.26, 0.22, M.wood, 0, 3.3, 17.5, 0, xg);
    box(0.22, 0.26, 3.7, M.wood, -1.5, 3.3, 16, 0, xg);
    box(0.22, 0.26, 3.7, M.wood, 1.5, 3.3, 16, 0, xg);
    hipRoof(5.0, 5.0, 1.9, 0, 3.5, 16, xg);
    cyl(0.06, 0.16, 0.5, 8, M.ink, 0, 5.65, 16, xg);
    plaque('观澜亭', 1.7, 0, 3.0, 18.15, 0, xg);
    /* 亭檐四角红灯笼 */
    redLantern(-1.5, 3.26, 14.55, xg);
    redLantern(1.5, 3.26, 14.55, xg);
    redLantern(-1.5, 3.26, 17.45, xg);
    redLantern(1.5, 3.26, 17.45, xg);
    /* 中轴甬道两侧：陶罐与灌木球交替成列 */
    var zz;
    for (zz = 10.5; zz <= 23; zz += 3.2) {
      potteryJar(-2.4, zz);
      shrub(2.4, zz, 0.44, 500 + Math.round(zz * 10));
    }
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
    /* 南侧门厅（6m 宽 3m 深，墙 4m 高带月洞窗，北向后门通内院） */
    buildHall(33, 4.4, 6, 3, 'S', '兰竹', { backdoor: true });
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
  function buildJingguanCourt() {
    /* 高围墙改透空围栏，南北各留门洞（北门楼柱间 1.8m，南门 1.4m），西墙花窗保留 */
    fenceRun(11.5, -15, 12.9, -15);
    fenceRun(14.1, -15, 15.5, -15);
    fenceRun(11.5, -9, 12.8, -9);
    fenceRun(14.2, -9, 15.5, -9);
    windowWall(11.5, -15, 11.5, -9, 0.4, 2.9, 2, -1);
    fenceRun(15.5, -15, 15.5, -9);
    /* 北门洞（2m，通中心庭方向） */
    box(1.2, 3.2, 0.5, M.paper, 12.3, 1.6, -15);
    box(1.2, 3.2, 0.5, M.paper, 14.7, 1.6, -15);
    hipRoof(4.4, 1.6, 0.8, 13.5, 3.6, -15);
    /* 青石铺地 */
    var g = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.2), M.plaza);
    g.rotation.x = -Math.PI / 2; g.position.set(13.5, 0.05, -12); g.receiveShadow = true;
    S.scene.add(g);
    /* 影壁题刻墙（南端正对北门洞） */
    box(2.0, 2.4, 0.24, M.paper, 13.5, 1.5, -9.6);
    box(2.2, 0.12, 0.34, M.ink, 13.5, 2.66, -9.6);
    box(2.3, 0.14, 0.5, M.tile, 13.5, 2.8, -9.6);
    box(1.0, 1.4, 0.1, M.ink, 13.5, 1.45, -9.45);
    /* 假山石 2.2m + 主树 3.5m + 竹 + 石灯 */
    rock(12.4, 0.25, -10.4, 0.7, 0.48, 1.5, 98);
    plantTree(14.7, -13.3, 0.55, 99);
    bambooClump(12.2, -13.8, 220, S.scene, 0.7);
    lantern(14.8, -10.2);
  }

  /* ---------- 间隙花园 ---------- */
  function pocket(cx, cz, w, d, seed) {
    box(w, 0.45, 0.35, M.leaf, cx, 0.22, cz - d / 2);
    box(w, 0.45, 0.35, M.leaf, cx, 0.22, cz + d / 2);
    box(0.35, 0.45, d, M.leaf, cx - w / 2, 0.22, cz);
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
    pocket(-36, -23, 14, 5, 303);
    pocket(36, -23.5, 13, 5, 304);
    pocket(-20, -17.2, 10, 5.6, 305);  // 西长廊北侧，让出廊道
    pocket(22, -10.4, 8, 7.2, 306);    // 东长廊南侧，让出廊道
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

  /* ---------- 喷泉（双层承露石盆叠水 + 须弥座中心柱 + 宝珠顶） ---------- */
  function fountain(x, z) {
    var g = new THREE.Group(); g.position.set(x, 0, z); S.scene.add(g);
    /* 外盆：透空圆壁 + 盆沿 + 底盘 + 盆内水面 */
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.64, 0.6, 28, 1, true), M.stone);
    wall.position.y = 0.3; wall.castShadow = wall.receiveShadow = true; g.add(wall);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.09, 10, 28), M.stoneDark);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.6; rim.castShadow = true; g.add(rim);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.9, 0.14, 28), M.stoneDark);
    base.position.y = 0.07; base.castShadow = base.receiveShadow = true; g.add(base);
    var w0 = new THREE.Mesh(new THREE.CircleGeometry(1.42, 28), M.water);
    w0.rotation.x = -Math.PI / 2; w0.position.y = 0.46; g.add(w0);
    /* 中心柱：须弥座 + 柱身 */
    box(0.9, 0.22, 0.9, M.stoneDark, 0, 0.57, 0, 0, g);
    box(0.68, 0.14, 0.68, M.stone, 0, 0.75, 0, 0, g);
    cyl(0.16, 0.21, 0.82, 12, M.stone, 0, 1.23, 0, g);
    /* 下承露盘 + 盘内水面 */
    cyl(0.78, 0.28, 0.2, 20, M.stone, 0, 1.74, 0, g);
    var w1 = new THREE.Mesh(new THREE.CircleGeometry(0.66, 20), M.water);
    w1.rotation.x = -Math.PI / 2; w1.position.y = 1.82; g.add(w1);
    cyl(0.09, 0.12, 0.4, 10, M.stone, 0, 2.02, 0, g);
    /* 上承露盘 + 宝珠 */
    cyl(0.42, 0.15, 0.13, 16, M.stone, 0, 2.28, 0, g);
    var w2 = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), M.water);
    w2.rotation.x = -Math.PI / 2; w2.position.y = 2.33; g.add(w2);
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), M.stoneDark);
    orb.position.y = 2.47; orb.castShadow = true; g.add(orb);
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

  /* ---------- 空旷草地填充：西北枯山水回廊院 / 东北石景 / 西南与东南沿墙山水带（水景收进中心庭院，边缘不再设池） ---------- */
  function buildLandscapeFill() {
    /* 西北角：枯山水石床（约 9×7m）+ 西/北 L 形曲廊绕床赏石，两端收头门洞 */
    dryBed(-18, -28.8, 4.6, 3.4, 601);
    corridor(-25, -24.2, -25, -34);
    corridor(-25, -34, -13.5, -34);
    corridorEnd(-25, -24.2, 0);
    corridorEnd(-13.5, -34, Math.PI / 2);
    rockery(-14.6, -24.6, 1.3, 611);          // 床东南岸山石群
    plantTree(-13.2, -26.2, 1.2, 615);        // 床东岸大树
    plantTree(-21.5, -24.3, 1.1, 616);        // 床南岸树
    /* 东北角：山石群 + 双树（原水池已撤，留草坪疏林） */
    rockery(18.8, -25.8, 1.3, 612);
    plantTree(26.2, -32.6, 1.1, 617);
    plantTree(18.8, -33.2, 1.0, 618);
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
    var x, z;
    for (x = -44; x <= 44; x += 8) {
      if (Math.abs(x) > 9) plantTree(x, -38.2, 0.95, 400 + x);
    }
    for (z = -34; z <= 34; z += 8) {
      plantTree(-48, z, 0.9, 500 + z);
      plantTree(48, z, 0.9, 600 + z);
    }
    plantTree(-10.5, 37.5, 1.1, 701);
    plantTree(10.5, 37.5, 1.1, 702);
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
      ctx.fillStyle = '#70795A'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 900, ['#66704f', '#7a8463', '#5d684a'], 1.5, 5, 0.25);
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
    var doorT = canvasTex(128, function (ctx, s2) {
      ctx.fillStyle = '#8C3B2E'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 120, ['#7c3428', '#9a4636'], 1, 3, 0.3);
      ctx.fillStyle = '#5e2a20';
      var a, b;
      for (a = 0; a < 3; a++) for (b = 0; b < 4; b++) {
        ctx.beginPath(); ctx.arc(22 + a * 42, 18 + b * 32, 4, 0, 6.2832); ctx.fill();
      }
    });
    var stoneT = canvasTex(256, function (ctx, s2) {
      ctx.fillStyle = '#B9B0A0'; ctx.fillRect(0, 0, s2, s2);
      speckle(ctx, s2, 800, ['#aca393', '#c6bdab', '#9d9484'], 0.8, 2.6, 0.3);
    }, 3, 3);

    M.lawn    = new THREE.MeshLambertMaterial({ map: lawnT });
    M.gravel  = new THREE.MeshLambertMaterial({ map: gravelT });
    M.plaza   = new THREE.MeshLambertMaterial({ map: plazaT });
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
      color: C(0x3d4a5c), transparent: true, opacity: 0.76,
      shininess: 90, specular: new THREE.Color(0xbbccdd)
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
    buildNorthGate();
    buildHuaniao();           // 花鸟 18×15（重檐正房）
    buildShanshui();          // 山水 15×15
    buildRenwu();             // 人物 16×9
    buildYaji();              // 雅集室 12×7
    buildJingyun();           // 景韵轩 9×8
    buildWenchuang();         // 文创 / 临摹（各 10×13，正房 10×5 + 前院）
    buildShuzhaiChashi();     // 书斋 / 茶室（各 8×13，小筑 8×4 + 前院）
    buildZhongxinCourt();     // 中心庭（17×13 广场 + 5×5 内院）
    buildShuixieCourt();      // 水榭庭院（14×12）
    buildAxisCourt();
    buildShanshiCourt();      // 山石庭院（13×12 场 + 内院 5×4）
    buildHechiCourt();        // 荷池庭院（加深至 z 5.5~17）
    buildLanzhuCourt();       // 兰竹庭院（6×4 + 门厅）
    buildJingguanCourt();     // 景观庭院（4×6）
    buildCorridors();         // 游廊系统（中轴双廊 + 东西横廊 + 南花园两廊）
    buildPocketGardens();
    buildLandscapeFill();     // 空旷草地：曲池、曲廊、山石组
    return { waters: WATERS };
  }

  return { build: build, slots: S.slots };
})();
/* ---------- 原型的日光与半球光（从原型主控段自动抓取） ---------- */
window.MuseumExteriorLayout.addLights = function (scene) {
var sun = new THREE.DirectionalLight(0xffd9a6, 1.18);
  sun.position.set(-56, 48, 74);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 280;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xf2ead9, 0x70795a, 0.5));
};
