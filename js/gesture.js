/* ============================================================
 * gesture.js —— MediaPipe 手势识别与映射（项目核心亮点）
 * 归属：组员3（手势 AI 交互工程师）
 * ------------------------------------------------------------
 * 职责：
 *   1. 启动摄像头（getUserMedia）
 *   2. 加载 MediaPipe HandLandmarker（WASM 与模型从官方 CDN 运行时加载）
 *   3. 每帧识别手部 21 关键点，判定手势状态
 *   4. 输出统一手势状态给 main.js（与键盘输入合并）
 *
 * 手势约定（优先级从高到低）：
 *   捏合（拇指+食指靠近）→ pinch：查看/确认
 *   张开手掌（五指全伸）→ forward：向前漫游
 *   握拳（五指全收）   → stop：停止
 *   指点（仅食指伸出）→ turn：根据食指指向左右转向
 *
 * 依赖：config.js（MuseumConfig.gesture 阈值）、HTML 中 <video id="cam">
 * 失败约定：init() 的 reject 带 stage（camera | model）与 hint（可直接展示的中文原因），
 *          也可用 getLastError() 读；失败路径内部已释放摄像头与模型实例，
 *          main.js 只需展示 hint 并保持键盘模式
 * ============================================================ */

window.MuseumGesture = (function () {

  var video = null;
  var handLandmarker = null;
  var running = false;
  var stream = null;
  var starting = false;      // init() 进行中；超时后用它丢弃迟到的模型实例
  var startingPromise = null; // 进行中的启动链，供重复点击复用
  var lastError = null;      // 最近一次启动失败：{ stage, hint }

  /* 手势输出状态（main.js 每帧读取） */
  var state = {
    forward: false,      // 张掌 → 前进
    turn: 0,             // -1 ~ 1，负=左转 正=右转（0=不转）
    pinch: false,        // 当前是否捏合
    pinchPressed: false, // 本次捏合刚按下（边沿触发，一次性）
    active: false,       // 是否检测到手
  };

  var cfg = { forwardOpen: 0.62, fistClose: 0.30, pinchDist: 0.055, turnDead: 0.18, turnMax: 0.42, smooth: 0.12, camWidth: 320, camHeight: 240 };

  var pinchPrev = false;
  var turnSmoothed = 0;

  var WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";
  var MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  var VISION_WAIT_MS = 12000;   // 等 index.html 的动态 import 完成
  var MODEL_LOAD_MS = 25000;    // 等 WASM + 模型初始化（GPU delegate 卡死时靠它兜底）

  /* ---------- 错误分类 ---------- */
  // stage 区分「摄像头」与「模型」两类失败，hint 是给用户看的中文原因，
  // 让 main.js 的 catch 能直接展示，而不是统一糊成一句「摄像头不可用」。
  function makeError(stage, hint, cause) {
    var err = new Error(hint);
    err.stage = stage;
    err.hint = hint;
    if (cause) err.cause = cause;
    return err;
  }

  function describeCameraError(err) {
    var name = (err && err.name) || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return "摄像头权限被拒绝：请在浏览器地址栏将摄像头设为「允许」后重新点击摄像头按钮";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "未检测到可用摄像头：已切换为键盘模式";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "摄像头被其他程序占用（微信 / 钉钉 / 腾讯会议等）：关闭占用程序后重试";
    }
    if (name === "OverconstrainedError") {
      return "摄像头不支持请求的分辨率：已切换为键盘模式";
    }
    return "摄像头启动失败：" + (name || (err && err.message) || "未知原因");
  }

  // 模型阶段（CDN / WASM / .task 下载 / GPU 初始化）的原始报错统一打上 stage=model，
  // 并换成照着能做的中文提示——答辩现场断网最先撞上的就是这一类
  function tagModelError(err) {
    if (err && err.stage) return err;
    var msg = (err && err.message) || (err && err.name) || "未知错误";
    var hint = /fetch|network|404|Failed to|load/i.test(msg)
      ? "手势模型下载失败（首次需从 CDN 拉取约 10MB）：请检查网络后重试，或使用键盘模式"
      : "手势模型初始化失败：" + msg + "（可改用键盘模式参观）";
    return makeError("model", hint, err);
  }

  /* ---------- 超时保护 ---------- */
  // GPU delegate 在部分机器上既不 resolve 也不 reject，只会一直挂着，
  // 那时 loading 层会永远停在那里，所以整条加载链必须有一个上限。
  function withTimeout(promise, ms, stage, hint) {
    var timer;
    var guarded = promise.then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; },
    );
    return Promise.race([
      guarded,
      new Promise(function (_resolve, reject) {
        timer = setTimeout(function () { reject(makeError(stage, hint)); }, ms);
      }),
    ]);
  }

  /* ---------- 启动摄像头 ---------- */
  function startCamera() {
    if (!video) {
      return Promise.reject(makeError("camera", "页面缺少摄像头预览元素（<video id=\"cam\">），无法启动手势"));
    }
    // 非安全上下文（file:// 或 http://内网IP）下浏览器根本不暴露 mediaDevices，
    // 这里单独判一次，否则会被误报成「没有摄像头」，答辩现场最难查的就是这种。
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(makeError(
        "camera",
        "当前页面无法调用摄像头（浏览器要求 https:// 或 localhost）：请用键盘模式参观",
      ));
    }
    // muted + playsinline：绕开自动播放策略，避免 video.play() 被拒后画面不更新
    video.muted = true;
    video.setAttribute("playsinline", "true");

    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: cfg.camWidth }, height: { ideal: cfg.camHeight }, facingMode: "user" },
      audio: false,
    }).then(function (s) {
      stream = s;
      video.srcObject = s;
      // 预览播不出来不影响识别（detectForVideo 直接读视频轨），只记警告
      // 老浏览器 play() 不返回 Promise，所以先判一下再挂 catch
      var played = video.play();
      if (!played || !played.catch) return;
      return played.catch(function (playErr) {
        console.warn("[云墨美术馆] 摄像头预览未能自动播放（识别继续）：", playErr && playErr.name);
      });
    }).catch(function (err) {
      if (err && err.stage) throw err;
      throw makeError("camera", describeCameraError(err), err);
    });
  }

  /* ---------- 加载 MediaPipe 模型 ---------- */
  // MediaPipe 由 index.html 以 ES Module 形式异步加载（window.MediaPipeReady），
  // 这里等待它就绪后再取全局的 FilesetResolver / HandLandmarker。
  function waitForVision(timeoutMs) {
    if (typeof FilesetResolver !== "undefined" && typeof HandLandmarker !== "undefined") {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        if (typeof FilesetResolver !== "undefined" && typeof HandLandmarker !== "undefined") {
          resolve();
        } else {
          reject(makeError("model", "MediaPipe 依赖未加载（CDN 拉取失败）：请检查网络后重试，或使用键盘模式"));
        }
      }
      window.addEventListener("mediapipe-ready", finish, { once: true });
      // index.html 的 import 失败时 MediaPipeReady 会 resolve(false)，
      // 据此立刻失败，不必让演示者干等 12 秒
      if (window.MediaPipeReady && window.MediaPipeReady.then) {
        window.MediaPipeReady.then(function (ok) { if (!ok) finish(); });
      }
      setTimeout(finish, timeoutMs || VISION_WAIT_MS);
    });
  }

  function landmarkerOptions(delegate) {
    return {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: delegate },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minTrackingConfidence: 0.5,
    };
  }

  function loadModel() {
    return waitForVision(VISION_WAIT_MS).then(function () {
      return FilesetResolver.forVisionTasks(WASM_URL);
    }).then(function (vision) {
      // 优先 GPU，失败降级 CPU；两者都是同一份 options，只差 delegate
      return HandLandmarker.createFromOptions(vision, landmarkerOptions("GPU")).catch(function (gpuErr) {
        console.warn("[云墨美术馆] GPU delegate 不可用，降级 CPU：", gpuErr && gpuErr.message);
        return HandLandmarker.createFromOptions(vision, landmarkerOptions("CPU"));
      });
    }).then(function (lm) {
      if (!starting) {
        // 已经超时或被 stop()：关掉这个迟到的实例，避免留下第二个 WASM 上下文
        try { lm.close(); } catch (e) { /* ignore */ }
        return;
      }
      handLandmarker = lm;
    }).catch(function (err) {
      throw tagModelError(err);
    });
  }

  /* ---------- 手势判定 ---------- */
  function classify(landmarks) {
    var lm = landmarks;
    var wrist = lm[0];
    var base = dist(lm[9], wrist);          // 掌根到腕 = 手掌尺度
    if (base < 1e-5) base = 1e-5;

    var tips = [4, 8, 12, 16, 20];
    var ratios = tips.map(function (i) { return dist(lm[i], wrist) / base; });

    // 捏合：拇指尖(4)与食指尖(8)靠近
    var pinchDistNorm = dist(lm[4], lm[8]) / base;
    var pinching = pinchDistNorm < cfg.pinchDist;

    // 张掌：五指均伸开
    var allOpen = ratios.every(function (r) { return r > cfg.forwardOpen; });
    // 握拳：五指均收起
    var allClose = ratios.every(function (r) { return r < cfg.fistClose; });
    // 指点：仅食指伸开
    var indexOnly = ratios[1] > 1.35 && ratios[0] < 1.05 && ratios[2] < 1.15 && ratios[3] < 1.15 && ratios[4] < 1.15;

    // 转向：镜像后食指尖相对腕的横向偏移（视频显示为镜像，取 1 - x）
    var dx = (1 - lm[8].x) - (1 - lm[0].x);
    var turnAmount = 0;
    if (indexOnly) {
      var abs = Math.abs(dx);
      if (abs > cfg.turnDead) {
        turnAmount = Math.min((abs - cfg.turnDead) / (cfg.turnMax - cfg.turnDead), 1) * Math.sign(dx);
      }
    }

    return {
      pinching: pinching,
      allOpen: allOpen,
      allClose: allClose,
      indexOnly: indexOnly,
      turn: turnAmount,
    };
  }

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
  }

  /* ---------- 帧循环（每帧识别一次） ---------- */
  function tick() {
    if (!running) return;
    if (handLandmarker && video.readyState >= 2) {
      var result;
      try {
        result = handLandmarker.detectForVideo(video, performance.now());
      } catch (e) {
        // 偶发识别异常：跳过本帧
        result = null;
      }
      if (result && result.landmarks && result.landmarks.length > 0) {
        var g = classify(result.landmarks[0]);
        state.active = true;
        state.forward = g.allOpen && !g.pinching;
        state.pinch = g.pinching;

        // 捏合边沿触发（防重复触发）
        state.pinchPressed = g.pinching && !pinchPrev;
        pinchPrev = g.pinching;

        // 转向平滑
        turnSmoothed += (g.turn - turnSmoothed) * cfg.smooth;
        state.turn = Math.abs(turnSmoothed) < 0.02 ? 0 : turnSmoothed;
      } else {
        state.active = false;
        state.forward = false;
        state.pinch = false;
        state.pinchPressed = false;
        state.turn = 0;
        pinchPrev = false;
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- 释放全部外部资源（摄像头 / 模型 / 平滑状态） ---------- */
  function shutdown() {
    starting = false;
    startingPromise = null;
    running = false;
    state.active = false;
    state.forward = false;
    state.pinch = false;
    state.pinchPressed = false;
    state.turn = 0;
    pinchPrev = false;
    turnSmoothed = 0;
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (video) video.srcObject = null;
    if (handLandmarker) {
      try { handLandmarker.close(); } catch (e) { /* ignore */ }
      handLandmarker = null;
    }
  }

  /* ---------- 对外 API ---------- */
  return {
    init: function (videoEl) {
      video = videoEl;
      var gc = window.MuseumConfig && window.MuseumConfig.gesture;
      if (gc) {
        cfg.forwardOpen = gc.forwardOpen;
        cfg.fistClose = gc.fistClose;
        cfg.pinchDist = gc.pinchDist;
        cfg.turnDead = gc.turnDead;
        cfg.turnMax = gc.turnMax;
        cfg.smooth = gc.smooth;
      }
      // 已在运行直接返回；正在启动时再点一次就复用同一条启动链——
      // 既不会再开一条视频流，也不会提前回一句「已就绪」骗过 main.js
      if (running) {
        return Promise.resolve(true);
      }
      if (starting && startingPromise) {
        return startingPromise;
      }
      lastError = null;
      starting = true;
      var chain = startCamera()
        .then(function () {
          return withTimeout(loadModel(), MODEL_LOAD_MS, "model",
            "手势模型加载超时（首次需从 CDN 下载约 10MB）：请检查网络后重试，或使用键盘模式");
        })
        .then(
          function () {
            starting = false;
            startingPromise = null;
            running = true;
            requestAnimationFrame(tick);
            return true;
          },
          function (err) {
            lastError = {
              stage: (err && err.stage) || "camera",
              hint: (err && err.hint) || (err && err.message) || "手势启动失败",
            };
            // 关键：模型加载失败时摄像头已经开着，必须在这里关掉，
            // 否则浏览器指示灯常亮，再点一次还会叠出第二条流
            shutdown();
            throw err;
          },
        );
      startingPromise = chain;
      return chain;
    },
    stop: function () {
      shutdown();
    },
    getState: function () { return state; },
    isRunning: function () { return running; },
    getLastError: function () { return lastError; },
  };
})();
