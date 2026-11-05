/* ============================================================
 * GLB 真模型替换（由 scripts/vendor-prototype.mjs 自动同步自外观原型主控段）
 * 源文件：tools/exterior-prototype.html —— 请勿手改本文件
 * 作用：读 MuseumExteriorLayout.slots 登记表，把代码件替换成 assets/models/parts/opt/ 里的真模型；
 *       任何一件加载失败就保留代码件（渐进替换、失败回退）。原作者：Kimi
 * ============================================================ */
window.MuseumExteriorSlots = {
  install: function (scene) {
  var resolveReady;
  window.MuseumExteriorSlots.ready = new Promise(function (resolve) { resolveReady = resolve; });
  (function upgradeParts() {
      if (!THREE.GLTFLoader || !window.MuseumExteriorLayout.slots) { resolveReady(); return; }
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
          else if (nearWater) {
            /* 应用内优先用程序化柳树：老 willow.glb 的树冠偏窄且带盆状底座。 */
            tpl = (window.MuseumFoliage && window.MuseumFoliage.willow)
              ? window.MuseumFoliage.willow({ seed: t.seed, height: 4.8 })
              : (willow || tree || fir);
            size = 4.2 * t.s;
            name = '垂柳';
          }
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
      /* 芭蕉：宽叶放射，挺拔株型，按 3.4m 归一 */
      load('banana').then(function (tpl) {
        if (!tpl) return;
        slots.banana.forEach(function (b) {
          var g = instantiate(tpl, { mode: 'h', size: 3.4 * b.k, x: b.x, y: 0, z: b.z, ry: b.seed * 0.8 });
          if (g) { b.group.visible = false; mark('芭蕉'); }
        });
        report();
      });
      /* 沿阶草：低面数草丛，逐点撒放，不合并，保留每丛自己的朝向 */
      load('grass-tuft').then(function (tpl) {
        if (!tpl) return;
        slots.grassTuft.forEach(function (t) {
          var g = instantiate(tpl, { mode: 'h', size: 0.3 * t.k, x: t.x, y: 0, z: t.z, ry: t.seed * 1.1 });
          if (g) { t.group.visible = false; mark('沿阶草'); }
        });
        report();
      });
      /* 枯木：林下水平构件 */
      load('dead-trunk').then(function (tpl) {
        if (!tpl) return;
        slots.deadTrunk.forEach(function (d) {
          // 枯木是横向资产，按高度缩放会把长度放大到失真；最大边长控制在约 3m。
          var g = instantiate(tpl, { mode: 'max', size: 3.0 * d.k, x: d.x, y: 0, z: d.z, ry: d.seed * 0.9 });
          if (g) { d.group.visible = false; mark('枯木'); }
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
        stoneG: new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.9 }),
        leafG: new THREE.MeshStandardMaterial({ color: 0x5c6a4a, roughness: 0.9 })
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
      /* 竖幅立轴画心（山水/人物/花鸟各厅墙面挂画用）：远山 + 近坡 + 枯树 + 朱印 */
      function scrollTexV(seed) {
        var cv = document.createElement('canvas'); cv.width = 96; cv.height = 192;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ece3cd'; ctx.fillRect(0, 0, 96, 192);
        var s = (seed >>> 0) || 7;
        function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
        var i, y;
        ctx.strokeStyle = 'rgba(50,54,50,0.7)'; ctx.lineWidth = 2.5;
        for (i = 0; i < 3; i++) {
          ctx.beginPath();
          y = 118 - i * 26 - rnd() * 12;
          ctx.moveTo(8 + rnd() * 10, y);
          ctx.quadraticCurveTo(30 + rnd() * 20, y - 26 - rnd() * 16, 55 + rnd() * 20, y - 6 - rnd() * 10);
          ctx.quadraticCurveTo(70 + rnd() * 14, y + 4, 88, y - 8 - rnd() * 8);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(50,54,50,0.3)';
        ctx.beginPath(); ctx.ellipse(34 + rnd() * 24, 160, 26 + rnd() * 12, 9, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(50,54,50,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(70, 168); ctx.quadraticCurveTo(72, 150, 78, 140); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(72, 156); ctx.quadraticCurveTo(66, 148, 60, 146); ctx.stroke();
        ctx.fillStyle = '#a53328'; ctx.fillRect(74, 12, 10, 10);
        var t = new THREE.CanvasTexture(cv);
        t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
        return t;
      }
      /* 墙面立轴：画心 + 上下轴杆 + 轴头（ry 决定朝向，挂在 ±|u| 墙或后墙上） */
      function wallScrollAt(x, z, ry, seed) {
        var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
        var paper = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.6),
          new THREE.MeshStandardMaterial({ map: scrollTexV(seed), roughness: 0.92 }));
        paper.position.set(0, 2.05, 0.05); g.add(paper);
        var rodT = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.82, 8), MT.woodD);
        rodT.rotation.z = Math.PI / 2; rodT.position.set(0, 2.88, 0.05); g.add(rodT);
        var rodB = rodT.clone(); rodB.position.y = 1.22; g.add(rodB);
        var k1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), MT.woodD);
        k1.position.set(-0.43, 1.22, 0.05); g.add(k1);
        var k2 = k1.clone(); k2.position.x = 0.43; g.add(k2);
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      }
      /* 盆栽：青瓷盆 + 木干 + 三团枝叶（厅堂角落/门口点景） */
      function potted(x, z, y, seed) {
        var g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
        var pts = [[0.001, 0], [0.11, 0], [0.14, 0.04], [0.115, 0.22], [0.135, 0.26]]
          .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
        g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 14), MT.celadon));
        var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.34, 6), MT.woodD);
        tr.position.y = 0.42; g.add(tr);
        var i, lf, offs = [[0, 0.62, 0, 0.16], [0.1, 0.52, 0.05, 0.12], [-0.09, 0.55, -0.04, 0.1]];
        for (i = 0; i < 3; i++) {
          lf = new THREE.Mesh(new THREE.SphereGeometry(offs[i][3], 10, 8), MT.leafG);
          lf.scale.y = 0.75; lf.position.set(offs[i][0], offs[i][1], offs[i][2]); g.add(lf);
        }
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      }
      /* 三折屏风：木框纸心，折角围合（人物馆背屏 / 书斋侧屏） */
      function screenMesh(x, z, y, ry) {
        var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
        var i, pg, m;
        for (i = -1; i <= 1; i++) {
          pg = new THREE.Group(); pg.position.x = i * 0.58; pg.rotation.y = i * 0.22; g.add(pg);
          m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.75, 0.05), MT.woodD); m.position.set(-0.26, 0.875, 0); pg.add(m);
          m = m.clone(); m.position.x = 0.26; pg.add(m);
          m = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.06, 0.05), MT.woodD); m.position.set(0, 0.06, 0); pg.add(m);
          m = m.clone(); m.position.y = 1.7; pg.add(m);
          m = new THREE.Mesh(new THREE.BoxGeometry(0.47, 1.56, 0.02), MT.paper); m.position.set(0, 0.88, 0); pg.add(m);
        }
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      }
      /* 茶席：木托盘 + 青瓷壶 + 白瓷杯三盏（茶室中央长案案面） */
      function teaSet(x, z, topY, seed) {
        var g = new THREE.Group(); g.position.set(x, topY, z); scene.add(g);
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.34), MT.woodD);
        m.position.y = 0.01; g.add(m);
        var pot = vaseMesh(MT.celadon, 0.22); pot.position.set(-0.14, 0.02, 0); g.add(pot);
        var cupPts = [[0.001, 0], [0.04, 0], [0.055, 0.03], [0.05, 0.06]]
          .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
        var i, cup, pos = [[0.08, -0.09], [0.08, 0.09], [0.2, 0]];
        for (i = 0; i < 3; i++) {
          cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 12), MT.whitePorc);
          cup.position.set(pos[i][0], 0.02, pos[i][1]); g.add(cup);
        }
        g.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
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
      /* 室内陈设布展：按厅定式，不再千厅一面——
         山水=立轴画廊（后墙三联轴 + 侧墙对轴 + 中央长案手卷 + 卷轴缸）
         花鸟=中岛展台（四墩瓷瓶 + 后墙架排 + 门口盆景 + 侧墙立轴）
         人物=俑阵（将军俑两对 + 马踏飞燕居中 + 三折背屏 + 侧墙立轴）
         书斋=文人书房（书架满墙 + 文房长案 + 卷轴缸 + 侧屏 + 盆栽）
         临摹=摹帖课桌（书架 + 双排书案 + 方凳面案）
         文创=文创商店（货架 + 展台矩阵 + 角落盆景）
         茶室=茶寮（中央茶桌四凳 + 茶席 + 后墙双架 + 角落盆景）
         其余=经典式（后墙架排 + 长案宫灯方凳） */
      function furnishHall(h, L) {
        var floor = 0.62;   /* 台基顶面 */
        var horiz = (h.entry === 'S' || h.entry === 'N');
        var len = horiz ? h.w : h.d, dep = horiz ? h.d : h.w;
        if (len < 4.5 || dep < 4) return;   /* 过小的门厅不摆 */
        /* 室内暖光一盏（挂高 3.1m 兼洗屋面暗部，照亮陈设；白天 1.45 不再死黑） */
        var pl = new THREE.PointLight(0xffe9cf, 1.45, Math.max(len, dep) * 1.5, 1);
        pl.position.set(h.cx, 3.1, h.cz); scene.add(pl);
        /* b = 由大门指向后墙的单位向量；u = 沿后墙方向的单位向量 */
        var bx = 0, bz = 0;
        if (h.entry === 'S') bz = -1; else if (h.entry === 'N') bz = 1;
        else if (h.entry === 'E') bx = -1; else bx = 1;
        var ux = horiz ? 1 : 0, uz = horiz ? 0 : 1;
        var faceRy = horiz ? (bz < 0 ? 0 : Math.PI) : (bx < 0 ? Math.PI / 2 : -Math.PI / 2);
        function at(uOff, bOff) { return [h.cx + ux * uOff + bx * bOff, h.cz + uz * uOff + bz * bOff]; }
        var tag = h.tag;
        var isBook = (tag === '书斋' || tag === '临摹');
        var seedBase = (Math.floor(Math.abs(h.cx) * 31 + Math.abs(h.cz) * 17) >>> 0);
        var shelfTpl = isBook ? (L.shelf || L.display) : (L.display || L.shelf);
        var i, p;
        /* ---- 共用构件 ---- */
        function shelfRow(maxN, bOff) {
          if (!shelfTpl) return;
          var n = Math.max(1, Math.min(maxN, Math.floor((len - 2.2) / 1.35)));
          var u0 = -(n - 1) * 1.35 / 2;
          for (i = 0; i < n; i++) {
            var uu = u0 + i * 1.35;
            /* 后门已全部撤除，架排中轴不再断开——贴后墙连成整排（与山水厅「架排后墙封死」同规） */
            p = at(uu, bOff);
            var sg = instantiate(shelfTpl, { mode: 'h', size: isBook ? 2.0 : 1.8, x: p[0], y: floor, z: p[1], ry: faceRy });
            if (sg) { mark(isBook ? '书架' : '展示架'); shelfFill(sg, isBook, seedBase + i * 11); }
          }
        }
        function longTable(bOff, size, withLamps, book2) {
          if (!L.table) return;
          p = at(0, bOff);
          var tg = instantiate(L.table, { mode: 'max', size: size || 2.4, x: p[0], y: floor, z: p[1], ry: faceRy });
          if (tg) {
            mark('长案');
            var tbb = new THREE.Box3().setFromObject(tg);
            tabletopSet(p[0], p[1], ux, uz, tbb.max.y + 0.005, seedBase + Math.round(bOff * 10), book2 === undefined ? isBook : book2);
          }
          if (withLamps && L.lamp) {
            var lp1 = at(-1.0, bOff), lp2 = at(1.0, bOff);
            if (instantiate(L.lamp, { mode: 'h', size: 0.6, x: lp1[0], y: floor + 0.9, z: lp1[1] })) mark('宫灯');
            if (instantiate(L.lamp, { mode: 'h', size: 0.6, x: lp2[0], y: floor + 0.9, z: lp2[1] })) mark('宫灯');
          }
        }
        function stoolAt(uOff, bOff, ry) {
          if (!L.stool) return;
          p = at(uOff, bOff);
          if (instantiate(L.stool, { mode: 'h', size: 0.45, x: p[0], y: floor, z: p[1], ry: ry })) mark('方凳');
        }
        function lampPair(uOff, bOff) {
          if (!L.lamp) return;
          var q1 = at(-uOff, bOff), q2 = at(uOff, bOff);
          if (instantiate(L.lamp, { mode: 'h', size: 0.6, x: q1[0], y: floor + 0.9, z: q1[1] })) mark('宫灯');
          if (instantiate(L.lamp, { mode: 'h', size: 0.6, x: q2[0], y: floor + 0.9, z: q2[1] })) mark('宫灯');
        }
        function backScroll(uOff, seed, bOff2) { p = at(uOff, bOff2 === undefined ? dep / 2 - 0.45 : bOff2); wallScrollAt(p[0], p[1], faceRy, seed); }
        function sideScroll(sig, bOff, seed) {
          p = at(sig * (len / 2 - 0.42), bOff);
          wallScrollAt(p[0], p[1], Math.atan2(-sig * ux, -sig * uz), seed);
        }
        /* 侧墙挂画别名：团队重构时删掉了这个包装函数，
           但人物厅的展线仍按 sideArtwork(sig, bOff, id) 调用，这里补回。 */
        function sideArtwork(sig, bOff, id) { sideScroll(sig, bOff, id); }
        function potAt(uOff, bOff, seed) { p = at(uOff, bOff); potted(p[0], p[1], floor, seed); }
        function pedestalAt(uOff, bOff, seed) { p = at(uOff, bOff); pedestalVase(p[0], p[1], floor, seed); }
        function pot2(uOff, bOff, seed) { p = at(uOff, bOff); scrollPot(p[0], p[1], floor, seed); }

        /* ---- 按厅定式 ---- */
        if (tag === '山水') {
          backScroll(-2.2, seedBase + 1, dep / 2 - 0.75); backScroll(0, seedBase + 2, dep / 2 - 0.75); backScroll(2.2, seedBase + 3, dep / 2 - 0.75);
          sideScroll(-1, 1.2, seedBase + 4); sideScroll(-1, -1.6, seedBase + 5);
          sideScroll(1, 1.2, seedBase + 6); sideScroll(1, -1.6, seedBase + 7);
          longTable(dep / 2 - 2.6, 2.4, true, false);
          stoolAt(-0.7, dep / 2 - 3.5, faceRy); stoolAt(0.7, dep / 2 - 3.5, faceRy + 0.4);
          pot2(-len / 2 + 0.9, dep / 2 - 0.9, seedBase + 8); pot2(len / 2 - 0.9, dep / 2 - 0.9, seedBase + 9);
          pedestalAt(-1.9, dep / 2 - 2.6, seedBase + 10); pedestalAt(1.9, dep / 2 - 2.6, seedBase + 11);
        } else if (tag === '花鸟') {
          shelfRow(6, dep / 2 - 0.55);
          pedestalAt(-0.95, 0.4, seedBase + 1); pedestalAt(0.95, 0.4, seedBase + 2);
          pedestalAt(-0.95, -1.3, seedBase + 3); pedestalAt(0.95, -1.3, seedBase + 4);
          potAt(-1.9, -dep / 2 + 1.2, seedBase + 5); potAt(1.9, -dep / 2 + 1.2, seedBase + 6);
          sideScroll(-1, 0.5, seedBase + 7); sideScroll(1, 0.5, seedBase + 8);
          lampPair(2.2, -0.45);
        } else if (tag === '人物') {
          /* 面向正门时左侧为西方，右侧为中国，形成同题材对照。
             侧墙可用长度 = dep（5.5m），立轴宽 0.72m，故侧墙每面最多 5 幅、
             间距 1.1m 才能排进 ±2.2 之内。早先把 9 幅全排在侧墙、
             偏移跨到 +4.2~-5.0，超出墙面 5.5m 的范围，画会甩到墙外。 */
          sideArtwork(-1, 1.4, 'monalisa');
          sideArtwork(-1, -1.4, 'starrynight');
          var chineseWall = [
            ['hanxizai', 2.2], ['qianlijiangshan', 1.1],
            ['buniantu', 0], ['xieshengzhenqintu', -1.1],
            ['luoshenfu', -2.2]
          ];
          for (i = 0; i < chineseWall.length; i++) {
            sideArtwork(1, chineseWall[i][1], chineseWall[i][0]);
          }
          /* 余下 4 幅挪到后墙：后墙宽 len（15.3m），从容排开 */
          var backUs = [-2.4, -0.8, 0.8, 2.4];
          var backIds = ['fuchunshanjv', 'xishanxinglvtu', 'wuniutu', 'molantu'];
          for (i = 0; i < backUs.length; i++) {
            backScroll(backUs[i], backIds[i], dep / 2 - 0.42);
          }
          /* 人物厅中心对照：左侧维纳斯，右侧将军俑；各配方形石基座与铭牌，
             对应参考图里「西方雕塑 / 中国人物雕塑」两块铜牌的做法。 */
          var compareB = dep / 2 - 2.8;
          /* 方形石基座 + 正面铭牌；返回顶面高度，雕塑站上去 */
          function sculpturePlinth(px, pz, text) {
            var pw = 1.55, ph = 0.92, pd = 1.15;
            var pg = new THREE.Group();
            pg.position.set(px, floor, pz);
            scene.add(pg);
            var body = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), MT.stoneG);
            body.position.y = ph / 2;
            body.castShadow = true; body.receiveShadow = true;
            pg.add(body);
            /* 上下压边，避免一块光板 */
            var cap = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.12, 0.07, pd + 0.12), MT.stoneG);
            cap.position.y = ph - 0.035; cap.castShadow = true; pg.add(cap);
            var foot = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.12, 0.07, pd + 0.12), MT.stoneG);
            foot.position.y = 0.035; foot.receiveShadow = true; pg.add(foot);
            /* 铭牌：canvas 写字，贴在正面（朝 +z，与厅门方向一致） */
            var cv = document.createElement('canvas');
            cv.width = 512; cv.height = 128;
            var cx2 = cv.getContext('2d');
            cx2.fillStyle = '#2b2b2b'; cx2.fillRect(0, 0, 512, 128);
            cx2.strokeStyle = 'rgba(198,168,104,0.75)'; cx2.lineWidth = 4;
            cx2.strokeRect(10, 10, 492, 108);
            cx2.fillStyle = '#d9c79a';
            cx2.font = '600 52px "Microsoft YaHei", "PingFang SC", sans-serif';
            cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
            cx2.fillText(text, 256, 66);
            var tex = new THREE.CanvasTexture(cv);
            tex.needsUpdate = true;
            var badge = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.78, pw * 0.78 / 4),
              new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
            badge.position.set(0, ph * 0.52, pd / 2 + 0.006);
            pg.add(badge);
            return floor + ph;
          }
          var plinthTop = sculpturePlinth(at(-2.2, compareB)[0], at(-2.2, compareB)[1], '西方雕塑');
          p = at(-2.2, compareB);
          if (L.venus && instantiate(L.venus, { mode: 'h', size: 1.8, x: p[0], y: plinthTop, z: p[1], ry: faceRy })) mark('维纳斯');
          var plinthTop2 = sculpturePlinth(at(2.2, compareB)[0], at(2.2, compareB)[1], '中国人物雕塑');
          p = at(2.2, compareB);
          if (L.warrior && instantiate(L.warrior, { mode: 'h', size: 1.8, x: p[0], y: plinthTop2, z: p[1], ry: faceRy })) mark('将军俑');
          lampPair(1.2, dep / 2 - 1.9);
        } else if (tag === '临摹') {
          shelfRow(4, dep / 2 - 0.55);
          longTable(0.6, 2.2, false, true); longTable(-1.6, 2.2, false, true);
          stoolAt(-0.7, -0.25, faceRy + Math.PI); stoolAt(0.7, -0.25, faceRy + Math.PI - 0.4);
          stoolAt(-0.7, -2.45, faceRy + Math.PI); stoolAt(0.7, -2.45, faceRy + Math.PI - 0.4);
          pot2(-len / 2 + 0.8, dep / 2 - 0.85, seedBase + 3); pot2(len / 2 - 0.8, dep / 2 - 0.85, seedBase + 4);
        } else if (tag === '文创') {
          shelfRow(5, dep / 2 - 0.55);
          pedestalAt(-1.4, 0.3, seedBase + 1); pedestalAt(0, 0.3, seedBase + 2); pedestalAt(1.4, 0.3, seedBase + 3);
          pedestalAt(-1.4, -1.5, seedBase + 4); pedestalAt(0, -1.5, seedBase + 5); pedestalAt(1.4, -1.5, seedBase + 6);
          potAt(-len / 2 + 0.9, -dep / 2 + 1.0, seedBase + 7);
        } else if (tag === '茶室') {
          if (L.table) {
            p = at(0, 0);
            var tg2 = instantiate(L.table, { mode: 'max', size: 1.7, x: p[0], y: floor, z: p[1], ry: faceRy });
            if (tg2) { mark('长案'); teaSet(p[0], p[1], new THREE.Box3().setFromObject(tg2).max.y + 0.005, seedBase); }
          }
          stoolAt(-0.95, 0, faceRy + Math.PI / 2); stoolAt(0.95, 0, faceRy - Math.PI / 2);
          stoolAt(0, -0.85, faceRy); stoolAt(0, 0.85, faceRy + Math.PI);
          shelfRow(4, dep / 2 - 0.55);   /* 贴后墙整排架（后门已撤，不再断口让位） */
          potAt(-len / 2 + 0.9, -dep / 2 + 1.0, seedBase + 3);
          lampPair(1.5, 0);
        } else {
          /* 经典式（书斋与其余展厅） */
          shelfRow(99, dep / 2 - 0.55);
          if (isBook) {
            pot2(-len / 2 + 0.8, dep / 2 - 0.85, seedBase + 1); pot2(len / 2 - 0.8, dep / 2 - 0.85, seedBase + 2);
          } else {
            pedestalAt(-len / 2 + 0.8, dep / 2 - 0.85, seedBase + 1); pedestalAt(len / 2 - 0.8, dep / 2 - 0.85, seedBase + 2);
          }
          longTable(dep / 2 - 1.75, 2.4, true);
          stoolAt(-0.7, dep / 2 - 2.6, faceRy); stoolAt(0.7, dep / 2 - 2.6, faceRy + 0.4);
          if (tag === '书斋') {
            p = at(len / 2 - 0.9, 0);
            screenMesh(p[0], p[1], floor, Math.atan2(-ux, -uz));
            potAt(-len / 2 + 0.9, -dep / 2 + 1.0, seedBase + 5);
          }
        }
      }
      Promise.all([load('long-table'), load('bookshelf'), load('display-shelf'), load('stool'), load('lantern'), load('warrior'), load('horse'), load('venus')]).then(function (fs) {
        /* 合并冲突时团队把第 7 项从 venus 换成了 horse，导致 L 里没有 venus，
           人物厅的 L.venus 永远短路。这里两项都加载，venus 追加到第 8 位。 */
        var L = { table: fs[0], shelf: fs[1], display: fs[2], stool: fs[3], lamp: fs[4], warrior: fs[5], horse: fs[6], venus: fs[7] };
        slots.hall.forEach(function (h) { furnishHall(h, L); });
        report();
        resolveReady();
      });
    })();
  }
};
