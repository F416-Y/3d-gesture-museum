/* ============================================================
 * avatar.js —— 可选第三人称人物
 * eggman.glb 仅作为玩家外观，不参与建筑碰撞。
 * ============================================================ */
window.MuseumAvatar = (function () {
  var scene = null;
  var holder = null;
  var model = null;
  var enabled = false;
  var limbs = [];
  var lastX = 0, lastZ = 0, phase = 0;

  // 第三人称相机参数（与 player.js 的碰撞/高度口径一致，单位：米）
  var CAM = {
    distance: 3.4,     // 相机离玩家的水平距离
    height: 2.25,      // 相机离脚底的高度
    lookHeight: 1.05,  // 视线目标高度（玩家胸口，避免低头看脚）
    radius: 0.3,       // 相机穿墙检测留边半径
    minDistance: 0.6,  // 被墙挡住时相机能缩到的最小水平距离
    step: 0.2,         // 遮挡探测步长（越小越精确，越慢）
    smooth: 10,        // 平滑系数（越大越跟手）
  };
  var camPos = new THREE.Vector3();  // 平滑后的相机位置（跨帧保持）
  var camInited = false;             // 是否已从第一人称眼位初始化平滑起点

  function init(root) {
    scene = root;
    holder = new THREE.Group();
    holder.name = "third-person-avatar";
    holder.visible = false;
    scene.add(holder);
    if (!THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load("assets/models/eggman.glb", function (gltf) {
      model = gltf.scene;
      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var scale = 1.72 / Math.max(size.y || 1, 0.001);
      model.scale.setScalar(scale);
      box.setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      model.traverse(function (o) {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      ["L3_Leg_L", "L3_Leg_R", "L3_Shoe_L", "L3_Shoe_R"].forEach(function (name) {
        var part = model.getObjectByName(name);
        if (part) limbs.push({ node: part, base: part.rotation.x });
      });
      holder.add(model);
      holder.visible = enabled;
    }, undefined, function (err) {
      console.warn("[云间入墨] eggman.glb 加载失败：", err);
    });
  }

  /* ---------- 相机穿墙检测：复用 MuseumScene.obstacles 的圆/矩形口径 ---------- */
  // 2D 点是否落入障碍物（相机半径留边），与 player.js 的碰撞判断同源
  function pointInObstacle(x, z, r) {
    var obs = window.MuseumScene && window.MuseumScene.obstacles;
    if (!obs) return false;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (o.type === "circle") {
        if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true;
      } else {
        if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return true;
      }
    }
    return false;
  }

  // 从玩家身后沿相机方向逐步外探，返回第一个被墙挡住前可用的水平距离。
  // 玩家贴墙站时，相机会自动缩到墙前，而不是穿进墙里。
  function cameraDistance(p, yaw) {
    var dirX = Math.sin(yaw), dirZ = Math.cos(yaw);   // 与 update 里的相机偏移同方向（身后）
    for (var d = CAM.minDistance; d <= CAM.distance + 1e-6; d += CAM.step) {
      if (pointInObstacle(p.x + dirX * d, p.z + dirZ * d, CAM.radius)) {
        // 当前格被挡：回退到上一格（已确认干净），并留出相机半径边距
        return Math.max(CAM.minDistance - CAM.step, d - CAM.step);
      }
    }
    return CAM.distance;
  }

  function setEnabled(on) {
    enabled = !!on;
    if (holder) holder.visible = enabled && !!model;
    camInited = false;   // 重新进入第三人称时，从当前第一人称眼位平滑拉出，不瞬移
    return enabled;
  }

  function update(camera, dt) {
    if (!enabled || !holder || !model || !window.MuseumPlayer) return;
    var p = MuseumPlayer.getPosition();
    var yaw = MuseumPlayer.getYaw();
    var eye = (window.MuseumConfig && MuseumConfig.player && MuseumConfig.player.eyeHeight) || 1.7;
    var groundY = p.y - eye;
    holder.position.set(p.x, groundY, p.z);
    // eggman.glb 的正面朝 +Z，而项目玩家的前进方向是 -Z，补半圈后人物才会面向行进方向。
    holder.rotation.y = yaw + Math.PI;
    var dx = p.x - lastX, dz = p.z - lastZ;
    var moving = (dx * dx + dz * dz) > 0.000001;
    if (moving) phase += (dt || 0.016) * 10;
    limbs.forEach(function (item, i) {
      var swing = moving ? Math.sin(phase + (i % 2) * Math.PI) * 0.28 : 0;
      item.node.rotation.x = item.base + swing;
    });
    lastX = p.x; lastZ = p.z;
    if (camera) {
      // 第三人称相机：玩家身后上方 + 穿墙回退 + 平滑追踪（不瞬移、不抖动）
      var dist = cameraDistance(p, yaw);
      var desX = p.x + Math.sin(yaw) * dist;
      var desZ = p.z + Math.cos(yaw) * dist;
      var desY = groundY + CAM.height;
      if (!camInited) {
        camPos.copy(camera.position);   // 起点取当前（第一人称）眼位，随后平滑拉出
        camInited = true;
      }
      var k = 1 - Math.exp(-CAM.smooth * (dt || 0.016));
      camPos.x += (desX - camPos.x) * k;
      camPos.y += (desY - camPos.y) * k;
      camPos.z += (desZ - camPos.z) * k;
      camera.position.copy(camPos);
      camera.lookAt(p.x, groundY + CAM.lookHeight, p.z);
    }
  }

  return { init: init, setEnabled: setEnabled, isEnabled: function () { return enabled; }, update: update };
})();
