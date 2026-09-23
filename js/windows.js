/* ============================================================
 * 格扇窗上墙（用我们自己的窗组件替换原型的扁平棂窗）
 * ------------------------------------------------------------
 * 原型 addWindow() 画的是 1.5m 见方的扁平棂窗；我们的 buildPartWindowWall()
 * 是落地格扇窗墙（多扇可开启 + 微风摆动，见 js/scene.js）。
 * 做法：vendor 脚本在 addWindow 开头插一行挂钩，命中下列"朝院立面"时
 *       改由这里建整面格扇窗，并**抑制**该面上的原型小窗（避免重叠）。
 * 目前只开 花鸟厅正房朝院立面 做样板，确认观感后再逐个加进来。
 * ============================================================ */
window.MuseumWindows = (function () {
  /* 每个立面：axis 决定墙走向，at 是固定坐标，from~to 是墙面范围，
     ry 是格扇窗面板的朝向（0=朝 +z，PI=朝 −z，±PI/2 朝 ∓x/+x） */
  var FACADES = [
    { id: "huaniao-hall-south", axis: "x", at: -28.1, from: -9.9, to: 9.9,
      y0: 0.62, y1: 3.3, ry: 0 }                       // 花鸟厅正房：面朝南（院内）
  ];
  var done = {};

  function make(parent, cxZ, len, f, scene) {
    /* 建到一个临时 Group 里，再整体摆到墙上——这样两种走向都能用同一套构件 */
    var g = new THREE.Group();
    if (f.axis === "x") {
      g.position.set(cxZ, 0, f.at);          // 墙沿 x 走：局部 z 轴 → 世界 x 轴
      g.rotation.y = Math.PI / 2;
    } else {
      g.position.set(f.at, 0, cxZ);          // 墙沿 z 走：局部 z 轴 → 世界 z 轴
    }
    scene.add(g);
    /* 借 scene.js 的实现：它把 x 固定、沿 z 铺开 */
    window.MuseumScene.buildWindowWallInto(g, 0, f.y0, f.y1, -len / 2, len / 2, f.ry);
    return g;
  }

  /* 挂钩：命中就返回 true（告诉原型"这个窗我接管了"） */
  function replace(x, y, z, ry, scene) {
    for (var i = 0; i < FACADES.length; i++) {
      var f = FACADES[i];
      var along = f.axis === "x" ? x : z;
      var fixed = f.axis === "x" ? z : x;
      if (Math.abs(fixed - f.at) > 0.9) continue;              // 不在这个面上
      if (along < f.from - 0.6 || along > f.to + 0.6) continue; // 超出墙长
      if (!done[f.id]) {
        done[f.id] = true;
        make(scene, (f.from + f.to) / 2, f.to - f.from, f, scene);
        console.log("[格扇窗] 已替换 " + f.id + "（" + (f.to - f.from).toFixed(1) + "m）");
      }
      return true;   // 无论第几次调用，都抑制原型的扁平小窗
    }
    return false;
  }

  return { replace: replace, facades: FACADES };
})();