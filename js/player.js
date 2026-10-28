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
 * 依赖：scene.js（MuseumScene.obstacles / getHallAt / terrainHeightAt）、config.js
 * ============================================================ */

window.MuseumPlayer = (function () {

  var _g = THREE;

  var pos = new _g.Vector3(0, 0, 0);
  var yaw = 0;                  // 朝向角，0 表示面向 -Z
  var radius = 0.5;             // 碰撞半径
  var eyeHeight = 1.7;
  var eyeY = 1.7;               // 当前视点高度（= 地面标高 + eyeHeight），高度跟随用
  var speed = 2.4;
  var turnSpeed = 1.9;
  var turnVel = 0;              // 平滑后的转向速度（弧度/秒），用于消除卡顿
  var pitch = 0;                // 俯仰角：0 = 平视，正 = 抬头，负 = 低头
  var mouseSensitivity = 0.002; // 鼠标灵敏度（弧度/像素），越大转得越快
  var maxPitch = 1.3;           // 上下看的角度上限（约 75°），防止翻过头
  var currentHall = null;
  var onHallChange = null;
  var forwardDir = new _g.Vector3();
  var rightDir = new _g.Vector3();
  var wish = new _g.Vector3();
  var UP = new _g.Vector3(0, 1, 0);   // 自持 up 轴：r147 只有 Object3D.DefaultUp，没有 DEFAULT_UP

  // 查询某点地面标高（scene.js 提供，序厅台基/踏跺高度；没有则按平地 0 处理）
  function terrainAt(x, z) {
    var f = window.MuseumScene && window.MuseumScene.terrainHeightAt;
    if (!f) return 0;
    // 脚底周围采样几个点、取最高：避免中心点恰好落在地形数据的小缝隙（如
    // 前庭大门台基与台阶之间的 0.2m 空当）时，视点被瞬间拉到低处
    var r = radius * 0.6;   // 0.3m，覆盖 0.2m 的缝隙
    var h = f(x, z);
    if (f(x - r, z) > h) h = f(x - r, z);
    if (f(x + r, z) > h) h = f(x + r, z);
    if (f(x, z - r) > h) h = f(x, z - r);
    if (f(x, z + r) > h) h = f(x, z + r);
    return h;
  }

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
    eyeY = terrainAt(pos.x, pos.z) + eyeHeight;
    pos.y = eyeY;
    camera.position.copy(pos);
    applyRotation(camera);

    currentHall = MuseumScene.getHallAt(pos.x, pos.z);
    if (onHallChange) onHallChange(currentHall);
  }

  function applyRotation(camera) {
    camera.rotation.order = "YXZ";        // FPS 标准顺序：先偏航(Y) 再俯仰(X)
    camera.rotation.set(pitch, yaw, 0);
  }

  /* ---------- 每帧更新 ---------- */
  function update(delta, input, camera) {
    if (!camera) return;

    // 转向（键盘/手势统一输入）
    // 方向约定与鼠标一致：右转 yaw 减小、左转 yaw 增大（turnRight=+1 / turnLeft=-1）
    var turn = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
    // 平滑过渡到目标角速度：turnVel 逐渐逼近 turn*turnSpeed，起步/松手都顺滑
    turnVel += (turn * turnSpeed - turnVel) * Math.min(1, delta * 12);
    yaw -= turnVel * delta;

    // 朝向向量（Three.js 相机默认看向 -Z）
    forwardDir.set(0, 0, -1).applyAxisAngle(UP, yaw);
    rightDir.set(1, 0, 0).applyAxisAngle(UP, yaw);

    wish.set(0, 0, 0);
    if (input.forward) wish.add(forwardDir);
    if (input.back) wish.sub(forwardDir);
    if (wish.lengthSq() > 0) wish.normalize();

    var spd = speed * (input.sprint ? 1.6 : 1);
    var step = wish.multiplyScalar(spd * delta);

    // 分轴移动 + 碰撞（先 x 后 z，滑动感更顺滑）；子步进防高速穿墙
    moveWithCollision(step.x, step.z);

    // 高度跟随：逐级离散——每帧直接锁到「当前地面标高 + 眼高」。
    // 不再平滑插值：南入口六级台阶每级 0.2m，走到台阶分界处“顿一下上一级”，
    // 有登台阶感；否则会被 lerp 磨成缓坡、感觉不到在爬台阶
    var ground = terrainAt(pos.x, pos.z);
    eyeY = ground + eyeHeight;
    pos.y = eyeY;

    // 应用相机
    camera.position.set(pos.x, eyeY, pos.z);
    applyRotation(camera);

    // 展厅判定
    var hall = MuseumScene.getHallAt(pos.x, pos.z);
    if (hall !== currentHall) {
      currentHall = hall;
      if (onHallChange) onHallChange(hall);
    }
  }

  /* ---------- 碰撞：圆 / 矩形统一为「点到形状最近点」检测 ---------- */
  // 单段位移上限：小于「最薄墙厚(0.4) + 半径(0.5)」的捕捉距离，保证一步跨不过薄墙
  var MAX_SUBSTEP = 0.45;

  // 把单帧位移切成若干小段，逐段移动 + 碰撞，杜绝高速/掉帧时一步穿墙
  function moveWithCollision(dx, dz) {
    var n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / MAX_SUBSTEP);
    if (n < 1) n = 1;
    var sx = dx / n, sz = dz / n;
    for (var k = 0; k < n; k++) {
      pos.x += sx;
      resolveCollisions();
      pos.z += sz;
      resolveCollisions();
    }
  }

  function resolveCollisions() {
    var obs = MuseumScene.obstacles;
    if (!obs) return;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      var cx, cz, minDist;
      if (o.type === "circle") {
        cx = o.x; cz = o.z;
        minDist = o.r + radius;
      } else {
        // 矩形：取玩家到矩形最近点
        cx = clamp(pos.x, o.x0, o.x1);
        cz = clamp(pos.z, o.z0, o.z1);
        minDist = radius;
      }
      var dx = pos.x - cx;
      var dz = pos.z - cz;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= minDist) continue;   // 没碰到，跳过

      var nx, nz;
      if (dist < 0.0001) {
        // 与障碍最近点完全重合：沿较小穿透方向推出，避免除零出现 NaN
        if (Math.abs(dx) < Math.abs(dz)) { nx = 0; nz = (dz >= 0 ? 1 : -1); }
        else { nx = (dx >= 0 ? 1 : -1); nz = 0; }
      } else {
        nx = dx / dist; nz = dz / dist;
      }
      pos.x = cx + nx * minDist;
      pos.z = cz + nz * minDist;
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
    look: function (dx, dy) {
      yaw -= dx * mouseSensitivity;         // 鼠标右移(dx>0) → 右转
      pitch -= dy * mouseSensitivity;       // 鼠标上移(dy<0) → 抬头
      if (pitch > maxPitch) pitch = maxPitch;   // 抬头限位
      if (pitch < -maxPitch) pitch = -maxPitch; // 低头限位
    },
    reset: function () {
      var cfg = window.MuseumConfig;
      var sp = cfg ? cfg.player.startPos : [0, 0, 16];
      eyeY = terrainAt(sp[0], sp[2]) + eyeHeight;
      pos.set(sp[0], eyeY, sp[2]);
      yaw = 0;     // 0 = 面向 -Z（建筑方向）
      pitch = 0;   // 平视
    },
    teleport: function (x, z, y) {
      eyeY = terrainAt(x, z) + eyeHeight;
      pos.set(x, eyeY, z);
      yaw = y || 0;
      pitch = 0;   // 传送后平视
    },
    setSeated: function (active) {
      eyeHeight = active ? 1.12 : 1.7;
      eyeY = terrainAt(pos.x, pos.z) + eyeHeight;
      pos.y = eyeY;
    },
  };
})();
