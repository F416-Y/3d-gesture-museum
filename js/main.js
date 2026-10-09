/* ============================================================
 * main.js —— 启动入口 + 主循环（项目整合者）
 * 归属：组员7（组长 / 整合工程师）
 * ------------------------------------------------------------
 * 职责：
 *   1. 创建渲染器 / 场景 / 相机
 *   2. 依次初始化：场景 → 玩家 → 展品 → UI → 手势
 *   3. 合成统一输入（键盘 + 手势），驱动玩家漫游
 *   4. 主循环渲染 + 展厅切换 + 展品拾取
 *   5. 摄像头开关、重置视角、窗口自适应
 * ------------------------------------------------------------
 * 依赖：config / scene / player / gesture / exhibit / ui
 * ============================================================ */

window.MuseumMain = (function () {

  var renderer, scene, camera;
  var clock = new THREE.Clock();
  var cameraOn = false;
  var hallDoorPrompt = { door: null, dismissed: null };

  /* ---------- 全景俯瞰模式 ----------
   * player.js 每帧把相机锁在 1.6m 人眼高度、俯仰角为 0，所以只能第一人称。
   * 全景不开新相机：把相机摆在园区上方的环形轨道上，每帧在 player 之后覆写姿态，
   * 退出时交给下一帧 player.update 自然恢复。 */
  var panorama = { on: false, angle: Math.PI * 0.85, dist: 78, height: 44,
                   target: new THREE.Vector3(0, 2, 6) };
  var NEUTRAL_INPUT = { forward: false, back: false, turnLeft: false, turnRight: false, sprint: false };

  var keys = {};
  var lastPinchPick = 0;   // 上次捏合拾取的时间戳（冷却防抖）

  /* ---------- 初始化 ---------- */
  function init() {
    // 必须先初始化 UI：getStage() / getVideo() 依赖 init() 里缓存的 DOM 引用
    MuseumUI.init();

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    // 色调映射：把超过 1.0 的高光压回来，避免地面/墙面一片死白（此前中轴道路会被曝成浅灰）
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 曝光：走外观原型布局时按原型的 1.12，其余保持 1.0
  renderer.toneMappingExposure = (window.MuseumExteriorLayout && window.MuseumExteriorLayout.build) ? 1.12 : 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    MuseumUI.getStage().appendChild(renderer.domElement);

    // 颜色管理：r147 默认 legacy 模式会把十六进制颜色当线性值，再经 sRGB 输出被整体提亮
    //（道路材质 rgb(87,81,74) 会被渲染成 rgb(200,195,185)，草坪绿也会褪成灰绿）。
    // 关闭 legacy 模式后，代码里写的色板 hex 才会按 sRGB 正确解释。
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

    // 场景与相机
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 1.7, 16);

    // 初始化各模块
    MuseumScene.init({ scene: scene, camera: camera });
    if (window.MuseumAvatar) MuseumAvatar.init(scene);
    /* 昼夜氛围：接原型的 applyNight（js/lighting.js），场景建好后初始化 */
    if (window.MuseumLighting) window.MuseumLighting.init(renderer, scene, window.MuseumExteriorLayout);
    MuseumPlayer.init(camera);
    if (window.MuseumInteriorOnly) {
      var interiorSpawns = {
        hall0: [0, 29, 0], hall1: [-25, -13, Math.PI / 2],
        hall2: [0, -16, 0], hall3: [25, -13, 0],
        hall4: [24, 13, -Math.PI / 2], hall5: [-24, 13, Math.PI / 2]
      };
      var interiorSpawn = interiorSpawns[window.MuseumInteriorHall] || interiorSpawns.hall4;
      MuseumPlayer.teleport(interiorSpawn[0], interiorSpawn[1], interiorSpawn[2]);
    }
    MuseumExhibit.init();

    // 回调接线
    MuseumPlayer.setOnHallChange(function (hallId) {
      MuseumUI.setHall(hallId);
    });
    if (window.MuseumInteriorOnly) MuseumUI.setHall(window.MuseumInteriorHall || "hall4");
    MuseumExhibit.setOnFocusChange(function (exhibitId) {
      if (exhibitId) {
         MuseumUI.toast("靠近展品 · 捏合两指（三指张开）或按 E 查看");
      }
    });

    // 事件
    bindEvents();
    resize();

    // 完成加载，显示主界面
    setTimeout(function () {
      MuseumUI.hideLoading();
      MuseumUI.toast("欢迎来到云墨美术馆 · 伸出手掌开始漫游");
    }, 400);

    // 自动尝试开启手势（失败自动降级为键盘）
    toggleCamera(true);

    // 启动主循环
    animate();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    window.addEventListener("keydown", function (e) {
      keys[e.code] = true;
      if (e.code === "KeyE") { e.preventDefault(); MuseumExhibit.pick(); }
      // Q / Esc：关闭展品弹窗（看完信息后退出）
      if ((e.code === "KeyQ" || e.code === "Escape") && MuseumUI.isPanelOpen()) {
        e.preventDefault(); MuseumUI.hidePanel();
      }
      if (e.code === "KeyR") { resetView(); }
      if (e.code === "KeyV") { e.preventDefault(); setPanorama(!panorama.on); }
      if (e.code === "KeyT") {
        e.preventDefault();
        if (window.MuseumAvatar) {
          var third = MuseumAvatar.setEnabled(!MuseumAvatar.isEnabled());
          MuseumUI.toast(third ? "已切换第三人称 · T 返回第一人称" : "已返回第一人称漫游");
        }
      }
      if (e.code === "KeyN") { e.preventDefault(); if (window.MuseumLighting) window.MuseumLighting.toggle(); }
      if (e.code === "KeyE" && panorama.on) { e.preventDefault(); return; }
    });
    window.addEventListener("keyup", function (e) { keys[e.code] = false; });
    var btnNight = document.getElementById("btn-night");
    if (btnNight && window.MuseumLighting) btnNight.addEventListener("click", function () { window.MuseumLighting.toggle(); });

     // 鼠标：点画面 = 进入鼠标视角（锁定指针）；准星正对展品时，点一下 = 直接查看展品
    renderer.domElement.addEventListener("click", function () {
      if (panorama.on) return;                      // 全景模式下与键盘/E 键一致，不做拾取
      if (document.pointerLockElement === renderer.domElement) {
        MuseumExhibit.pick();
        return;
      }
      if (MuseumExhibit.getCurrentId && MuseumExhibit.getCurrentId()) {
        MuseumExhibit.pick();                       // 准星对着展品：保留「点一下就看」的老习惯
        return;
      }
      if (renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
    });

    // 鼠标移动 → 转动视角（仅在指针锁定时生效）
    document.addEventListener("mousemove", function (e) {
      if (document.pointerLockElement === renderer.domElement) {
        MuseumPlayer.look(e.movementX || 0, e.movementY || 0);
      }
    });

    MuseumUI.setHandlers({
      onCameraToggle: function () { toggleCamera(!cameraOn); },
      onReset: function () { resetView(); },
      onClosePanel: function () {
        /* 关闭确认窗等同于取消：离开门口后才允许再次触发。 */
        if (hallDoorPrompt.door) hallDoorPrompt.dismissed = hallDoorPrompt.door;
        hallDoorPrompt.door = null;
      },
    });
  }

  /* ---------- 展厅闭门提示 ---------- */
  function updateHallDoorPrompt() {
    if (panorama.on || MuseumUI.isPanelOpen()) return;
    var doors = MuseumScene.hallDoors || [];
    var p = MuseumPlayer.getPosition();
    var nearest = null, best = 2.8;
    for (var i = 0; i < doors.length; i++) {
      var d = doors[i];
      if (!d.hallId) continue;
      var dx = p.x - d.x, dz = p.z - d.z;
      /* 只在门外触发；厅内通过路由进入，不重复弹窗。 */
      if (dx * d.nx + dz * d.nz <= 0) continue;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < best) { best = dist; nearest = d; }
    }
    if (!nearest) {
      if (hallDoorPrompt.dismissed) {
        var dd = hallDoorPrompt.dismissed;
        var dxd = p.x - dd.x, dzd = p.z - dd.z;
        if (Math.sqrt(dxd * dxd + dzd * dzd) > 3.8) hallDoorPrompt.dismissed = null;
      }
      return;
    }
    if (hallDoorPrompt.dismissed === nearest) return;
    if (hallDoorPrompt.door === nearest) return;
    hallDoorPrompt.door = nearest;
    MuseumUI.showHallPrompt(nearest.tag, function () {
      hallDoorPrompt.door = null;
      hallDoorPrompt.dismissed = null;
      location.href = "./interior.html#/hall/" + nearest.hallId;
    }, function () {
      hallDoorPrompt.door = null;
      hallDoorPrompt.dismissed = nearest;
    });
  }

  function resize() {
    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ---------- 摄像头开关 ---------- */
  function toggleCamera(on) {
    if (on && !cameraOn) {
      MuseumGesture.init(MuseumUI.getVideo()).then(function () {
        cameraOn = true;
        MuseumUI.setCameraButton(true);
        MuseumUI.showCam(true);
      }).catch(function (err) {
        cameraOn = false;
        MuseumUI.setCameraButton(false);
        MuseumUI.showCam(false);
        console.warn("[云墨美术馆] 手势启动失败：", err && err.message ? err.message : err);
      }).then(function () {
        setTimeout(function () { MuseumUI.hideLoading(); }, 500);
      });
    } else if (!on && cameraOn) {
      MuseumGesture.stop();
      cameraOn = false;
      MuseumUI.setCameraButton(false);
      MuseumUI.showCam(false);
      MuseumUI.toast("已关闭手势控制，可使用键盘");
    }
  }

  /* 全景轨道：A/D 或左右方向键绕行，W/S 或上下键推近拉远，Shift 加速 */
  function updatePanorama(dt, input) {
    var fast = input.sprint ? 3 : 1;
    if (input.turnLeft) panorama.angle -= dt * 0.45 * fast;
    if (input.turnRight) panorama.angle += dt * 0.45 * fast;
    if (!input.turnLeft && !input.turnRight) panorama.angle += dt * 0.04;
    if (input.forward) panorama.dist = Math.max(34, panorama.dist - dt * 20 * fast);
    if (input.back) panorama.dist = Math.min(130, panorama.dist + dt * 20 * fast);
    camera.position.set(Math.sin(panorama.angle) * panorama.dist, panorama.height,
                        Math.cos(panorama.angle) * panorama.dist);
    camera.lookAt(panorama.target);
  }

  function setPanorama(on) {
    if (on === panorama.on) return;
    panorama.on = on;
    if (on) {
      panorama.angle = Math.PI * 0.85;
      panorama.dist = 78;
      panorama.height = 44;
      camera.fov = 55;
      camera.updateProjectionMatrix();
      MuseumUI.toast("全景俯瞰 · A/D 绕行 · W/S 远近 · V 返回漫游");
    } else {
      camera.fov = 60;
      camera.updateProjectionMatrix();
      camera.position.copy(MuseumPlayer.getPosition());
      MuseumUI.toast("已返回第一人称漫游");
    }
  }

  function resetView() {
    if (panorama.on) {
      panorama.angle = Math.PI * 0.85;
      panorama.dist = 78;
      return;
    }
    MuseumPlayer.reset();
    // 重置后相机姿态由下一帧 update 应用
    var p = MuseumPlayer.getPosition();
    camera.position.copy(p);
    MuseumUI.toast("已重置视角");
  }

  /* ---------- 统一输入合成 ---------- */
  function composeInput(gs) {
    return {
      forward: !!keys["KeyW"] || !!keys["ArrowUp"] || gs.forward,
      back: !!keys["KeyS"] || !!keys["ArrowDown"] || gs.back,
      // 手势约定：指向左时 gs.turn>0（与镜像预览直觉一致），故映射到 turnLeft
      turnLeft: !!keys["KeyA"] || !!keys["ArrowLeft"] || (gs.turn > 0.05),
      turnRight: !!keys["KeyD"] || !!keys["ArrowRight"] || (gs.turn < -0.05),
      sprint: !!keys["ShiftLeft"] || !!keys["ShiftRight"],
    };
  }

  /* ---------- 主循环 ---------- */
  /* 帧率自检：每 2 秒往控制台报一次（排查"移动很慢"时看这个数字）
     真机上低于 30fps 说明是渲染卡，不是移动速度参数的问题。 */
  var fpsFrames = 0, fpsStamp = (typeof performance !== "undefined" ? performance.now() : Date.now());

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);

    fpsFrames++;
    var nowMs = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (nowMs - fpsStamp >= 2000) {
      console.info("[帧率] " + Math.round(fpsFrames * 1000 / (nowMs - fpsStamp)) + " fps");
      fpsFrames = 0; fpsStamp = nowMs;
    }

    var gs = MuseumGesture.getState();
    var input = composeInput(gs);

    // 捏合：弹窗打开时关闭弹窗，否则拾取当前展品（等价于按 E）。
    // 边沿触发 + 600ms 冷却防连开连关；全景模式下不拾取（与点击一致），但仍可关弹窗
    if (gs.pinchPressed && nowMs - lastPinchPick > 600) {
      lastPinchPick = nowMs;
      if (MuseumUI.isPanelOpen()) {
        MuseumUI.hidePanel();
      } else if (!panorama.on) {
        MuseumExhibit.pick();
      }
    }

    if (panorama.on) {
      // 冻结漫游位移（人站在原地看着，退出后回到原处），再覆写相机姿态
      MuseumPlayer.update(dt, NEUTRAL_INPUT, camera);
      updatePanorama(dt, input);
    } else {
      MuseumPlayer.update(dt, input, camera);
      if (window.MuseumAvatar) MuseumAvatar.update(camera, dt);
    }
    updateHallDoorPrompt();
    MuseumExhibit.update();
    MuseumScene.update();
    if (window.MuseumLighting) window.MuseumLighting.update(dt);   /* 昼夜平滑过渡 */

    renderer.render(scene, camera);
  }

  return {
    init: init,
    setPanorama: setPanorama,
    togglePanorama: function () { setPanorama(!panorama.on); },
    isPanorama: function () { return panorama.on; },
  };
})();

/* 页面加载完成后启动 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { window.MuseumMain.init(); });
} else {
  window.MuseumMain.init();
}
