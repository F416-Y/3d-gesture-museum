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
  var interiorExitPrompt = { armed: false, open: false, dismissed: false, hallId: null, x: 0, z: 0 };
  var RETURN_STATE_KEY = "cloudink.exterior.return-state.v1";
  var seatPromptEl = null;
  var seated = null;
  var sceneActive = false;
  var quality = null;
  var batchStats = null;
  var lowFpsStreak = 0;

  /* ---------- 全景俯瞰模式 ----------
   * player.js 每帧把相机锁在 1.6m 人眼高度、俯仰角为 0，所以只能第一人称。
   * 全景不开新相机：把相机摆在园区上方的环形轨道上，每帧在 player 之后覆写姿态，
   * 退出时交给下一帧 player.update 自然恢复。 */
  var panorama = { on: false, angle: Math.PI * 0.85, dist: 78, height: 44,
                   target: new THREE.Vector3(0, 2, 6) };
  var NEUTRAL_INPUT = { forward: false, back: false, turnLeft: false, turnRight: false, sprint: false };

  var keys = {};
  var lastPinchPick = 0;   // 上次捏合拾取的时间戳（冷却防抖）
  // 对齐 Kimi 原型：未锁定指针时，也支持按住左键拖动转向。
  var dragLook = { active: false, x: 0, y: 0, moved: false };
  var suppressClickAfterDrag = false;

  function saveExteriorReturnState() {
    if (window.MuseumInteriorOnly || !window.MuseumPlayer || !window.sessionStorage) return;
    var p = MuseumPlayer.getPosition();
    try {
      sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify({
        x: p.x,
        z: p.z,
        yaw: MuseumPlayer.getYaw(),
        savedAt: Date.now()
      }));
    } catch (e) { /* 存储不可用时仍允许正常跳转 */ }
  }

  function consumeExteriorReturnState() {
    if (!window.sessionStorage) return null;
    try {
      var raw = sessionStorage.getItem(RETURN_STATE_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(RETURN_STATE_KEY);
      var state = JSON.parse(raw);
      if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.z) || !Number.isFinite(state.yaw)) return null;
      return state;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 渲染预算与静态合批 ---------- */
  function detectRenderBudget() {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var width = window.innerWidth || 1280;
    var height = window.innerHeight || 720;
    var pixels = width * height * dpr * dpr;
    var memory = Number(navigator.deviceMemory) || 8;
    var cores = Number(navigator.hardwareConcurrency) || 8;
    var coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    var level = "high";
    if (coarse || width <= 900 || pixels > 4100000 || memory <= 4 || cores <= 4) level = "low";
    else if (pixels > 2400000 || memory <= 8 || cores <= 6) level = "medium";
    var forced = new URLSearchParams(location.search).get("quality");
    if (forced === "low" || forced === "medium" || forced === "high") level = forced;
    var cap = level === "low" ? 1.0 : level === "medium" ? 1.25 : 1.5;
    return {
      level: level,
      basePixelRatio: Math.min(dpr, cap),
      renderScale: level === "low" ? 0.85 : 1,
      shadows: level !== "low",
      shadowSize: level === "medium" ? 512 : 1024,
    };
  }

  function applyRendererSize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(quality.basePixelRatio * quality.renderScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function applyShadowBudget() {
    if (!renderer || !scene) return;
    renderer.shadowMap.enabled = !!quality.shadows;
    scene.traverse(function (node) {
      if (!node.isDirectionalLight || !node.castShadow) return;
      node.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      if (node.shadow.map) {
        node.shadow.map.dispose();
        node.shadow.map = null;
      }
    });
  }

  function updateAdaptiveQuality(fps) {
    if (!quality || !renderer) return;
    if (fps < 26) lowFpsStreak++;
    else lowFpsStreak = 0;
    if (lowFpsStreak < 2) return;
    lowFpsStreak = 0;
    var oldScale = quality.renderScale;
    quality.renderScale = Math.max(0.62, quality.renderScale - 0.12);
    if (fps < 28 && quality.shadows) {
      quality.shadows = false;
      applyShadowBudget();
    }
    if (quality.renderScale !== oldScale || !quality.shadows) {
      applyRendererSize();
      console.warn("[性能] 自动降级画质：FPS=" + fps + "，渲染比例=" + quality.renderScale.toFixed(2) + "，阴影=" + (quality.shadows ? "开" : "关"));
    }
  }

  function scheduleStaticBatch() {
    if (!scene || !window.MuseumStaticBatcher) return Promise.resolve(null);
    var started = Date.now();
    function modelsSettled() {
      if (!window.MuseumModels || !window.MuseumModels.stats) return true;
      var stats = window.MuseumModels.stats();
      return !stats.requested || stats.ready >= stats.requested || Date.now() - started > 12000;
    }
    return new Promise(function (resolve) {
      function run() {
        if (!modelsSettled()) { setTimeout(run, 300); return; }
        window.MuseumStaticBatcher.optimize(scene).then(function (result) {
          batchStats = result;
          console.info("[性能] 静态合批完成：" + result.beforeMeshes + " → " + result.afterMeshes + " meshes，共 " + result.batches + " 批");
          resolve(result);
        }).catch(function (error) {
          console.warn("[性能] 静态合批失败，继续使用原场景：", error && error.message ? error.message : error);
          resolve(null);
        });
      }
      var ready = window.MuseumExteriorSlots && window.MuseumExteriorSlots.ready;
      if (ready && typeof ready.then === "function") ready.then(run).catch(run);
      else run();
    });
  }
  /* ---------- 初始化 ---------- */
  function init() {
    // 必须先初始化 UI：getStage() / getVideo() 依赖 init() 里缓存的 DOM 引用
    MuseumUI.init();
    seatPromptEl = document.getElementById("seat-prompt");

    // 渲染器
    quality = detectRenderBudget();
    window.MuseumRenderQuality = quality.level;
    renderer = new THREE.WebGLRenderer({
      antialias: quality.level === "high",
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(quality.basePixelRatio * quality.renderScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    // 色调映射：把超过 1.0 的高光压回来，避免地面/墙面一片死白（此前中轴道路会被曝成浅灰）
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 曝光：走外观原型布局时按原型的 1.12，其余保持 1.0
  renderer.toneMappingExposure = (window.MuseumExteriorLayout && window.MuseumExteriorLayout.build) ? 1.12 : 1.0;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    MuseumUI.getStage().appendChild(renderer.domElement);
    renderer.domElement.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      sceneActive = false;
      console.warn("[性能] WebGL 上下文丢失，已暂停渲染等待恢复");
      if (MuseumUI && MuseumUI.toast) MuseumUI.toast("显卡渲染负载过高，正在恢复画面…", 3200);
    });
    renderer.domElement.addEventListener("webglcontextrestored", function () {
      if (quality) {
        quality.shadows = false;
        quality.renderScale = Math.min(quality.renderScale, 0.75);
        applyShadowBudget();
        applyRendererSize();
      }
      setSceneActive(true);
      console.warn("[性能] WebGL 上下文已恢复，已切换到低负载模式");
    });

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
    applyShadowBudget();
    var optimization = scheduleStaticBatch();
    if (window.MuseumScene) window.MuseumScene.optimization = optimization;
    if (window.MuseumAvatar) MuseumAvatar.init(scene);
    /* 昼夜氛围：接原型的 applyNight（js/lighting.js），场景建好后初始化 */
    if (window.MuseumLighting) window.MuseumLighting.init(renderer, scene, window.MuseumExteriorLayout);
    MuseumPlayer.init(camera);
    if (!window.MuseumInteriorOnly) {
      var returnHall = new URLSearchParams(location.search).get("returnHall");
      var restoredState = consumeExteriorReturnState();
      if (restoredState) {
        MuseumPlayer.teleport(restoredState.x, restoredState.z, restoredState.yaw);
        if (returnHall) {
          var restoredDoor = (MuseumScene.hallDoors || []).filter(function (d) { return d.hallId === returnHall; })[0];
          if (restoredDoor) hallDoorPrompt.dismissed = restoredDoor;
        }
      } else if (returnHall) {
        var returnDoor = (MuseumScene.hallDoors || []).filter(function (d) { return d.hallId === returnHall; })[0];
        if (returnDoor) {
          var returnGap = 3.2;
          var returnYaw = Math.atan2(-returnDoor.nx, returnDoor.nz);
          MuseumPlayer.teleport(returnDoor.x + returnDoor.nx * returnGap,
            returnDoor.z + returnDoor.nz * returnGap, returnYaw);
          hallDoorPrompt.dismissed = returnDoor;
        }
      }
    }
    if (window.MuseumInteriorOnly) {
      var interiorSpawns = {
        hall0: [0, 29, 0], hall1: [-25, -13, Math.PI / 2],
        hall2: [0, -16, 0], hall3: [25, -13, 0],
        hall4: [24, 13, -Math.PI / 2], hall5: [-24, 13, Math.PI / 2]
      };
      var interiorSpawn = interiorSpawns[window.MuseumInteriorHall] || interiorSpawns.hall4;
      MuseumPlayer.teleport(interiorSpawn[0], interiorSpawn[1], interiorSpawn[2]);
      interiorExitPrompt.hallId = window.MuseumInteriorHall || "hall4";
      interiorExitPrompt.x = interiorSpawn[0];
      interiorExitPrompt.z = interiorSpawn[1];
    }
    MuseumExhibit.init();
    /* 穿画流程：入口按钮 / 视频层 / 四画选择（组员1） */
    if (window.MuseumInkWorlds) MuseumInkWorlds.init();

    // 回调接线
    MuseumPlayer.setOnHallChange(function (hallId) {
      MuseumUI.setHall(hallId);
      if (window.MuseumInkWorlds) MuseumInkWorlds.setHall(hallId);
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
      MuseumUI.toast("欢迎来到云间入墨 · 伸出手掌开始漫游");
    }, 400);

    // 摄像头手势改为用户主动开启，避免 MediaPipe 与 3D 场景同时运行导致卡顿。
    MuseumUI.setCameraButton(false);
    MuseumUI.showCam(false);

    // 开屏页显示期间暂停主场景更新/渲染，避免两个 WebGL 场景同时占用 GPU。
    var intro = document.getElementById("intro");
    sceneActive = !intro || intro.classList.contains("bye") || getComputedStyle(intro).display === "none";

    // 启动主循环
    animate();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    window.addEventListener("keydown", function (e) {
      // 穿画视频 / 四画选择打开时，游戏快捷键全部让位给弹层
      if (window.MuseumInkWorlds && MuseumInkWorlds.isBlocking()) return;
      keys[e.code] = true;
      if (e.code === "KeyF") {
        e.preventDefault();
        if (!panorama.on && !MuseumUI.isPanelOpen()) toggleSeat();
        return;
      }
      if (e.code === "Escape" && seated) {
        e.preventDefault();
        standUp();
        return;
      }
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
      if (e.code === "KeyE" && panorama.on) { e.preventDefault(); return; }
    });
    window.addEventListener("keyup", function (e) { keys[e.code] = false; });
     // 鼠标：点画面 = 进入鼠标视角（锁定指针）；准星正对展品时，点一下 = 直接查看展品
    renderer.domElement.addEventListener("click", function () {
      if (window.MuseumInkWorlds && MuseumInkWorlds.isBlocking()) return; // 穿画/四画选择时不吃鼠标
      if (panorama.on) return;                      // 全景模式下与键盘/E 键一致，不做拾取
      if (suppressClickAfterDrag) {
        suppressClickAfterDrag = false;
        return;
      }
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
      if (dragLook.active && document.pointerLockElement !== renderer.domElement && !panorama.on) {
        var dx = (e.clientX || 0) - dragLook.x;
        var dy = (e.clientY || 0) - dragLook.y;
        if (dx || dy) dragLook.moved = true;
        MuseumPlayer.look(dx, dy);
        dragLook.x = e.clientX || 0;
        dragLook.y = e.clientY || 0;
      }
    });

    // Kimi 原型的左键拖动视角：不抢指针锁定，适合先观察模型和核对桥湖方向。
    renderer.domElement.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || panorama.on || document.pointerLockElement === renderer.domElement) return;
      dragLook.active = true;
      dragLook.x = e.clientX;
      dragLook.y = e.clientY;
      dragLook.moved = false;
      if (renderer.domElement.setPointerCapture) renderer.domElement.setPointerCapture(e.pointerId);
    });
    function endDragLook(e) {
      if (!dragLook.active) return;
      if (dragLook.moved) suppressClickAfterDrag = true;
      dragLook.active = false;
      if (e && renderer.domElement.releasePointerCapture && renderer.domElement.hasPointerCapture && renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    }
    renderer.domElement.addEventListener("pointerup", endDragLook);
    renderer.domElement.addEventListener("pointercancel", endDragLook);

    MuseumUI.setHandlers({
      onCameraToggle: function () { toggleCamera(!cameraOn); },
      onReset: function () { resetView(); },
      onClosePanel: function () {
        /* 关闭确认窗等同于取消：离开门口后才允许再次触发。 */
        if (hallDoorPrompt.door) hallDoorPrompt.dismissed = hallDoorPrompt.door;
        hallDoorPrompt.door = null;
        if (window.MuseumInteriorOnly && interiorExitPrompt.open) {
          interiorExitPrompt.open = false;
          interiorExitPrompt.dismissed = true;
        }
      },
    });
  }

  function nearestSeat() {
    if (seated || panorama.on || MuseumUI.isPanelOpen() || window.MuseumInteriorOnly) return null;
    var seats = (MuseumScene.seats || []), p = MuseumPlayer.getPosition();
    var nearest = null, best = 2.0;
    for (var i = 0; i < seats.length; i++) {
      var dx = p.x - seats[i].x, dz = p.z - seats[i].z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) { best = d; nearest = seats[i]; }
    }
    return nearest;
  }

  function updateSeatPrompt() {
    if (!seatPromptEl) return;
    if (seated) {
      seatPromptEl.textContent = "正在观画 · 按 F 或 Esc 起身";
      seatPromptEl.classList.add("show");
      return;
    }
    var seat = nearestSeat();
    if (seat) {
      seatPromptEl.textContent = "中轴画廊美人靠 · 按 F 坐下";
      seatPromptEl.classList.add("show");
    } else {
      seatPromptEl.classList.remove("show");
    }
  }

  function toggleSeat() {
    if (seated) { standUp(); return; }
    var seat = nearestSeat();
    if (!seat) return;
    seated = seat;
    MuseumPlayer.setSeated(true);
    MuseumPlayer.teleport(seat.x, seat.z, seat.yaw);
    MuseumUI.toast("已坐下观画 · 正面视角");
  }

  function standUp() {
    if (!seated) return;
    seated = null;
    MuseumPlayer.setSeated(false);
    MuseumUI.toast("已起身");
  }

  /* ---------- 展厅闭门提示 ---------- */
  function updateHallDoorPrompt() {
    if (window.MuseumInteriorOnly) {
      updateInteriorExitPrompt();
      return;
    }
    if (panorama.on || MuseumUI.isPanelOpen()) return;
    var doors = MuseumScene.hallDoors || [];
    var p = MuseumPlayer.getPosition();
    var nearest = null, best = 2.8;
    for (var i = 0; i < doors.length; i++) {
      var d = doors[i];
      if (!d.hallId) continue;
      /* 书斋、文创暂不开放：保留实体闭门和碰撞，不提供进入弹窗。 */
      if (d.hallId === 'hall4' || d.hallId === 'hall5') continue;
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
      saveExteriorReturnState();
      var pages = {
        hall1: "shanshui.html",
        hall2: "huaniao.html",
        hall3: "renwu.html",
        hall4: "shuzhai.html",
        hall5: "wenchuang.html"
      };
      if (nearest.hallId === "hall0") {
        location.href = "./index.html#/hall/plaza";
      } else {
        location.href = "./" + (pages[nearest.hallId] || "index.html#/hall/plaza");
      }
    }, function () {
      hallDoorPrompt.door = null;
      hallDoorPrompt.dismissed = nearest;
    });
  }

  /* 内饰出口：先离开起始点再返回，避免刚进入就弹窗。 */
  function updateInteriorExitPrompt() {
    if (panorama.on || MuseumUI.isPanelOpen()) return;
    var p = MuseumPlayer.getPosition();
    var dx = p.x - interiorExitPrompt.x, dz = p.z - interiorExitPrompt.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (!interiorExitPrompt.armed) {
      if (dist > 4.0) interiorExitPrompt.armed = true;
      return;
    }
    if (dist > 4.2) {
      interiorExitPrompt.dismissed = false;
      return;
    }
    if (interiorExitPrompt.dismissed || interiorExitPrompt.open) return;
    interiorExitPrompt.open = true;
    MuseumUI.showHallPrompt("返回园区", function () {
      interiorExitPrompt.open = false;
      location.href = "./index.html?returnHall=" + encodeURIComponent(interiorExitPrompt.hallId) + "#/hall/plaza";
    }, function () {
      interiorExitPrompt.open = false;
      interiorExitPrompt.dismissed = true;
    });
  }

  function resize() {
    window.addEventListener("resize", applyRendererSize);
  }

  function setSceneActive(active) {
    sceneActive = !!active;
    if (!sceneActive) return;
    clock.getDelta();
    fpsFrames = 0;
    fpsStamp = (typeof performance !== "undefined" ? performance.now() : Date.now());
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
        console.warn("[云间入墨] 手势启动失败：", err && err.message ? err.message : err);
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
    if (window.MuseumInteriorOnly) {
      var interiorSpawns = {
        hall0: [0, 29, 0], hall1: [-25, -13, Math.PI / 2],
        hall2: [0, -16, 0], hall3: [25, -13, 0],
        hall4: [24, 13, -Math.PI / 2], hall5: [-24, 13, Math.PI / 2]
      };
      var s = interiorSpawns[window.MuseumInteriorHall] || interiorSpawns.hall4;
      MuseumPlayer.teleport(s[0], s[1], s[2]);
      interiorExitPrompt.armed = false;
      interiorExitPrompt.open = false;
      interiorExitPrompt.dismissed = false;
    } else {
      MuseumPlayer.reset();
    }
    // 重置后相机姿态由下一帧 update 应用
    var p = MuseumPlayer.getPosition();
    camera.position.copy(p);
    MuseumUI.toast("已重置视角");
  }

  /* ---------- 运行时资源快照（低帧率诊断用） ---------- */
  function getRuntimeStats() {
    if (!renderer || !scene) return null;
    var counts = { objects: 0, meshes: 0, instancedMeshes: 0, lights: 0, pointLights: 0, shadowCasters: 0 };
    var geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(function (node) {
      counts.objects++;
      if (node.isLight) {
        counts.lights++;
        if (node.isPointLight) counts.pointLights++;
      }
      if (!node.isMesh) return;
      counts.meshes++;
      if (node.isInstancedMesh) counts.instancedMeshes++;
      if (node.castShadow) counts.shadowCasters++;
      if (node.geometry) geometries.add(node.geometry.uuid);
      if (node.material) {
        var list = Array.isArray(node.material) ? node.material : [node.material];
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          materials.add(m.uuid);
          ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "emissiveMap"].forEach(function (key) {
            if (m[key]) textures.add(m[key].uuid);
          });
        }
      }
    });
    counts.geometries = geometries.size;
    counts.materials = materials.size;
    counts.textures = textures.size;
    return {
      scene: counts,
      quality: quality,
      batching: batchStats,
      active: sceneActive,
      renderer: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        points: renderer.info.render.points,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio: renderer.getPixelRatio(),
        drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
        cssSize: [renderer.domElement.clientWidth, renderer.domElement.clientHeight],
        shadows: renderer.shadowMap.enabled,
        antialias: renderer.getContext().getContextAttributes().antialias,
      },
    };
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
    if (!sceneActive) return;
    var dt = Math.min(clock.getDelta(), 0.05);

    fpsFrames++;
    var nowMs = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (nowMs - fpsStamp >= 2000) {
      var fps = Math.round(fpsFrames * 1000 / (nowMs - fpsStamp));
      console.info("[帧率] " + fps + " fps");
      updateAdaptiveQuality(fps);
      fpsFrames = 0; fpsStamp = nowMs;
    }

    var inkBlocking = !!(window.MuseumInkWorlds && MuseumInkWorlds.isBlocking());
    var gs = MuseumGesture.getState();
    var input = inkBlocking ? NEUTRAL_INPUT : composeInput(gs);

    // 捏合：弹窗打开时关闭弹窗，否则拾取当前展品（等价于按 E）。
    // 边沿触发 + 600ms 冷却防连开连关；全景模式下不拾取（与点击一致），但仍可关弹窗
    // 穿画 / 四画选择层打开时，捏合由 ink-worlds.js 自己消费，这里不响应
    if (!inkBlocking && gs.pinchPressed && nowMs - lastPinchPick > 600) {
      lastPinchPick = nowMs;
      if (MuseumUI.isPanelOpen()) {
        MuseumUI.hidePanel();
      } else if (!panorama.on) {
        MuseumExhibit.pick();
      }
    }

    if (seated) {
      MuseumPlayer.update(dt, NEUTRAL_INPUT, camera);
    } else if (inkBlocking) {
      // 冻结漫游：键盘/手势都不驱动位移，画面停在原地看着弹层
      MuseumPlayer.update(dt, NEUTRAL_INPUT, camera);
    } else if (panorama.on) {
      // 冻结漫游位移（人站在原地看着，退出后回到原处），再覆写相机姿态
      MuseumPlayer.update(dt, NEUTRAL_INPUT, camera);
      updatePanorama(dt, input);
    } else {
      MuseumPlayer.update(dt, input, camera);
      if (window.MuseumAvatar) MuseumAvatar.update(camera, dt);
    }
    if (!inkBlocking) updateHallDoorPrompt();
    updateSeatPrompt();
    MuseumExhibit.update();
    MuseumScene.update();
    if (window.MuseumLighting) window.MuseumLighting.update(dt);   /* 昼夜平滑过渡 */

    renderer.render(scene, camera);
  }

  return {
    init: init,
    saveExteriorReturnState: saveExteriorReturnState,
    setPanorama: setPanorama,
    togglePanorama: function () { setPanorama(!panorama.on); },
    isPanorama: function () { return panorama.on; },
    getRuntimeStats: getRuntimeStats,
    setSceneActive: setSceneActive,
  };
})();

/* 页面加载完成后启动 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { window.MuseumMain.init(); });
} else {
  window.MuseumMain.init();
}
