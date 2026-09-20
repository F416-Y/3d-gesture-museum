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
 * 注意：摄像头画面不可用时自动降级，由 main.js 走键盘控制
 * ============================================================ */

window.MuseumGesture = (function () {

  var video = null;
  var handLandmarker = null;
  var running = false;
  var stream = null;

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

  /* ---------- 启动摄像头 ---------- */
  function startCamera() {
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: cfg.camWidth }, height: { ideal: cfg.camHeight }, facingMode: "user" },
      audio: false,
    }).then(function (s) {
      stream = s;
      video.srcObject = s;
      return video.play();
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
          reject(new Error("MediaPipe 依赖未加载（vision_bundle.mjs 拉取失败），请检查网络"));
        }
      }
      window.addEventListener("mediapipe-ready", finish, { once: true });
      setTimeout(finish, timeoutMs || 12000);
    });
  }

  function loadModel() {
    return waitForVision(12000).then(function () {
      return FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
    }).then(function (vision) {
      // 优先 GPU，失败时降级 CPU（部分笔记本 GPU delegate 不可用）
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minTrackingConfidence: 0.5,
      }).catch(function () {
        return HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });
      });
    }).then(function (lm) {
      handLandmarker = lm;
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
      return startCamera().then(loadModel).then(function () {
        running = true;
        requestAnimationFrame(tick);
        return true;
      });
    },
    stop: function () {
      running = false;
      state.active = false;
      state.forward = false;
      state.pinch = false;
      state.pinchPressed = false;
      state.turn = 0;
      if (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
      }
      if (video) video.srcObject = null;
      if (handLandmarker) {
        try { handLandmarker.close(); } catch (e) { /* ignore */ }
        handLandmarker = null;
      }
    },
    getState: function () { return state; },
    isRunning: function () { return running; },
  };
})();
