/* ============================================================
 * gesture.js —— MediaPipe 手势识别与映射（项目核心亮点）
 * 归属：组员3（手势 AI 交互工程师）
 * ------------------------------------------------------------
 * 职责：
 *   1. 启动摄像头（getUserMedia）
 *   2. 加载 MediaPipe HandLandmarker（vision_bundle / WASM / 模型均已本地化，断网可用）
 *   3. 每帧识别手部 21 关键点，判定手势状态
 *   4. 输出统一手势状态给 main.js（与键盘输入合并）
 *
 * 手势约定（优先级从高到低）：
 *   捏合（拇指食指相捏、其余三指张开）→ pinch：查看展品 / 弹窗打开时关闭弹窗
 *   张开手掌（五指全伸）→ forward：向前漫游
 *   握拳（五指全收）   → back：向后退
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
    back: false,         // 握拳 → 后退
    turn: 0,             // -1 ~ 1，正=指向左 负=指向右（0=不转）
    pinch: false,        // 当前是否捏合
    pinchPressed: false, // 本次捏合刚按下（边沿触发，一次性）
    active: false,       // 是否检测到手
  };

  var cfg = { forwardOpen: 0.95, fingerCurl: 0.72, pinchOpenCurl: 0.6, thumbFist: 0.92, pinchOn: 0.25, pinchOff: 0.35, turnDead: 0.7, turnMax: 1.6, forwardFrames: 4, backFrames: 2, turnFrames: 3, smooth: 0.12, release: 0.35, camWidth: 320, camHeight: 240 };

  var pinchPrev = false;
  var turnSmoothed = 0;
  var forwardStreak = 0;   // 张掌已连续保持的帧数
  var backStreak = 0;      // 握拳已连续保持的帧数
  var turnStreak = 0;      // 指点姿态已连续保持的帧数

  /* ---------- 调试浮层（URL 带 debug 或按 ` 键开关；演示时不用） ---------- */
  var debugEl = null;
  var debugOn = false;
  var debugBound = false;

  function setDebug(on) {
    debugOn = !!on;
    if (debugOn && !debugEl) {
      debugEl = document.createElement("div");
      debugEl.style.cssText =
        "position:fixed;left:8px;bottom:8px;z-index:9999;padding:6px 8px;" +
        "background:rgba(0,0,0,.72);color:#7fffa0;font:11px/1.5 Consolas,monospace;" +
        "white-space:pre;border-radius:4px;pointer-events:none;";
      document.body.appendChild(debugEl);
    }
    if (debugEl) debugEl.style.display = debugOn ? "block" : "none";
  }

  function updateDebug(g) {
    if (!debugOn || !debugEl) return;
    if (!g) { debugEl.textContent = "未检测到手"; return; }
    debugEl.textContent =
      "指比 拇/食/中/环/小: " + g.ratios.map(function (v) { return v.toFixed(2); }).join(" ") + "\n" +
      "indexOnly=" + (g.indexOnly ? 1 : 0) + " 转向帧=" + turnStreak + "/" + cfg.turnFrames +
      "  dx=" + g.dx.toFixed(2) + " (死区" + cfg.turnDead + " 满速" + cfg.turnMax + ")  turn=" + state.turn.toFixed(2) + "\n" +
      "allOpen=" + (g.allOpen ? 1 : 0) + " 前进帧=" + forwardStreak + "/" + cfg.forwardFrames +
      "  allClose=" + (g.allClose ? 1 : 0) + " 后退帧=" + backStreak + "/" + cfg.backFrames + "\n" +
      "卷曲 食/中/环/小: " + g.curls.map(function (v) { return v.toFixed(2); }).join(" ") +
      "  pinchD=" + g.pinchDist.toFixed(2) + " 捏合=" + (state.pinch ? 1 : 0);
  }

  // 离线化：WASM 四件套与 hand_landmarker.task 随仓库分发（js/vendor/mediapipe/ 与 assets/models/），
  // 答辩现场断网也能启动手势；路径相对页面根，dist 由 postbuild 原样拷贝
  var WASM_URL = "./js/vendor/mediapipe/wasm";
  var MODEL_URL = "./assets/models/hand_landmarker.task";
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

  // 模型阶段（vendor 文件 / WASM / .task 读取 / GPU 初始化）的原始报错统一打上 stage=model，
  // 并换成照着能做的中文提示——答辩现场断网最先撞上的就是这一类
  function tagModelError(err) {
    if (err && err.stage) return err;
    var msg = (err && err.message) || (err && err.name) || "未知错误";
    var hint = /fetch|network|404|Failed to|load/i.test(msg)
      ? "手势模型文件加载失败（本地文件缺失或被拦截）：请刷新重试，或使用键盘模式"
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
      // 黑屏排查自检：打印实际被浏览器选中的设备（虚拟摄像头在这现形）。
      // 黑帧探针扎两次（1 秒 + 3 秒）：流启动瞬间自动曝光常把遮挡画面拉成
      // 灰噪（亮度 >3），单扎 1 秒会漏掉随后稳定输出的真黑帧（实测：Lenovo
      // 物理拨片关闭后，1 秒时为灰噪、2 秒后才稳定纯黑）；每种问题只报一次
      var track = s.getVideoTracks && s.getVideoTracks()[0];
      if (track) {
        console.log("[云墨美术馆] 已选中的摄像头：", track.label || "(无设备名)");
      }
      var probeWarned = { noFrame: false, black: false };
      function probeBlackFrame() {
        if (!video.srcObject) return;
        var hasFrame = video.readyState >= 2 && video.videoWidth > 0;
        if (!hasFrame) {
          if (probeWarned.noFrame) return;
          probeWarned.noFrame = true;
          console.warn(
            "[云墨美术馆] 摄像头已授权但无画面：浏览器没拿到视频帧",
            track && track.label ? "（设备：" + track.label + "）。" : "。",
            "常见于内置容器或虚拟摄像头；请在 Chrome / Edge 打开，或用系统相机验证设备",
          );
          return;
        }
        // 有帧不等于有画面：抽一帧量亮度与波动。
        // 区分「正常画面」和「黑帧/纯色替代帧」——物理遮挡片、隐私模式下驱动
        // 会输出纯色合成帧而非纯黑（实测 Lenovo 拨片关闭：亮度 26.0/255、波动 0.0），
        // 真实场景再暗也有传感器噪点（波动 >3），故「亮度 <60 且波动 <3」判定
        try {
          var probe = document.createElement("canvas");
          probe.width = video.videoWidth;
          probe.height = video.videoHeight;
          var pctx = probe.getContext("2d", { willReadFrequently: true });
          pctx.drawImage(video, 0, 0);
          var px = pctx.getImageData(0, 0, probe.width, probe.height).data;
          var sum = 0;
          var sumSq = 0;
          for (var i = 0; i < px.length; i += 4) {
            var lum = px[i] + px[i + 1] + px[i + 2];
            sum += lum;
            sumSq += lum * lum;
          }
          var n = px.length / 4;
          var mean = sum / n / 3;
          var std = Math.sqrt(Math.max(sumSq / n - (sum / n) * (sum / n), 0)) / 3;
          // 亮度数值始终留痕（无论是否越阈）：排查「看着黑但没报警」时需要知道实测值
          console.log("[云墨美术馆] 启动画面亮度 " + mean.toFixed(1) + "/255 波动 " + std.toFixed(1) + "（黑帧判定：亮度<60 且波动<3）");
          if (mean < 60 && std < 3 && !probeWarned.black) {
            probeWarned.black = true;
            console.warn(
              "[云墨美术馆] 摄像头在出黑帧/纯色替代帧（亮度 " + mean.toFixed(1) + "/255，波动 " + std.toFixed(1) + "）：",
              "最常见是笔记本物理遮挡片或 Lenovo Vantage 相机隐私模式；",
              "打开系统「相机」应用确认，再检查机身滑片 / 按 Fn+F8 / 在 Vantage 里解除隐私模式",
            );
          }
        } catch (probeErr) {
          console.warn("[云墨美术馆] 黑帧检测失败：", probeErr && probeErr.message);
        }
      }
      setTimeout(probeBlackFrame, 1000);
      setTimeout(probeBlackFrame, 3000);
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
          reject(makeError("model", "MediaPipe 依赖未加载（js/vendor/mediapipe 文件缺失）：请刷新重试，或使用键盘模式"));
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
    // 用 2D 距离：MediaPipe 的 z 是估计深度、噪声大，捏合这种小间距判断会被 z 抖动淹没；
    // 这里只返回距离数值，进入/退出双阈值（迟滞）判定放在 tick 里做
    var pinchDistNorm = dist2D(lm[4], lm[8]) / base;

    // 张掌：五指均伸开
    var allOpen = ratios.every(function (r) { return r > cfg.forwardOpen; });

    // 手指卷曲度：指尖到「自己指根」的距离 ÷ 掌宽。
    // 握拳与捏合各用各的阈值：握拳要四指 < fingerCurl，捏合要中/环/小 > pinchOpenCurl。
    // 两者解耦，调松握拳不会把捏合的「三指张开」一起抬高
    var mcpIds = [5, 9, 13, 17];    // 食/中/环/小指的指根关节
    var tipIds = [8, 12, 16, 20];
    var curls = tipIds.map(function (tip, f) { return dist(lm[tip], lm[mcpIds[f]]) / base; });

    // 握拳：食指~小指四指均蜷曲 + 拇指未外伸。
    // 拇指不参与「蜷曲」判定（握拳时拇指或搭或收个体差异最大），但不能完全不看它——
    // 「竖起大拇指」同样是四指皆蜷，不卡拇指外伸会把点赞误判成握拳后退。
    // 拇指阈值放宽到 0.92：实测握拳 0.71~0.75、竖大拇指 ≥1.0，
    // 但要容忍「拇指搭在拳头上」的自然握法（0.85 时这种握法会被判不是拳）
    var allClose = curls.every(function (c) { return c < cfg.fingerCurl; }) && ratios[0] < cfg.thumbFist;
    // 指点：仅食指伸开（拇指不限——手枪式指点时拇指是自然伸出的，
    // 强制拇指收拢会让大多数人的指点姿态永远判不成立）
    var indexOnly = ratios[1] > 1.30 && ratios[2] < 1.20 && ratios[3] < 1.20 && ratios[4] < 1.20;

    // 转向：食指尖相对腕的横向偏移 ÷ 手掌画面宽度。
    // 符号关键：MediaPipe 给的是未镜像原始坐标（用户的左手出现在画面右侧），
    // 而视频预览是镜像的——两个 x 相减时 1-x 会抵消，真正的镜像修正就是差值的符号。
    // 取「指尖 - 腕」：指向屏幕左侧时 dx>0 → 镜头向左，与镜像预览的直觉一致。
    // 除以手掌宽度后判定随手距自动缩放，手离摄像头远近手感一致
    var base2d = dist2D(lm[9], wrist);
    if (base2d < 1e-5) base2d = 1e-5;
    var dx = (lm[8].x - lm[0].x) / base2d;
    var turnAmount = 0;
    if (indexOnly) {
      var abs = Math.abs(dx);
      if (abs > cfg.turnDead) {
        turnAmount = Math.min((abs - cfg.turnDead) / (cfg.turnMax - cfg.turnDead), 1) * Math.sign(dx);
      }
    }

    return {
      pinchDist: pinchDistNorm,
      allOpen: allOpen,
      allClose: allClose,
      indexOnly: indexOnly,
      turn: turnAmount,
      ratios: ratios,
      curls: curls,
      dx: dx,
    };
  }

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
  }

  function dist2D(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
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

        // 捏合：双阈值迟滞 + 中/环/小三指必须张开（食指卷不卷都行——
        // 捏合时食指本就弯成 C 形去够拇指，实测卷曲度 0.44 < 0.72，
        // 旧版「食指必须伸展」会把真实捏合判成握拳，触发后退）。
        // 三指张开用 pinchOpenCurl（不是握拳的 fingerCurl），两套判定解耦
        var pinchDistOK = pinchPrev ? g.pinchDist < cfg.pinchOff : g.pinchDist < cfg.pinchOn;
        var threeOpen = g.curls[1] > cfg.pinchOpenCurl && g.curls[2] > cfg.pinchOpenCurl && g.curls[3] > cfg.pinchOpenCurl;
        var pinching = pinchDistOK && threeOpen;
        state.pinch = pinching;
        state.pinchPressed = pinching && !pinchPrev;
        pinchPrev = pinching;

        // 张掌前进：需连续保持若干帧才启动，指点/握拳等手势的过渡帧不再误触前进
        forwardStreak = (g.allOpen && !pinching) ? forwardStreak + 1 : 0;
        state.forward = forwardStreak >= cfg.forwardFrames;

        // 握拳后退：与张掌同理，连续保持若干帧才启动，捏合时不判定
        backStreak = (g.allClose && !pinching) ? backStreak + 1 : 0;
        state.back = backStreak >= cfg.backFrames;

        // 指点转向：同样需连续保持若干帧才启动；
        // 松开后换用更大的 release 系数快速回正，避免「手已放下、镜头还在转」的拖尾
        turnStreak = g.indexOnly ? turnStreak + 1 : 0;
        var rawTurn = turnStreak >= cfg.turnFrames ? g.turn : 0;
        turnSmoothed += (rawTurn - turnSmoothed) * (rawTurn !== 0 ? cfg.smooth : cfg.release);
        state.turn = Math.abs(turnSmoothed) < 0.03 ? 0 : turnSmoothed;
        updateDebug(g);
      } else {
        state.active = false;
        state.forward = false;
        state.back = false;
        state.pinch = false;
        state.pinchPressed = false;
        state.turn = 0;
        pinchPrev = false;
        forwardStreak = 0;
        backStreak = 0;
        turnStreak = 0;
        turnSmoothed = 0;
        updateDebug(null);
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
    state.back = false;
    state.pinch = false;
    state.pinchPressed = false;
    state.turn = 0;
    pinchPrev = false;
    turnSmoothed = 0;
    forwardStreak = 0;
    backStreak = 0;
    turnStreak = 0;
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
      // 调试浮层：URL 带 debug（hash 路由下形如 /?debug#/）或按 ` 键切换
      if (!debugBound) {
        debugBound = true;
        if ((location.search + location.hash).indexOf("debug") >= 0) setDebug(true);
        window.addEventListener("keydown", function (e) {
          if (e.code === "Backquote") setDebug(!debugOn);
        });
      }
      var gc = window.MuseumConfig && window.MuseumConfig.gesture;
      if (gc) {
        cfg.forwardOpen = gc.forwardOpen;
        cfg.fingerCurl = gc.fingerCurl;
        if (gc.pinchOpenCurl != null) cfg.pinchOpenCurl = gc.pinchOpenCurl;
        if (gc.thumbFist != null) cfg.thumbFist = gc.thumbFist;
        cfg.pinchOn = gc.pinchOn;
        cfg.pinchOff = gc.pinchOff;
        cfg.turnDead = gc.turnDead;
        cfg.turnMax = gc.turnMax;
        cfg.forwardFrames = gc.forwardFrames;
        cfg.backFrames = gc.backFrames;
        cfg.turnFrames = gc.turnFrames;
        cfg.smooth = gc.smooth;
        cfg.release = gc.release;
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
            "手势模型加载超时：请刷新重试，或使用键盘模式");
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
