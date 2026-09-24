/* ============================================================
 * 外观构件（移植自外观原型 tools/exterior-prototype.html）
 * ------------------------------------------------------------
 * 这里只放"坐标无关"的构件生成器：给尺寸/位置就能用，不碰布局。
 * 首个移植件是四项：
 *   hipGeo   举折（凹曲）四坡屋面 —— 曲面 + 翼角起翘，取代原来的平面四坡
 *   hipPt    戗脊线上的屋面坐标（做戗角/垂脊用）
 *   blobGeo  基于 fbm 噪声的球体（石头/太湖石）
 *   rock     摆一块噪声石
 * 依赖：全局 THREE（浏览器）；Node 冒烟环境自动跳过。
 * ============================================================ */
window.MuseumExterior = (function () {
  if (typeof THREE === "undefined" || !THREE.BufferGeometry) return null;

  /* ---------- 噪声（移植：Perlin 风格 2D value noise + fbm） ---------- */
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

  /* ---------- 举折四坡屋面（凹曲 + 翼角起翘） ----------
   * up 越大四角抬得越高；不传则按面阔自动取。
   * 局部坐标：屋面中心在原点，正脊沿 x，檐口在 y=0 平面。 */
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
    patch(function (u, v) { return [u * (hw + (r - hw) * v), -hd * (1 - v), u * w / 2 + hw]; }, false);
    patch(function (u, v) { return [u * (hw + (r - hw) * v), hd * (1 - v), u * w / 2 + hw]; }, true);
    patch(function (u, v) { return [hw * (1 - v) + r * v, u * hd * (1 - v), u * d / 2 + hd + w]; }, false);
    patch(function (u, v) { return [-hw * (1 - v) - r * v, u * hd * (1 - v), u * d / 2 + hd + w]; }, true);
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* 戗脊线（|u|=1）上参数 v 处的屋面坐标 */
  function hipPt(sx, sz, v, hw, hd, r, h, up) {
    return [sx * (hw + (r - hw) * v),
            h * Math.pow(v, 1.7) + up * (1 - v) * (1 - v) + 0.05,
            sz * hd * (1 - v)];
  }

  /* ---------- 噪声球（石头 / 太湖石） ---------- */
  function blobGeo(r, amp, sy, seed) {
    var n = makeNoise(seed), W = 18, H = 12, i, j;
    var pos = [], idx = [];
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
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  return { hipGeo: hipGeo, hipPt: hipPt, blobGeo: blobGeo, fbm: fbm, makeNoise: makeNoise };
})();