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
    if (kind === "willow-cluster") {
      /* 冠层团块：用不规则椭圆的密集狭叶遮住枝干交接点。 */
      ctx.strokeStyle = "rgba(103,132,63,0.72)";
      ctx.lineWidth = 1.2;
      for (var stem = 0; stem < 5; stem++) {
        var bx = 20 + stem * 22;
        ctx.beginPath();
        ctx.moveTo(bx, 8);
        ctx.bezierCurveTo(bx + 5, 42, bx - 6, 88, bx + 1, 122);
        ctx.stroke();
      }
      for (var q = 0; q < 155; q++) {
        var qa = rand() * Math.PI * 2;
        var qr = Math.sqrt(rand());
        var qx = 64 + Math.cos(qa) * qr * 58;
        var qy = 64 + Math.sin(qa) * qr * 59;
        var qw = 1.7 + rand() * 2.2;
        var qh = 8 + rand() * 8;
        var tilt = (rand() - 0.5) * 1.05 + (qy - 64) * 0.004;
        ctx.save();
        ctx.translate(qx, qy);
        ctx.rotate(tilt);
        ctx.beginPath();
        ctx.moveTo(0, -qh * 0.55);
        ctx.quadraticCurveTo(qw, 0, 0, qh * 0.55);
        ctx.quadraticCurveTo(-qw * 0.45, 0, 0, -qh * 0.55);
        ctx.fillStyle = rand() > 0.42
          ? "rgba(126,171,84,0.92)"
          : "rgba(82,135,58,0.9)";
        ctx.fill();
        ctx.restore();
      }
      var clusterTex = new THREE.CanvasTexture(cv);
      clusterTex.encoding = THREE.sRGBEncoding;
      clusterTex.anisotropy = 4;
      clusterTex.needsUpdate = true;
      _leafTex[kind] = clusterTex;
      return clusterTex;
    }
    if (kind === "willow") {
      /* 一张柳帘卡包含三条细枝和密集狭叶，远看接近参考图的细碎叶幕。 */
      var stems = [24, 64, 104];
      for (var s = 0; s < stems.length; s++) {
        var sx = stems[s] + (rand() - 0.5) * 8;
        ctx.strokeStyle = "rgba(104,130,62,0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx, 2);
        ctx.bezierCurveTo(sx + 7, 40, sx - 6, 86, sx + (rand() - 0.5) * 10, 126);
        ctx.stroke();
        for (var l = 0; l < 34; l++) {
          var ly = 4 + l * 3.7 + rand() * 2.2;
          var lx = sx + Math.sin(ly * 0.09 + s) * 4;
          var leafW = 2.2 + rand() * 2.0;
          var leafH = 10 + rand() * 8;
          var side = l % 2 ? 1 : -1;
          var light = rand() > 0.5;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(side * (0.46 + rand() * 0.28));
          ctx.beginPath();
          ctx.moveTo(0, -leafH * 0.55);
          ctx.quadraticCurveTo(side * leafW, 0, 0, leafH * 0.55);
          ctx.quadraticCurveTo(-side * leafW * 0.45, 0, 0, -leafH * 0.55);
          ctx.fillStyle = light
            ? "rgba(143,185,91,0.96)"
            : "rgba(94,145,63,0.94)";
          ctx.fill();
          ctx.restore();
        }
      }
      var willowTex = new THREE.CanvasTexture(cv);
      willowTex.encoding = THREE.sRGBEncoding;
      willowTex.anisotropy = 4;
      willowTex.needsUpdate = true;
      _leafTex[kind] = willowTex;
      return willowTex;
    }
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
      map: leafTexture(kind),
      alphaTest: kind === "willow" || kind === "willow-cluster" ? 0.22 : 0.42,
      side: THREE.DoubleSide,
      color: kind === "willow" || kind === "willow-cluster" ? 0xb8c996 : 0xffffff,
      roughness: 0.96, metalness: 0, transparent: false,
    });
    return _leafMat[kind];
  }

  var _woodMat = null;
  function woodMaterial() {
    if (!_woodMat) _woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5744, roughness: 0.92 });
    return _woodMat;
  }

  var _willowWoodMat = null;
  function willowWoodMaterial() {
    if (_willowWoodMat) return _willowWoodMat;
    var cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#4b3829";
    ctx.fillRect(0, 0, 128, 128);
    var rand = rng(91);
    for (var i = 0; i < 46; i++) {
      var x = rand() * 128;
      var w = 1 + rand() * 3;
      ctx.strokeStyle = rand() > 0.45
        ? "rgba(33,22,15," + (0.22 + rand() * 0.34) + ")"
        : "rgba(122,94,64," + (0.16 + rand() * 0.26) + ")";
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x - 5, 38, x + 7, 82, x - 2, 128);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 3);
    tex.anisotropy = 4;
    _willowWoodMat = new THREE.MeshStandardMaterial({
      map: tex, color: 0xb49a7c, roughness: 0.98, metalness: 0,
    });
    return _willowWoodMat;
  }

  function card(w, h, pos, ry, rx, rz) {
    var g = new THREE.PlaneGeometry(w, h);
    var m = new THREE.Matrix4().compose(
      pos,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz === undefined ? (ry || 0) * 0.3 : rz)),
      new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return g;
  }

  function curvePoint(a, b, c, t) {
    var it = 1 - t;
    return new THREE.Vector3(
      it * it * a.x + 2 * it * t * b.x + t * t * c.x,
      it * it * a.y + 2 * it * t * b.y + t * t * c.y,
      it * it * a.z + 2 * it * t * b.z + t * t * c.z
    );
  }

  function curveLimb(a, b, c, parts, r0, r1, radial) {
    var geos = [], points = [], last = a.clone(), i;
    for (i = 0; i <= parts; i++) points.push(curvePoint(a, b, c, i / parts));
    for (i = 1; i <= parts; i++) {
      var t = i / parts;
      var s = segment(last, points[i], r0 + (r1 - r0) * (i - 1) / parts,
        r0 + (r1 - r0) * t, radial);
      if (s) geos.push(s);
      last = points[i];
    }
    return { geo: geos, points: points, tip: points[points.length - 1] };
  }

  /* ---------- 垂柳 ----------
   * 参考图要点：低矮粗壮的老柳干、明显分叉的骨架、宽伞形树冠，
   * 以及从枝条中后段一路垂到近地面的细长柳帘。 */
  function willow(opt) {
    opt = opt || {};
    var seed = opt.seed || 7, H = opt.height || 4.8;
    var rand = rng(seed);
    var wood = [], cards = [], clusters = [];

    function addCluster(pos, size) {
      var w = size * (0.86 + rand() * 0.25);
      var h = size * (0.82 + rand() * 0.25);
      var ry = rand() * Math.PI * 2;
      clusters.push(card(w, h, pos, ry, (rand() - 0.5) * 0.32, (rand() - 0.5) * 0.75));
      clusters.push(card(w * 0.9, h, pos, ry + Math.PI / 2, (rand() - 0.5) * 0.32, (rand() - 0.5) * 0.75));
    }

    function addStrand(from, outwardX, outwardZ, length, density) {
      var swayX = (rand() - 0.5) * H * 0.08;
      var swayZ = (rand() - 0.5) * H * 0.08;
      var c = from.clone().add(new THREE.Vector3(
        outwardX * 0.14 + swayX * 0.25,
        -length * 0.18,
        outwardZ * 0.14 + swayZ * 0.25
      ));
      var end = from.clone().add(new THREE.Vector3(
        outwardX * 0.34 + swayX,
        -length,
        outwardZ * 0.34 + swayZ
      ));
      var last = from.clone();
      for (var s = 1; s <= 5; s++) {
        var t = s / 5;
        var p = curvePoint(from, c, end, t);
        var twig = segment(last, p, 0.009 * (1 - t * 0.72), 0.009 * (1 - s / 5 * 0.72), 3);
        if (twig) wood.push(twig);
        last = p;
      }
      var count = density || 4;
      for (var k = 0; k < count; k++) {
        var t2 = 0.24 + k * (0.66 / Math.max(1, count - 1)) + rand() * 0.09;
        t2 = Math.min(0.98, t2);
        var p2 = curvePoint(from, c, end, t2);
        p2.x += (rand() - 0.5) * 0.13;
        p2.z += (rand() - 0.5) * 0.13;
        var w = H * (0.115 + rand() * 0.04);
        var h = H * (0.28 + rand() * 0.09);
        var ry = rand() * Math.PI * 2;
        cards.push(card(w, h, p2, ry, (rand() - 0.5) * 0.16, (rand() - 0.5) * 0.48));
        cards.push(card(w * 0.94, h, p2, ry + Math.PI / 2, (rand() - 0.5) * 0.16, (rand() - 0.5) * 0.48));
      }
    }

    /* 树根：向外抓地，去掉旧模型的圆盆底座。 */
    var rootCount = 7;
    for (var r = 0; r < rootCount; r++) {
      var ra = r / rootCount * Math.PI * 2 + rand() * 0.34;
      var rootStart = new THREE.Vector3(Math.cos(ra) * 0.08, H * 0.085, Math.sin(ra) * 0.08);
      var rootEnd = new THREE.Vector3(
        Math.cos(ra) * H * (0.13 + rand() * 0.045),
        0.015 + rand() * 0.025,
        Math.sin(ra) * H * (0.13 + rand() * 0.045)
      );
      var root = segment(rootStart, rootEnd, 0.105, 0.035, 6);
      if (root) wood.push(root);
    }

    /* 主干分三段收分，略向一侧拧转。 */
    var p0 = new THREE.Vector3(0, 0, 0);
    var p1 = new THREE.Vector3(0.035, H * 0.18, 0.018);
    var p2 = new THREE.Vector3(-0.045, H * 0.35, 0.03);
    var p3 = new THREE.Vector3(0.025, H * 0.52, -0.015);
    [
      segment(p0, p1, 0.27, 0.20, 9),
      segment(p1, p2, 0.20, 0.145, 8),
      segment(p2, p3, 0.145, 0.075, 7),
    ].forEach(function (g) { if (g) wood.push(g); });

    function growBranch(start, angle, reach, rise, radius, subBranches) {
      var dirX = Math.cos(angle), dirZ = Math.sin(angle);
      var end = start.clone().add(new THREE.Vector3(dirX * reach, rise, dirZ * reach));
      var control = start.clone().add(new THREE.Vector3(
        dirX * reach * 0.56 + (rand() - 0.5) * H * 0.06,
        rise * 0.82 + H * 0.03,
        dirZ * reach * 0.56 + (rand() - 0.5) * H * 0.06
      ));
      var branch = curveLimb(start, control, end, 7, radius, radius * 0.19, 6);
      wood = wood.concat(branch.geo);

      /* 从主枝中后段再分叉，形成参考图里能看出来的骨架。 */
      if (subBranches) {
        for (var b = 0; b < subBranches; b++) {
          var at = 0.56 + b * 0.17;
          var base = curvePoint(start, control, end, at);
          var sa = angle + (b % 2 ? 1 : -1) * (0.34 + rand() * 0.22);
          var sr = reach * (0.34 + rand() * 0.16);
          var sEnd = base.clone().add(new THREE.Vector3(
            Math.cos(sa) * sr, H * (0.10 + rand() * 0.07), Math.sin(sa) * sr
          ));
          var sCtrl = base.clone().add(new THREE.Vector3(
            Math.cos(sa) * sr * 0.5, H * 0.075, Math.sin(sa) * sr * 0.5
          ));
          var sub = curveLimb(base, sCtrl, sEnd, 4, radius * 0.38, radius * 0.08, 4);
          wood = wood.concat(sub.geo);
          addCluster(sub.points[2].clone().add(new THREE.Vector3(0, H * 0.025, 0)), H * 0.20);
          for (var sd = 0; sd < 3; sd++) {
            var sip = sub.points[2 + sd];
            addStrand(sip,
              Math.cos(sa) * H * (0.05 + rand() * 0.035),
              Math.sin(sa) * H * (0.05 + rand() * 0.035),
              H * (0.28 + rand() * 0.20), 3);
          }
        }
      }
      return branch;
    }

    /* 8 根主枝形成宽而低的伞冠，内圈再补短枝填满树心。 */
    var nMain = 8;
    for (var i = 0; i < nMain; i++) {
      var a = (i / nMain) * Math.PI * 2 + (rand() - 0.5) * 0.42;
      var from = new THREE.Vector3(
        Math.cos(a) * H * (0.015 + rand() * 0.025),
        H * (0.32 + rand() * 0.10),
        Math.sin(a) * H * (0.015 + rand() * 0.025)
      );
      var main = growBranch(
        from, a,
        H * (0.30 + rand() * 0.10),
        H * (0.26 + rand() * 0.11),
        H * (0.018 + rand() * 0.005),
        2
      );
      for (var k = 1; k < main.points.length; k++) {
        if (k < 4) continue;
        var at = main.points[k];
        addCluster(at.clone().add(new THREE.Vector3(0, H * 0.018, 0)), H * (0.18 + rand() * 0.05));
        addStrand(at,
          Math.cos(a) * H * (0.035 + rand() * 0.04),
          Math.sin(a) * H * (0.035 + rand() * 0.04),
          H * (0.30 + rand() * 0.24), 4);
      }
    }

    /* 树心高枝补冠，避免从侧面看只剩一圈下垂的帘子。 */
    for (var c = 0; c < 5; c++) {
      var ca = c / 5 * Math.PI * 2 + rand() * 0.5;
      var cs = new THREE.Vector3(0, H * (0.43 + rand() * 0.04), 0);
      var top = growBranch(
        cs, ca,
        H * (0.18 + rand() * 0.10),
        H * (0.34 + rand() * 0.12),
        H * (0.010 + rand() * 0.004),
        1
      );
      addCluster(top.points[4].clone(), H * 0.17);
      addStrand(top.tip,
        Math.cos(ca) * H * 0.10,
        Math.sin(ca) * H * 0.10,
        H * (0.34 + rand() * 0.20), 4);
    }

    var g = new THREE.Group();
    var woodMesh = new THREE.Mesh(merge(wood), willowWoodMaterial());
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    g.add(woodMesh);
    var leafMesh = new THREE.Mesh(merge(cards), leafMaterial("willow"));
    leafMesh.castShadow = true;
    g.add(leafMesh);
    var clusterMesh = new THREE.Mesh(merge(clusters), leafMaterial("willow-cluster"));
    clusterMesh.castShadow = true;
    g.add(clusterMesh);
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
