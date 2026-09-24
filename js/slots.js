/* ============================================================
 * GLB 真模型替换（由 scripts/vendor-prototype.mjs 自动同步自外观原型主控段）
 * 源文件：tools/exterior-prototype.html —— 请勿手改本文件
 * 作用：读 MuseumExteriorLayout.slots 登记表，把代码件替换成 assets/models/parts/opt/ 里的真模型；
 *       任何一件加载失败就保留代码件（渐进替换、失败回退）。原作者：Kimi
 * ============================================================ */
window.MuseumExteriorSlots = {
  install: function (scene) {
  (function upgradeParts() {
      if (!THREE.GLTFLoader || !window.MuseumExteriorLayout.slots) return;
      var slots = window.MuseumExteriorLayout.slots;
      var loader = new THREE.GLTFLoader();
      var cache = {};
      function load(id) {
        if (!cache[id]) {
          cache[id] = new Promise(function (resolve) {
            loader.load('assets/models/parts/opt/' + id + '.glb',
              function (g) { resolve(g.scene); },
              undefined,
              function () { resolve(null); });
          });
        }
        return cache[id];
      }
      /* 克隆模板：按 mode('h' 对高度 / 'max' 对最大边) 缩放到 size，
         包围盒底面中心落到 (x,y,z)，可再绕 y 转 ry */
      function instantiate(tpl, o) {
        var inner = tpl.clone(true);
        inner.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        var b = new THREE.Box3().setFromObject(inner);
        var sz = b.getSize(new THREE.Vector3());
        var c = b.getCenter(new THREE.Vector3());
        var measure = o.mode === 'max' ? Math.max(sz.x, sz.y, sz.z) : sz.y;
        if (!(measure > 0.001)) return null;
        var k = o.size / measure;
        inner.scale.setScalar(k);
        inner.position.set(-c.x * k, -b.min.y * k, -c.z * k);
        var g = new THREE.Group();
        g.add(inner);
        g.position.set(o.x, o.y || 0, o.z);
        if (o.ry) g.rotation.y = o.ry;
        scene.add(g);
        return g;
      }
      var done = {};
      function mark(id) { done[id] = (done[id] || 0) + 1; }
      function report() {
        var ks = Object.keys(done);
        if (ks.length) console.info('[真模型接线] 已替换：' + ks.map(function (k) { return k + '×' + done[k]; }).join('，'));
      }
  
      /* 景石：大主石用太湖石，配石用圆浑巨石；底端按代码版的埋深落地 */
      Promise.all([load('taihu-rock'), load('rock-boulder')]).then(function (rs) {
        var taihu = rs[0], boulder = rs[1];
        if (!taihu && !boulder) return;
        slots.rock.forEach(function (r) {
          var big = r.r >= 0.85;
          var tpl = big ? (taihu || boulder) : (boulder || taihu);
          var g = instantiate(tpl, {
            mode: big ? 'h' : 'max',
            size: big ? 2 * r.r * r.sy : 2 * r.r * Math.max(1, r.sy),
            x: r.x, y: Math.max(r.y - r.r * r.sy, -0.3), z: r.z,
            ry: r.seed * 1.37
          });
          if (g) { r.mesh.visible = false; mark(big ? '太湖石' : '巨石'); }
        });
        report();
      });
  
      /* 石狮：序厅高台大门两侧一对（落在须弥座上，通高近 2m） */
      load('stone-lion').then(function (tpl) {
        if (!tpl) return;
        slots.lion.forEach(function (L) {
          var g = instantiate(tpl, { mode: 'h', size: 2.45, x: L.x, y: L.y, z: L.z, ry: L.ry });
          if (g) { L.group.visible = false; mark('石狮'); }
        });
        report();
      });
  
      /* 序厅铜鼎：换成青铜方鼎，落在原石座上 */
      load('bronze-ding').then(function (tpl) {
        if (!tpl) return;
        slots.ding.forEach(function (d) {
          var g = instantiate(tpl, { mode: 'h', size: 1.9, x: d.x, y: d.y, z: d.z, ry: 0.3 });
          if (g) { d.group.visible = false; mark('青铜鼎'); }
        });
        report();
      });
  
      /* 树：沿墙一排用冷杉，水边用垂柳，庭院里用杂树 */
      Promise.all([load('tree'), load('willow'), load('fir-tree')]).then(function (ts) {
        var tree = ts[0], willow = ts[1], fir = ts[2];
        if (!tree && !willow && !fir) return;
        slots.tree.forEach(function (t) {
          var tpl, size, name;
          var nearWater = (Math.abs(t.x) < 17 && t.z > -8 && t.z < 10) ||
                          (t.x > 12 && t.x < 30 && t.z > 3 && t.z < 21);
          if (t.z < -36 || Math.abs(t.x) > 44) { tpl = fir || tree || willow; size = 5.0 * t.s; name = '冷杉'; }
          else if (nearWater) { tpl = willow || tree || fir; size = 4.2 * t.s; name = '垂柳'; }
          else { tpl = tree || willow || fir; size = 3.8 * t.s; name = '庭院树'; }
          var g = tpl && instantiate(tpl, { mode: 'h', size: size, x: t.x, y: 0, z: t.z, ry: t.seed * 0.9 });
          if (g) { t.group.visible = false; mark(name); }
        });
        report();
      });
  
      /* 竹丛 */
      load('bamboo').then(function (tpl) {
        if (!tpl) return;
        slots.bamboo.forEach(function (b) {
          var g = instantiate(tpl, { mode: 'h', size: 3.5 * b.k, x: b.x, y: 0, z: b.z, ry: b.seed * 0.7 });
          if (g) { b.group.visible = false; mark('竹丛'); }
        });
        report();
      });
  
      /* ---------- 案头小品与架侧摆件（代码建模，随布展落位） ---------- */
      var MT = {
        celadon: new THREE.MeshStandardMaterial({ color: 0x9db8a6, roughness: 0.3 }),
        whitePorc: new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.22 }),
        inkstone: new THREE.MeshStandardMaterial({ color: 0x2e2d33, roughness: 0.5 }),
        woodD: new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.8 }),
        paper: new THREE.MeshStandardMaterial({ color: 0xe9e0c9, roughness: 0.95 }),
        red: new THREE.MeshStandardMaterial({ color: 0x9e2b23, roughness: 0.6 }),
        stoneG: new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.9 })
      };
      function handscrollTex(seed) {
        var cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ece3cd'; ctx.fillRect(0, 0, 128, 64);
        var s = (seed >>> 0) || 7;
        function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
        var i, x, y;
        ctx.strokeStyle = 'rgba(50,54,50,0.75)'; ctx.lineWidth = 2;
        for (i = 0; i < 4; i++) {
          ctx.beginPath();
          x = 12 + i * 26 + rnd() * 8; y = 46 - rnd() * 10;
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 8 + rnd() * 8, y - 18 - rnd() * 10, x + 4 + rnd() * 14, y - 26 - rnd() * 8);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(50,54,50,0.35)';
        ctx.beginPath(); ctx.ellipse(30 + rnd() * 60, 52, 18 + rnd() * 10, 6 + rnd() * 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#a53328'; ctx.fillRect(112, 8, 8, 8);
        var t = new THREE.CanvasTexture(cv);
        t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
        return t;
      }
      function vaseMesh(mat, s) {
        var prof = [[0.001, 0], [0.42, 0], [0.6, 0.06], [0.72, 0.3], [0.55, 0.62], [0.34, 0.8], [0.3, 0.9], [0.4, 1.0]];
        var pts = prof.map(function (p) { return new THREE.Vector2(p[0] * s, p[1] * s); });
        var m = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat);
        m.castShadow = m.receiveShadow = true;
        return m;
      }
      /* 长案案头：青瓷瓶 + 平铺手卷（带画心与轴杆）+ 卷轴捆 + 砚台笔山（书斋）/ 白瓷碗（展厅） */
      function tabletopSet(cx, cz, ux, uz, topY, seed, isBook) {
        var g = new THREE.Group();
        g.position.set(cx, topY, cz);
        g.rotation.y = Math.atan2(-uz, ux);
        scene.add(g);
        function put(m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }
        put(vaseMesh(MT.celadon, 0.3), -0.52, 0, 0.05);
        put(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.012, 0.32), MT.paper), -0.02, 0.006, 0.02);
        var paint = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.24),
          new THREE.MeshStandardMaterial({ map: handscrollTex(seed), roughness: 0.92 }));
        paint.rotation.x = -Math.PI / 2; put(paint, -0.02, 0.014, 0.02);
        var r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), MT.woodD);
        r1.rotation.x = Math.PI / 2; put(r1, -0.39, 0.02, 0.02);
        var r2 = r1.clone(); put(r2, 0.35, 0.02, 0.02);
        var i, rr;
        var offs = [[0.55, 0.032, -0.05], [0.55, 0.032, 0.07], [0.56, 0.095, 0.01]];
        for (i = 0; i < 3; i++) {
          rr = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.5, 10), MT.paper);
          rr.rotation.z = Math.PI / 2; rr.rotation.y = (i - 1) * 0.06;
          rr.castShadow = rr.receiveShadow = true;
          put(rr, offs[i][0], offs[i][1], offs[i][2]);
        }
        if (isBook) {
          put(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.14), MT.inkstone), 0.78, 0.018, -0.06);
          var j, bh;
          for (j = -1; j <= 1; j++) {
            bh = 0.05 + (1 - Math.abs(j)) * 0.03;
            put(new THREE.Mesh(new THREE.BoxGeometry(0.045, bh, 0.04), MT.woodD), 0.7 + j * 0.06, bh / 2, 0.1);
          }
          var br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 6), MT.red);
          br.rotation.z = Math.PI / 2; br.rotation.y = 0.15;
          put(br, 0.7, 0.085, 0.1);
        } else {
          var bpts = [[0.001, 0], [0.045, 0], [0.07, 0.05], [0.062, 0.1], [0.055, 0.115]]
            .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
          put(new THREE.Mesh(new THREE.LatheGeometry(bpts, 16), MT.whitePorc), 0.78, 0, 0.02);
        }
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      }
      /* 卷轴缸（书斋/临摹架侧）：敞口瓷缸插四支错落卷轴 */
      function scrollPot(x, z, y, seed) {
        var g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
        var potMat = new THREE.MeshStandardMaterial({ color: 0x8fa89a, roughness: 0.4, side: THREE.DoubleSide });
        var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.42, 14, 1, true), potMat);
        pot.position.y = 0.21; g.add(pot);
        var bot = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), potMat);
        bot.rotation.x = Math.PI / 2; bot.position.y = 0.005; g.add(bot);
        var i, a, t, len, rl, cap;
        for (i = 0; i < 4; i++) {
          a = i * 1.7 + seed; t = 0.05 + (i % 2) * 0.06; len = 0.5 + ((i * 7) % 3) * 0.08;
          rl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 8), MT.paper);
          rl.position.set(Math.cos(a) * 0.07, 0.4, Math.sin(a) * 0.07);
          rl.rotation.set(Math.sin(a) * t, 0, Math.cos(a) * t);
          cap = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.03, 8), MT.woodD);
          cap.position.y = len / 2 + 0.01; rl.add(cap);
          g.add(rl);
        }
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      }
      /* 独立展台（展厅架侧）：石方墩 + 木托 + 瓷瓶 */
      function pedestalVase(x, z, y, seed) {
        var g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
        var ped = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.42), MT.stoneG);
        ped.position.y = 0.475; g.add(ped);
        var tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), MT.woodD);
        tray.position.y = 0.97; g.add(tray);
        var v = vaseMesh(seed % 2 ? MT.whitePorc : MT.celadon, 0.36);
        v.position.y = 0.99; g.add(v);
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      }
  
      /* 架格小件：册页叠 / 瓷碟木托 / 小瓶；书架用线装书摞 / 立放书 */
      function miniItem(kind, seed) {
        var g = new THREE.Group(), i, m;
        var bookBlue = new THREE.MeshStandardMaterial({ color: 0x3a4a6b, roughness: 0.85 });
        if (kind === 0) {
          for (i = 0; i < 3; i++) {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.022, 0.12), i === 1 ? bookBlue : MT.paper);
            m.position.y = 0.012 + i * 0.024; m.rotation.y = (i - 1) * 0.12; g.add(m);
          }
        } else if (kind === 1) {
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.018, 12), MT.whitePorc);
          m.position.y = 0.03; g.add(m);
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.014, 10), MT.woodD);
          m.position.y = 0.007; g.add(m);
        } else if (kind === 2) {
          g.add(vaseMesh(seed % 2 ? MT.celadon : MT.whitePorc, 0.13));
        } else if (kind === 3) {
          var n2 = 3 + seed % 3;
          for (i = 0; i < n2; i++) {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.105), i % 2 ? bookBlue : MT.paper);
            m.position.y = 0.011 + i * 0.021; m.rotation.y = (i % 2 ? -1 : 1) * 0.05; g.add(m);
          }
        } else {
          var n3 = 4 + seed % 3, x0 = -(n3 - 1) * 0.014;
          for (i = 0; i < n3; i++) {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.155, 0.105), i % 3 === 1 ? MT.paper : bookBlue);
            m.position.set(x0 + i * 0.028, 0.078, 0); g.add(m);
          }
          m = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.15, 0.105), bookBlue);
          m.position.set(x0 + n3 * 0.028 + 0.02, 0.075, 0); m.rotation.z = -0.28; g.add(m);
        }
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        return g;
      }
      /* 架格填充：从架顶向下打射线找真实层板面，小件落在板上，绝不悬空 */
      function shelfFill(sg, isBook, seed) {
        var bb = new THREE.Box3().setFromObject(sg);
        var top = bb.max.y, bot = bb.min.y;
        var cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        var horizShelf = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
        var half = (horizShelf ? bb.max.x - bb.min.x : bb.max.z - bb.min.z) / 2 - 0.14;
        var rc = new THREE.Raycaster(), dir = new THREE.Vector3(0, -1, 0), org = new THREE.Vector3();
        var offs = [-0.56, -0.28, 0.02, 0.3, 0.58], placed = 0, ci;
        for (ci = 0; ci < offs.length && placed < 4; ci++) {
          var o = Math.max(-half, Math.min(half, offs[ci]));
          org.set(cx + (horizShelf ? o : 0), top + 0.05, cz + (horizShelf ? 0 : o));
          rc.set(org, dir);
          var hits = rc.intersectObject(sg, true), spots = [], hi;
          for (hi = 0; hi < hits.length; hi += 2) {
            var hy = hits[hi].point.y;
            if (hy < top - 0.1 && hy > bot + 0.12) spots.push(hits[hi].point);
          }
          if (!spots.length) continue;
          var pt = spots[(seed + ci) % spots.length];
          var kind = isBook ? (3 + ((seed + ci) % 2)) : ((seed + ci * 2) % 3);
          var it = miniItem(kind, seed + ci);
          it.position.set(pt.x, pt.y + 0.004, pt.z);
          it.rotation.y = ((seed * 7 + ci * 13) % 10) / 10 - 0.5;
          scene.add(it);
          placed++;
        }
      }
  
      /* 室内陈设布展：后墙一架排 + 架前长案 + 案两端宫灯 + 案前方凳；
         书斋/临摹用书架，其余展厅用展示架；人物馆加将军俑一对与马踏飞燕居中展台；
         长案案头摆卷轴瓷器，架侧书斋配卷轴缸、展厅配独立展台 */
      function furnishHall(h, L) {
        var floor = 0.62;   /* 台基顶面 */
        var horiz = (h.entry === 'S' || h.entry === 'N');
        var len = horiz ? h.w : h.d, dep = horiz ? h.d : h.w;
        if (len < 4.5 || dep < 4) return;   /* 过小的门厅不摆 */
        /* 室内暖光一盏（悬挂高度，照亮陈设） */
        var pl = new THREE.PointLight(0xffe2b8, 0.85, Math.max(len, dep) * 1.5, 1);
        pl.position.set(h.cx, 2.7, h.cz); scene.add(pl);
        /* b = 由大门指向后墙的单位向量；u = 沿后墙方向的单位向量 */
        var bx = 0, bz = 0;
        if (h.entry === 'S') bz = -1; else if (h.entry === 'N') bz = 1;
        else if (h.entry === 'E') bx = -1; else bx = 1;
        var ux = horiz ? 1 : 0, uz = horiz ? 0 : 1;
        var faceRy = horiz ? (bz < 0 ? 0 : Math.PI) : (bx < 0 ? Math.PI / 2 : -Math.PI / 2);
        function at(uOff, bOff) { return [h.cx + ux * uOff + bx * bOff, h.cz + uz * uOff + bz * bOff]; }
        var isBook = (h.tag === '书斋' || h.tag === '临摹');
        var seedBase = (Math.floor(Math.abs(h.cx) * 31 + Math.abs(h.cz) * 17) >>> 0);
        var shelfTpl = isBook ? (L.shelf || L.display) : (L.display || L.shelf);
        var i, p;
        if (shelfTpl) {
          var n = Math.max(1, Math.floor((len - 2.2) / 1.35));
          var u0 = -(n - 1) * 1.35 / 2;
          for (i = 0; i < n; i++) {
            p = at(u0 + i * 1.35, dep / 2 - 0.55);
            var sg = instantiate(shelfTpl, { mode: 'h', size: isBook ? 2.0 : 1.8, x: p[0], y: floor, z: p[1], ry: faceRy });
            if (sg) { mark(isBook ? '书架' : '展示架'); shelfFill(sg, isBook, seedBase + i * 11); }
          }
          /* 架排两端：书斋/临摹配卷轴缸，展厅配独立展台瓷瓶 */
          var uEnd = -u0 + 0.7, side, fp;
          for (side = -1; side <= 1; side += 2) {
            var uu = side * (uEnd + 0.55);
            if (Math.abs(uu) < len / 2 - 0.5) {
              fp = at(uu, dep / 2 - 0.85);
              if (isBook) scrollPot(fp[0], fp[1], floor, seedBase + side + 3);
              else pedestalVase(fp[0], fp[1], floor, seedBase + side + 3);
            }
          }
        }
        if (L.table) {
          p = at(0, dep / 2 - 1.75);
          var tg = instantiate(L.table, { mode: 'max', size: 2.4, x: p[0], y: floor, z: p[1], ry: faceRy });
          if (tg) {
            mark('长案');
            var tbb = new THREE.Box3().setFromObject(tg);
            tabletopSet(p[0], p[1], ux, uz, tbb.max.y + 0.005, seedBase, isBook);
          }
          if (L.lamp) {
            var lp1 = at(-1.0, dep / 2 - 1.75), lp2 = at(1.0, dep / 2 - 1.75);
            if (instantiate(L.lamp, { mode: 'h', size: 0.6, x: lp1[0], y: floor + 0.9, z: lp1[1] })) mark('宫灯');
            if (instantiate(L.lamp, { mode: 'h', size: 0.6, x: lp2[0], y: floor + 0.9, z: lp2[1] })) mark('宫灯');
          }
        }
        if (L.stool) {
          var s1 = at(-0.7, dep / 2 - 2.6), s2 = at(0.7, dep / 2 - 2.6);
          if (instantiate(L.stool, { mode: 'h', size: 0.45, x: s1[0], y: floor, z: s1[1], ry: faceRy })) mark('方凳');
          if (instantiate(L.stool, { mode: 'h', size: 0.45, x: s2[0], y: floor, z: s2[1], ry: faceRy + 0.4 })) mark('方凳');
        }
        if (h.tag === '人物') {
          if (L.warrior) {
            var w1 = at(-len / 4, dep / 2 - 3.4), w2 = at(len / 4, dep / 2 - 3.4);
            if (instantiate(L.warrior, { mode: 'h', size: 1.6, x: w1[0], y: floor, z: w1[1], ry: faceRy })) mark('将军俑');
            if (instantiate(L.warrior, { mode: 'h', size: 1.6, x: w2[0], y: floor, z: w2[1], ry: faceRy })) mark('将军俑');
          }
          if (L.horse) {
            var hp = at(0, dep / 2 - 3.4);
            var ped = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.8),
              new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.9 }));
            ped.position.set(hp[0], floor + 0.375, hp[1]);
            ped.rotation.y = faceRy;
            ped.castShadow = ped.receiveShadow = true; scene.add(ped);
            if (instantiate(L.horse, { mode: 'h', size: 1.1, x: hp[0], y: floor + 0.75, z: hp[1], ry: faceRy + Math.PI / 2 })) mark('马踏飞燕');
          }
        }
      }
      Promise.all([load('long-table'), load('bookshelf'), load('display-shelf'), load('stool'), load('lantern'), load('warrior'), load('horse')]).then(function (fs) {
        var L = { table: fs[0], shelf: fs[1], display: fs[2], stool: fs[3], lamp: fs[4], warrior: fs[5], horse: fs[6] };
        slots.hall.forEach(function (h) { furnishHall(h, L); });
        report();
      });
    })();
  }
};
