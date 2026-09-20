/* ============================================================
 * exhibit.js —— 展品热点 · 拾取 · 鉴赏弹窗联动
 * 归属：组员4（展品系统工程师）
 * ------------------------------------------------------------
 * 职责：
 *   1. 登记 MuseumScene.spotMeshes 为可交互热点（含展品详情）
 *   2. 每帧检测玩家所在范围，高亮最近展品并提示「可查看」
 *   3. pick() 触发拾取：捏合手势 / E 键 / 鼠标点击 → 打开鉴赏弹窗
 * ------------------------------------------------------------
 * 依赖：config.js（展品数据）、scene.js（热点坐标）、
 *       ui.js（MuseumUI.showExhibit 渲染弹窗）
 * ============================================================ */

window.MuseumExhibit = (function () {

  var spots = [];            // [{ exhibitId, x, y, z, radius }]
  var currentId = null;      // 当前可查看的展品 id
  var onFocusChange = null;  // 焦点变化回调（ui.js 提示条用）

  /* ---------- 初始化 ---------- */
  function init() {
    spots = (MuseumScene.spotMeshes || []).slice();
    return true;
  }

  /* ---------- 每帧更新：找最近可查看展品 ---------- */
  function update() {
    var p = MuseumPlayer.getPosition();
    var bestId = null;
    var bestDist = Infinity;

    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var dx = p.x - s.x, dz = p.z - s.z;
      // 只拾取水平距离（画与展台都在视线高度附近）
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < s.radius && d < bestDist) {
        bestDist = d;
        bestId = s.exhibitId;
      }
    }

    if (bestId !== currentId) {
      currentId = bestId;
      if (onFocusChange) onFocusChange(bestId);
    }
    return bestId;
  }

  /* ---------- 拾取：打开当前展品详情 ---------- */
  function pick() {
    if (!currentId) return false;
    var ex = findExhibit(currentId);
    if (!ex) return false;
    MuseumUI.showExhibit(ex);
    return true;
  }

  function findExhibit(id) {
    var list = window.MuseumConfig.exhibits;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /* ---------- 对外 API ---------- */
  return {
    init: init,
    update: update,
    pick: pick,
    getCurrentId: function () { return currentId; },
    setOnFocusChange: function (fn) { onFocusChange = fn; },
    getSpotByExhibit: function (id) {
      for (var i = 0; i < spots.length; i++) {
        if (spots[i].exhibitId === id) return spots[i];
      }
      return null;
    },
  };
})();
