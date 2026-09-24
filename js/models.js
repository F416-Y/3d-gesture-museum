/* ============================================================
 * GLB 零件资产（Aholo Lux3D 生成）
 * ------------------------------------------------------------
 * 设计原则：场景里先建参数化占位，模型加载到位后自动替换；
 * 加载失败（离线 / 文件缺失 / CDN 拿不到 GLTFLoader）就保留占位，
 * 场景永远是完整的，不会出现空洞。
 *
 * 资产约定：assets/models/parts/opt/<id>.glb（已压缩），
 *          尺寸取自 parts-manifest.json 的 sizeM（模型本身归一化为 1m 包围盒）。
 * ============================================================ */
window.MuseumModels = (function () {
  var BASE = "assets/models/parts/opt/";
  var RAW = "assets/models/parts/";
  var MANIFEST = "assets/models/parts/parts-manifest.json";

  /* 拿不到清单时的兜底尺寸（真实最大边长，米） */
  var FALLBACK = {
    willow: 4.5, camphor: 5.0, bamboo: 2.6, bush: 0.8, "grass-clump": 0.35,
    "taihu-rock": 1.8, lantern: 0.6, horse: 1.6, "stone-lion": 1.2, "bronze-ding": 1.1,
    "door-column": 5.0, "door-leaf": 3.0, "door-canopy": 8.0, "roof-tile": 12.0,
    "wall-pillar": 2.6, "back-wall": 14.0,
    "rock-boulder": 1.8, "grass-patch": 3.0, "dead-trunk": 3.0, "fir-tree": 7.0
  };

  var sizes = {}, templates = {}, pending = {}, failed = {};
  var loader = null, requested = 0, ready = 0, placed = 0;

  function getLoader() {
    if (loader) return loader;
    if (typeof THREE === "undefined" || !THREE.GLTFLoader) return null;
    loader = new THREE.GLTFLoader();
    return loader;
  }

  /* 清单：拿真实尺寸（异步，拿不到就用 FALLBACK） */
  if (typeof fetch === "function") {
    fetch(MANIFEST).then(function (r) { return r.json(); }).then(function (m) {
      (m.parts || []).forEach(function (p) { if (p && p.id) sizes[p.id] = p.sizeM || 1; });
    }).catch(function () { /* 离线时静默 */ });
  }

  function targetSize(id) { return sizes[id] || FALLBACK[id] || 1; }

  /* 归一化：缩放到清单里的真实最大尺寸，底面贴 y=0，水平居中 */
  function normalize(group, id) {
    var box = new THREE.Box3().setFromObject(group);
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    group.scale.multiplyScalar(targetSize(id) / maxDim);
    box.setFromObject(group);
    var c = box.getCenter(new THREE.Vector3());
    group.position.set(-c.x, -box.min.y, -c.z);
    return group;
  }

  function flush(id, tpl) {
    var wait = pending[id] || [];
    delete pending[id];
    wait.forEach(function (fn) { fn(tpl); });
  }

  /* 先找压缩版 opt/<id>.glb，没有就用原始 assets/models/parts/<id>.glb */
  function tryLoad(id, srcIdx, cb) {
    var srcs = [BASE + id + ".glb", RAW + id + ".glb"];
    if (srcIdx >= srcs.length) { failed[id] = true; flush(id, null); return; }
    getLoader().load(srcs[srcIdx], function (gltf) {
      var t = normalize(gltf.scene, id);
      t.traverse(function (o) {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      templates[id] = t;
      ready++;
      flush(id, t);
    }, undefined, function () {
      tryLoad(id, srcIdx + 1, cb);
    });
  }

  /* 开发开关：URL 带 ?noGLB=1 时不加载任何 GLB，用来和纯程序化版本做 A/B 对比 */
  var DISABLED = typeof location !== "undefined" && /(^|[?&])noGLB=1/.test(location.search);

  function load(id, cb) {
    if (DISABLED) { cb(null); return; }
    if (templates[id]) { cb(templates[id]); return; }
    if (failed[id]) { cb(null); return; }
    if (pending[id]) { pending[id].push(cb); return; }
    if (!getLoader()) { failed[id] = true; cb(null); return; }
    pending[id] = [cb];
    requested++;
    tryLoad(id, 0, cb);
  }

  /* 造一个实例（模板 clone，可独立摆位/旋转/缩放） */
  function spawn(id, opt) {
    var t = templates[id];
    if (!t) return null;
    opt = opt || {};
    var g = new THREE.Group();
    g.add(t.clone(true));
    g.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
    g.rotation.y = opt.ry || 0;
    if (opt.scale && opt.scale !== 1) g.scale.multiplyScalar(opt.scale);
    g.name = "model:" + id;
    return g;
  }

  /* 占位替换：模型到了就删占位换真模型；没到就什么都不做 */
  function attach(parent, id, opt, placeholder) {
    load(id, function () {
      if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
      var inst = spawn(id, opt);
      if (inst) { parent.add(inst); placed++; }
    });
  }

  /* 批量撒点（草丛、灌木）：确定性抖动，避免每次刷新位置都变 */
  function scatter(parent, id, area, count, opt) {
    opt = opt || {};
    var seed = opt.seed || 7;
    var rand = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    load(id, function (tpl) {
      if (!tpl) return;
      for (var i = 0; i < count; i++) {
        var x = area.x0 + rand() * (area.x1 - area.x0);
        var z = area.z0 + rand() * (area.z1 - area.z0);
        var s = (opt.scaleMin || 0.75) + rand() * ((opt.scaleMax || 1.25) - (opt.scaleMin || 0.75));
        var inst = spawn(id, { x: x, z: z, y: 0, ry: rand() * 6.28, scale: s });
        if (inst) parent.add(inst);
      }
    });
  }

  return {
    load: load,
    spawn: spawn,
    attach: attach,
    scatter: scatter,
    isReady: function (id) { return !!templates[id]; },
    stats: function () { return { requested: requested, ready: ready, placed: placed, failed: Object.keys(failed) }; }
  };
})();