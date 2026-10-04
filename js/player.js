/* ============================================================
 * player.js —— 第一人称漫游 + 碰撞检测
 * 归属：组员2（漫游交互工程师）
 * ------------------------------------------------------------
 * 职责：
 *   1. 维护玩家位置与朝向（yaw）
 *   2. 读取统一输入 input = { forward, back, turnLeft, turnRight, sprint }
 *      （main.js 将键盘/手势输入归一化后传入，本模块不关心来源）
 *   3. 基于 MuseumScene.obstacles 做圆形碰撞检测（圆/矩形统一处理）
 *   4. 判定玩家所在展厅并回调 onHallChange
 * ------------------------------------------------------------
 * 依赖：scene.js（MuseumScene.obstacles / getHallAt）、config.js
 * ============================================================ */

window.MuseumPlayer = (function () {

  var _g = THREE;

  var pos = new _g.Vector3(0, 0, 0);
  var yaw = 0;                  // 朝向角，0 表示面向 -Z
  var radius = 0.5;             // 碰撞半径
  var eyeHeight = 1.7;
  var speed = 2.4;
  var turnSpeed = 1.9;
  var currentHall = null;
  var onHallChange = null;

  var forwardDir = new _g.Vector3();
  var rightDir = new _g.Vector3();
  var wish = new _g.Vector3();
  var UP = new _g.Vector3(0, 1, 0);   // 自持 up 轴：r147 只有 Object3D.DefaultUp，没有 DEFAULT_UP

  /* ---------- 初始化 ---------- */
  function init(camera) {
    var cfg = window.MuseumConfig;
    if (cfg && cfg.player) {
      eyeHeight = cfg.player.eyeHeight;
      radius = cfg.player.radius;
      speed = cfg.player.speed;
      turnSpeed = cfg.player.turnSpeed;
      var sp = cfg.player.startPos;
      pos.set(sp[0], eyeHeight, sp[2]);
    }
    camera.position.copy(pos);
    applyRotation(camera);

    currentHall = MuseumScene.getHallAt(pos.x, pos.z);
    if (onHallChange) onHallChange(currentHall);
  }

  function applyRotation(camera) {
    camera.rotation.set(0, yaw, 0);
  }

  /* ---------- 每帧更新 ---------- */
  function update(delta, input, camera) {
    if (!camera) return;

    // 转向（键盘/手势统一输入）
    // 注意：Three.js 里 rotation.y 正向是镜头向左转（俯视逆时针），
    // 所以「左转取正、右转取负」，A/← 向左、D/→ 向右
    var turn = (input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0);
    yaw += turn * turnSpeed * delta;

    // 朝向向量（Three.js 相机默认看向 -Z）
    forwardDir.set(0, 0, -1).applyAxisAngle(UP, yaw);
    rightDir.set(1, 0, 0).applyAxisAngle(UP, yaw);

    wish.set(0, 0, 0);
    if (input.forward) wish.add(forwardDir);
    if (input.back) wish.sub(forwardDir);
    if (wish.lengthSq() > 0) wish.normalize();

    var spd = speed * (input.sprint ? 1.6 : 1);
    var step = wish.multiplyScalar(spd * delta);

    // 分轴移动 + 碰撞（先 x 后 z，滑动感更顺滑）
    pos.x += step.x;
    resolveCollisions();
    pos.z += step.z;
    resolveCollisions();

    // 应用相机
    camera.position.set(pos.x, eyeHeight, pos.z);
    applyRotation(camera);

    // 展厅判定
    var hall = MuseumScene.getHallAt(pos.x, pos.z);
    if (hall !== currentHall) {
      currentHall = hall;
      if (onHallChange) onHallChange(hall);
    }
  }

  /* ---------- 碰撞：圆 / 矩形统一为「点到形状最近点」检测 ---------- */
  function resolveCollisions() {
    var obs = MuseumScene.obstacles;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      var cx, cz;
      if (o.type === "circle") {
        cx = o.x; cz = o.z;
      } else {
        // 矩形：取玩家到矩形最近点
        cx = clamp(pos.x, o.x0, o.x1);
        cz = clamp(pos.z, o.z0, o.z1);
      }
      var dx = pos.x - cx;
      var dz = pos.z - cz;
      // 正对障碍中心时纯径向推出会变成「顶着不动」，给一点切向偏移以便擦身滑过
      if (Math.abs(dx) < 1e-3) dx = 1e-3;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var minDist = (o.type === "circle" ? o.r : 0) + radius;
      if (dist < minDist) {
        if (dist < 0.0001) {
          // 完全重叠时，沿最小轴推出（防止卡死）
          var pushX = Math.abs(pos.x - (o.type === "circle" ? o.x : (o.x0 + o.x1) / 2));
          var pushZ = Math.abs(pos.z - (o.type === "circle" ? o.z : (o.z0 + o.z1) / 2));
          if (pushX < pushZ) pos.x += (pos.x < (o.type === "circle" ? o.x : (o.x0 + o.x1) / 2) ? -1 : 1) * minDist;
          else pos.z += (pos.z < (o.type === "circle" ? o.z : (o.z0 + o.z1) / 2) ? -1 : 1) * minDist;
        } else {
          var nx = dx / dist, nz = dz / dist;
          pos.x = cx + nx * minDist;
          pos.z = cz + nz * minDist;
        }
      }
    }
  }

  function clamp(v, a, b) {
    return v < a ? a : (v > b ? b : v);
  }

  /* ---------- 对外 API ---------- */
  return {
    init: init,
    update: update,
    setOnHallChange: function (fn) { onHallChange = fn; },
    getPosition: function () { return pos; },
    getYaw: function () { return yaw; },
    reset: function () {
      var cfg = window.MuseumConfig;
      var sp = cfg ? cfg.player.startPos : [0, 0, 16];
      pos.set(sp[0], eyeHeight, sp[2]);
      yaw = 0; // 0 = 面向 -Z（建筑方向）
    },
    teleport: function (x, z, y) {
      pos.set(x, eyeHeight, z);
      yaw = y || 0;
    },
  };
})();
