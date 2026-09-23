/* ============================================================
 * 程序化植被与景石（不依赖外部建模服务）
 * ------------------------------------------------------------
 * 做法：树枝/竹竿/草叶全部用"分段锥体 + 叶片贴片"程序生成，
 *       同类几何合并成一个 BufferGeometry（一棵树 2 个 draw call），
 *       叶片用 canvas 画的带透明通道叶片贴图 + alphaTest。
 * 为什么这么写：球体树冠和圆柱灌木是"占位级"的观感，
 *       而叶片贴片 + 真实分枝骨架是游戏里通用的做法，成本极低。
 *
 * 只在浏览器里跑（依赖全局 THREE）；Node 冒烟环境会自动跳过。
 * ============================================================ */
window.MuseumFoliage = (function () {
  if (typeof THREE === "undefined" || !THREE.BufferGeometry) return null;

  /* ---------- 小工具 ---------- */
  function rng(seed) {
    var s = seed | 0 || 1;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /* 合并若干几何（已各自 applyMatrix）成一个，省 draw call */
  function merge(list) {
    var pos = [], nor = [], uv = [], idx = [], off = 0;
    list.forEach(function (g) {
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      }
      if (g.index) { for (var k = 0; k < g.index.count; k++) idx.push(g.index.getX(k) + off); }
      else { for (var k2 = 0; k2 < p.count; k2++) idx.push(k2 + off); }
      off += p.count;
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
  }

  var UP = new THREE.Vector3(0, 1, 0);

  /* 一段锥体：从 a 到 b，半径 r1→r2 */
  function segment(a, b, r1, r2, radial) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    if (len < 1e-4) return null;
    var geo = new THREE.CylinderGeometry(r2, r1, len, radial || 5, 1, true);
    var q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    var m = new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    return geo;
  }

  /* 半径沿长度衰减的枝干：返回合并后的几何 + 末端点 */
  function limb(from, dir, len, r0, taper, parts, radial) {
    var geos = [], a = from.clone(), d = dir.clone().normalize();
    var r = r0;
    for (var i = 0; i < parts; i++) {
      var segLen = len / parts;
      var b = a.clone().addScaledVector(d, segLen);
      var rNext = r * taper;
      var s = segment(a, b, r, rNext, radial);
      if (s) geos.push(s);
      a = b; r = rNext;
      /* 自然弯曲：逐段轻微偏转 */
      d.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.06);
      d.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.045);
      d.normalize();
    }
    return { geo: geos, tip: a, radius: r };
  }

  /* ---------- 叶片贴图（canvas 画，带透明通道） ---------- */
  var _leafTex = {};
  function leafTexture(kind) {
    if (_leafTex[kind]) return _leafTex[kind];
    var cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);
    var rand = rng(kind === "willow" ? 11 : kind === "bamboo" ? 23 : 37);
    var n = kind === "willow" ? 9 : kind === "bamboo" ? 7 : 12;
    for (var i = 0; i < n; i++) {
      var cx = 20 + rand() * 88, cy = 20 + rand() * 88;
      var w = kind === "willow" ? 7 + rand() * 4 : 13 + rand() * 9;
      var h = kind === "willow" ? 26 + rand() * 14 : 17 + rand() * 11;
      var rot = (rand() - 0.5) * 1.2;
      var g = ctx.createLinearGradient(cx - w, cy - h, cx + w, cy + h);
      var base = kind === "willow" ? [126, 158, 82] : kind === "bamboo" ? [104, 146, 74] : [86, 126, 66];
      g.addColorStop(0, "rgba(" + (base[0] + 26) + "," + (base[1] + 26) + "," + (base[2] + 18) + ",0.95)");
      g.addColorStop(1, "rgba(" + (base[0] - 18) + "," + (base[1] - 24) + "," + (base[2] - 14) + ",0.88)");
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.quadraticCurveTo(w, -h * 0.12, 0, h / 2);
      ctx.quadraticCurveTo(-w, -h * 0.12, 0, -h / 2);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    _leafTex[kind] = tex;
    return tex;
  }

  var _leafMat = {};
  function leafMaterial(kind) {
    if (_leafMat[kind]) return _leafMat[kind];
    _leafMat[kind] = new THREE.MeshStandardMaterial({
      map: leafTexture(kind), alphaTest: 0.42, side: THREE.DoubleSide,
      roughness: 0.96, metalness: 0, transparent: false,
    });
    return _leafMat[kind];
  }

  var _woodMat = null;
  function woodMaterial() {
    if (!_woodMat) _woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5744, roughness: 0.92 });
    return _woodMat;
  }

  function card(w, h, pos, ry, rx) {
    var g = new THREE.PlaneGeometry(w, h);
    var m = new THREE.Matrix4().compose(
      pos,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, (ry || 0) * 0.3)),
      new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return g;
  }

  /* ---------- 垂柳 ---------- */
  function willow(opt) {
    opt = opt || {};
    var seed = opt.seed || 7, H = opt.height || 4.5;
    var rand = rng(seed);
    var wood = [], cards = [];
    var trunk = limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 1, 0.03), H * 0.52, 0.20, 0.72, 5, 7);
    wood = wood.concat(trunk.geo);
    /* 主枝：从树干上部斜向外 */
    var nMain = 4 + Math.floor(rand() * 2);
    for (var i = 0; i < nMain; i++) {
      var a = (i / nMain) * Math.PI * 2 + rand() * 0.5;
      var from = new THREE.Vector3(Math.cos(a) * 0.12, H * (0.42 + rand() * 0.1), Math.sin(a) * 0.12);
      var dir = new THREE.Vector3(Math.cos(a) * 0.85, 0.75, Math.sin(a) * 0.85);
      var br = limb(from, dir, H * 0.26, 0.075, 0.62, 3, 5);
      wood = wood.concat(br.geo);
      /* 柳条：从枝条末端垂下，带叶片 */
      var nStrand = 5 + Math.floor(rand() * 3);
      for (var s = 0; s < nStrand; s++) {
        var sp = br.tip.clone().add(new THREE.Vector3((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.5));
        var strand = limb(sp, new THREE.Vector3((rand() - 0.5) * 0.35, -0.55, (rand() - 0.5) * 0.35), H * 0.42 * (0.7 + rand() * 0.5), 0.014, 0.85, 4, 4);
        wood = wood.concat(strand.geo);
        /* 沿柳条挂叶片 */
        for (var k = 0; k < 7; k++) {
          var t = k / 6;
          var p = sp.clone().lerp(strand.tip, t).add(new THREE.Vector3((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12));
          var sc = 0.34 + rand() * 0.16;
          cards.push(card(0.07 * sc * 8, 0.28 * sc * 8, p, rand() * Math.PI * 2, (rand() - 0.5) * 1.2));
        }
      }
    }
    var g = new THREE.Group();
    var woodMesh = new THREE.Mesh(merge(wood), woodMaterial());
    woodMesh.castShadow = true;
    g.add(woodMesh);
    var leafMesh = new THREE.Mesh(merge(cards), leafMaterial("willow"));
    leafMesh.castShadow = true;
    g.add(leafMesh);
    return g;
  }

  /* ---------- 乔木（香樟一类）：分枝 + 团状叶卡 ---------- */
  function tree(opt) {
    opt = opt || {};
    var seed = opt.seed || 3, H = opt.height || 5;
    var rand = rng(seed);
    var wood = [], cards = [];
    var trunk = limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 1, 0.01), H * 0.45, 0.26, 0.7, 4, 7);
    wood = wood.concat(trunk.geo);
    var tips = [trunk.tip];
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI * 2 + rand();
      var from = new THREE.Vector3(Math.cos(a) * 0.1, H * (0.3 + rand() * 0.1), Math.sin(a) * 0.1);
      var br = limb(from, new THREE.Vector3(Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7), H * 0.34, 0.11, 0.6, 3, 5);
      wood = wood.concat(br.geo);
      for (var j = 0; j < 3; j++) {
        var a2 = a + (rand() - 0.5) * 1.4;
        var sub = limb(br.tip.clone().add(new THREE.Vector3((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.3)),
          new THREE.Vector3(Math.cos(a2) * 0.8, 0.75, Math.sin(a2) * 0.8), H * 0.26, 0.055, 0.55, 3, 4);
        wood = wood.concat(sub.geo);
        tips.push(sub.tip);
      }
    }
    /* 叶团：每个枝条末端一簇叶片，攒成蓬松树冠而不是一个球 */
    tips.forEach(function (p) {
      for (var k = 0; k < 7; k++) {
        var q = p.clone().add(new THREE.Vector3((rand() - 0.5) * 1.5, (rand() - 0.35) * 1.0, (rand() - 0.5) * 1.5));
        cards.push(card(0.55 + rand() * 0.3, 0.55 + rand() * 0.3, q, rand() * Math.PI * 2, (rand() - 0.5) * 0.9));
      }
    });
    var g = new THREE.Group();
    var wm = new THREE.Mesh(merge(wood), woodMaterial());
    wm.castShadow = true; g.add(wm);
    var lm = new THREE.Mesh(merge(cards), leafMaterial("tree"));
    lm.castShadow = true; g.add(lm);
    return g;
  }

  /* ---------- 竹丛 ---------- */
  function bamboo(opt) {
    opt = opt || {};
    var seed = opt.seed || 5, H = opt.height || 2.6;
    var rand = rng(seed);
    var wood = [], cards = [];
    var n = opt.culms || 7;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rand() * 0.7;
      var off = new THREE.Vector3(Math.cos(a) * (0.15 + rand() * 0.35), 0, Math.sin(a) * (0.15 + rand() * 0.35));
      var h = H * (0.75 + rand() * 0.45);
      var culm = limb(off, new THREE.Vector3((rand() - 0.5) * 0.12, 1, (rand() - 0.5) * 0.12), h, 0.035, 0.55, 5, 5);
      wood = wood.concat(culm.geo);
      for (var k = 0; k < 6; k++) {
        var p = off.clone().lerp(culm.tip, 0.55 + k * 0.08).add(new THREE.Vector3((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5));
        cards.push(card(0.5 + rand() * 0.25, 0.16 + rand() * 0.08, p, rand() * Math.PI * 2, -0.5 + rand()));
      }
    }
    var g = new THREE.Group();
    var wm = new THREE.Mesh(merge(wood), woodMaterial());
    wm.castShadow = true; g.add(wm);
    var lm = new THREE.Mesh(merge(cards), leafMaterial("bamboo"));
    lm.castShadow = true; g.add(lm);
    return g;
  }

  /* ---------- 灌木丛 ---------- */
  function bush(opt) {
    opt = opt || {};
    var seed = opt.seed || 9, R = opt.radius || 0.65;
    var rand = rng(seed);
    var cards = [], twig = [];
    for (var i = 0; i < 34; i++) {
      var a = rand() * Math.PI * 2, ph = Math.acos(1 - 2 * rand() * 0.82);
      var r = R * (0.55 + rand() * 0.5);
      var p = new THREE.Vector3(Math.sin(ph) * Math.cos(a) * r, R * 0.75 + Math.cos(ph) * r * 0.62, Math.sin(ph) * Math.sin(a) * r);
      cards.push(card(0.3 + rand() * 0.22, 0.3 + rand() * 0.22, p, rand() * Math.PI * 2, (rand() - 0.5) * 1.1));
      twig.push(segment(new THREE.Vector3(p.x * 0.2, R * 0.35, p.z * 0.2), p, 0.016, 0.008, 4));
    }
    var g = new THREE.Group();
    var wm = new THREE.Mesh(merge(twig.filter(Boolean)), woodMaterial());
    wm.castShadow = true; g.add(wm);
    var lm = new THREE.Mesh(merge(cards), leafMaterial("tree"));
    lm.castShadow = true; g.add(lm);
    return g;
  }

  /* ---------- 草丛（合并成单个 mesh，几十丛也不心疼） ---------- */
  function grassClump(opt) {
    opt = opt || {};
    var seed = opt.seed || 13, H = opt.height || 0.32, blades = opt.blades || 16;
    var rand = rng(seed);
    var geos = [];
    for (var i = 0; i < blades; i++) {
      var a = (i / blades) * Math.PI * 2 + rand() * 0.6;
      var lean = 0.5 + rand() * 0.9;
      var h = H * (0.7 + rand() * 0.6);
      var w = 0.028 + rand() * 0.012;
      var dir = new THREE.Vector3(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
      var p = new THREE.Vector3(Math.cos(a) * 0.05 * rand(), 0, Math.sin(a) * 0.05 * rand());
      /* 4 段渐细并下垂 */
      for (var s = 0; s < 4; s++) {
        var nxt = p.clone().addScaledVector(dir, h / 4);
        var g = segment(p, nxt, w * (1 - s * 0.22), w * (1 - (s + 1) * 0.22), 3);
        if (g) geos.push(g);
        p = nxt;
        dir.applyAxisAngle(new THREE.Vector3(Math.cos(a + 1.57), 0, Math.sin(a + 1.57)), 0.42);
        dir.normalize();
      }
    }
    var mesh = new THREE.Mesh(merge(geos), new THREE.MeshStandardMaterial({
      color: 0x6f8c4f, roughness: 1, side: THREE.DoubleSide, flatShading: true,
    }));
    mesh.castShadow = true;
    return mesh;
  }

  /* ---------- 太湖石：噪声起伏的多面体，取代原来的三个十二面体 ---------- */
  function rock(opt) {
    opt = opt || {};
    var seed = opt.seed || 17, R = opt.radius || 0.9;
    var geo = new THREE.IcosahedronGeometry(R, 3);
    var pos = geo.attributes.position, rand = rng(seed);
    var v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      var n = Math.sin(v.x * 2.7 + seed) * Math.cos(v.y * 2.2 - seed) * Math.sin(v.z * 3.1 + seed);
      var lift = 1 + n * 0.34 + (rand() - 0.5) * 0.07;
      v.multiplyScalar(lift);
      v.y *= 1.18;                 /* 竖向拉长，取"瘦" */
      v.x *= 0.86; v.z *= 0.86;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x9a9488, roughness: 0.98, flatShading: true,
    }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  return { willow: willow, tree: tree, bamboo: bamboo, bush: bush, grassClump: grassClump, rock: rock };
})();