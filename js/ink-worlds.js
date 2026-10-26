/* ============================================================
 * ink-worlds.js —— 穿画转场 · 四画选择 · 画境入口
 * 归属：组员1（穿画流程）
 * ------------------------------------------------------------
 * 职责：
 *   1. 序厅 hall0 的「云间入墨」入口按钮（只在 hall0 出现）
 *   2. 一次性穿画视频；视频缺失 / 自动播放被拒 → 墨雾占位转场
 *   3. 四画选择界面（鼠标点击 · 键盘 ←/→ + Enter · 捏合手势）
 *   4. 选择结果交给组长的画境接口 openPaintingVideo(id)
 *   5. 组长接口未就位时的本地兜底播放器（含加载失败提示）
 * ------------------------------------------------------------
 * 约束（见 docs/current/组员1任务-四画入境.md §11–§12）：
 *   - 不做 Blender / GLB / 实时 3D 画境，画境 = 组长提供的动态视频
 *   - 不新建第二套画境路由：优先调用组长接口，本地播放器只做兜底
 * ------------------------------------------------------------
 * 依赖：config.js（展厅 id）、gesture.js（捏合 / 转向）、ui.js（toast）
 * 被 main.js 调用：init / setHall / isBlocking
 * ============================================================ */

window.MuseumInkWorlds = (function () {

  /* ---------- 素材与接口约定 ----------
   * 穿画转场视频：组员1 负责整理，放到 public/videos/ink/
   * 四幅画的画境视频：组长提供，放到 public/videos/paintings/（见 §12.2）
   * 组长接口若存在则优先使用；函数名以其最终定稿为准，这里只做探测。 */
  var TRANSITION_VIDEO = "./videos/ink/enter-painting.mp4";
  var INK_FALLBACK_MS = 2600;     // 墨雾占位转场的时长
  var VIDEO_STALL_MS = 12000;     // 穿画视频卡住超过这个时间直接放行

  /* 四幅画：key 同时是组长 openPaintingVideo() 的参数
   *   status = "auto"        → 尝试播放画境视频，失败再显示占位
   *   status = "placeholder" → 第一阶段不开放，只显示「画境准备中」
   * 组长交付视频后，把对应项的 status 改成 "auto" 即可。 */
  var PAINTINGS = [
    {
      key: "qianli", title: "千里江山图", artist: "北宋 · 王希孟",
      hall: "hall1", img: "./assets/images/qianlijiangshan.jpg",
      video: "./videos/paintings/qianli-jiangshan.mp4",
      status: "auto",
    },
    {
      key: "shuzhai", title: "富春山居图", artist: "元 · 黄公望",
      hall: "hall1", img: "./assets/images/fuchunshanjv.jpg",
      video: "./videos/paintings/shuzhai.mp4",
      status: "placeholder",
    },
    {
      key: "renwu", title: "韩熙载夜宴图", artist: "五代 · 顾闳中",
      hall: "hall3", img: "./assets/images/hanxizai.jpg",
      video: "./videos/paintings/renwu.mp4",
      status: "placeholder",
    },
    {
      key: "huaniao", title: "墨兰图", artist: "宋末元初 · 郑思肖",
      hall: "hall2", img: "./assets/images/molantu.jpg",
      video: "./videos/paintings/huaniao.mp4",
      status: "placeholder",
    },
  ];

  var el = {};
  var state = {
    inited: false,
    hall: null,
    layer: null,          // null | "video" | "picker" | "world"
    pickerIndex: 0,
    transitionDone: false,
    worldKey: null,
    raf: 0,
    stallTimer: 0,
    fallbackTimer: 0,
  };

  /* ---------- 初始化 ---------- */
  function init() {
    if (state.inited) return;
    state.inited = true;
    buildDom();
    bindEvents();
    state.hall = detectHall();
    updateGate();
  }

  // 入口显示与否由当前展厅决定；main.js 会在每次切换展厅时回调 setHall。
  // 这里在启动时主动查一次，避免出生就在 hall0 时按钮要等下一次切换才出现。
  function detectHall() {
    try {
      var p = window.MuseumPlayer && MuseumPlayer.getPosition();
      if (p && window.MuseumScene && MuseumScene.getHallAt) {
        return MuseumScene.getHallAt(p.x, p.z);
      }
    } catch (err) {
      console.warn("[云间入墨] 初始化展厅判定失败：", err && err.message ? err.message : err);
    }
    return null;
  }

  /* ---------- DOM ---------- */
  function buildDom() {
    var root = document.createElement("div");
    root.id = "ink-worlds-root";
    root.innerHTML =
      '<button id="ink-gate" class="ink-gate is-hidden" type="button" ' +
        'aria-label="云间入墨：进入画中世界">' +
        '<span class="ink-gate-ring" aria-hidden="true"></span>' +
        '<span class="ink-gate-seal" aria-hidden="true">入</span>' +
        '<span class="ink-gate-label">云间入墨</span>' +
      '</button>' +

      '<div id="ink-video-layer" class="ink-layer ink-video-layer is-hidden" aria-hidden="true">' +
        '<video id="ink-transition-video" class="ink-transition-video" playsinline preload="auto"></video>' +
        '<div id="ink-fallback" class="ink-fallback is-hidden" aria-hidden="true">' +
          '<i></i><i></i><i></i><span class="ink-fallback-word">墨</span>' +
        '</div>' +
        '<p class="ink-video-caption">墨色渐开 · 请沿画中小径前行</p>' +
        '<button id="ink-skip" class="ink-skip" type="button">跳过入画</button>' +
      '</div>' +

      '<div id="ink-picker" class="ink-layer ink-picker is-hidden" role="dialog" ' +
        'aria-modal="true" aria-hidden="true" aria-label="四画入境">' +
        '<div class="ink-paper-grain" aria-hidden="true"></div>' +
        '<div class="ink-picker-head">' +
          '<p class="ink-kicker">四画入境</p>' +
          '<h2>择一幅画，走入其中</h2>' +
          '<p class="ink-hint">点击选择 · 捏合确认 · ← / → 切换 · Esc 返回</p>' +
        '</div>' +
        '<div id="ink-cards" class="ink-cards"></div>' +
        '<button id="ink-picker-back" class="ink-ghost" type="button">返回序厅</button>' +
      '</div>' +

      '<div id="ink-world" class="ink-layer ink-world is-hidden" aria-hidden="true">' +
        '<video id="ink-world-video" class="ink-world-video" playsinline preload="auto"></video>' +
        '<div id="ink-world-stub" class="ink-world-stub is-hidden" role="status">' +
          '<span class="ink-world-stub-seal" aria-hidden="true">待</span>' +
          '<h3 id="ink-world-stub-title">画境视频准备中</h3>' +
          '<p id="ink-world-stub-text">组长提供画境视频后，这里会直接播放。</p>' +
        '</div>' +
        '<div class="ink-world-bar">' +
          '<button id="ink-world-note" class="ink-world-note" type="button" hidden></button>' +
          '<div class="ink-world-actions">' +
            '<button id="ink-world-back" class="ink-action" type="button">返回四画选择</button>' +
            '<button id="ink-world-hall" class="ink-action ink-action-primary" type="button">返回序厅</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    el.root = root;
    el.gate = document.getElementById("ink-gate");
    el.videoLayer = document.getElementById("ink-video-layer");
    el.transitionVideo = document.getElementById("ink-transition-video");
    el.fallback = document.getElementById("ink-fallback");
    el.skip = document.getElementById("ink-skip");
    el.picker = document.getElementById("ink-picker");
    el.cards = document.getElementById("ink-cards");
    el.pickerBack = document.getElementById("ink-picker-back");
    el.world = document.getElementById("ink-world");
    el.worldVideo = document.getElementById("ink-world-video");
    el.worldStub = document.getElementById("ink-world-stub");
    el.stubTitle = document.getElementById("ink-world-stub-title");
    el.stubText = document.getElementById("ink-world-stub-text");
    el.worldNote = document.getElementById("ink-world-note");
    el.worldBack = document.getElementById("ink-world-back");
    el.worldHall = document.getElementById("ink-world-hall");

    renderCards();
  }

  function renderCards() {
    var html = "";
    for (var i = 0; i < PAINTINGS.length; i++) {
      var p = PAINTINGS[i];
      var placeholder = p.status === "placeholder";
      html +=
        '<button class="ink-card' + (placeholder ? " is-locked" : "") + '" type="button" ' +
          'data-index="' + i + '" data-key="' + p.key + '" ' +
          'aria-label="' + esc(p.title) + (placeholder ? "（画境准备中）" : "") + '">' +
          '<span class="ink-card-frame">' +
            '<img class="ink-card-img" src="' + p.img + '" alt="' + esc(p.title) + '" loading="lazy" />' +
            '<span class="ink-card-ink" aria-hidden="true"></span>' +
          '</span>' +
          '<span class="ink-card-meta">' +
            '<span class="ink-card-title">' + esc(p.title) + '</span>' +
            '<span class="ink-card-artist">' + esc(p.artist) + '</span>' +
          '</span>' +
          (placeholder
            ? '<span class="ink-card-badge">画境准备中</span>'
            : '<span class="ink-card-enter">入画 →</span>') +
        '</button>';
    }
    el.cards.innerHTML = html;

    // 鼠标移到卡片上时同步键盘/手势的焦点，避免「看起来高亮的是这张、点的是另一张」
    var cards = el.cards.querySelectorAll(".ink-card");
    for (var k = 0; k < cards.length; k++) {
      cards[k].addEventListener("mouseenter", function () {
        setPickerFocus(parseInt(this.getAttribute("data-index"), 10));
      });
    }
  }

  /* ---------- 事件 ---------- */
  function bindEvents() {
    el.gate.addEventListener("click", openPaintingGate);
    el.skip.addEventListener("click", finishTransition);
    el.pickerBack.addEventListener("click", returnToHall0);
    el.worldBack.addEventListener("click", returnToPaintingChooser);
    el.worldHall.addEventListener("click", returnToHall0);
    el.worldNote.addEventListener("click", returnToPaintingChooser);

    el.cards.addEventListener("click", function (e) {
      var card = e.target.closest ? e.target.closest(".ink-card") : null;
      if (!card) return;
      var idx = parseInt(card.getAttribute("data-index"), 10);
      setPickerFocus(idx);
      activatePainting(idx);
    });

    // 穿画转场视频
    el.transitionVideo.addEventListener("ended", finishTransition);
    el.transitionVideo.addEventListener("error", startInkFallback);

    // 画境视频
    el.worldVideo.addEventListener("error", onWorldVideoError);
    el.worldVideo.addEventListener("ended", onWorldVideoEnded);

    window.addEventListener("keydown", onKeyDown, true);
  }

  function onKeyDown(e) {
    if (!state.layer) return;
    // 弹层打开时吃掉键盘事件，避免 main.js 同时响应 E/R/V/T 等快捷键
    if (e.code === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (state.layer === "video") finishTransition();
      else if (state.layer === "picker") returnToHall0();
      else returnToPaintingChooser();
      return;
    }
    if (state.layer !== "picker") return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault(); e.stopPropagation();
      movePickerFocus(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault(); e.stopPropagation();
      movePickerFocus(1);
    } else if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault(); e.stopPropagation();
      activatePainting(state.pickerIndex);
    } else if (/^Digit[1-4]$/.test(e.code)) {
      e.preventDefault(); e.stopPropagation();
      activatePainting(parseInt(e.code.slice(5), 10) - 1);
    }
  }

  /* ---------- 入口按钮 ---------- */
  function setHall(hallId) {
    state.hall = hallId;
    updateGate();
  }

  function updateGate() {
    if (!el.gate) return;
    var on = state.hall === "hall0" && !state.layer && !window.MuseumInteriorOnly;
    el.gate.classList.toggle("is-hidden", !on);
  }

  /* ---------- 1. 点击「云间入墨」→ 穿画视频 ---------- */
  function openPaintingGate() {
    if (state.layer) return;
    if (document.exitPointerLock) document.exitPointerLock();

    state.layer = "video";
    state.transitionDone = false;
    state.pickerIndex = 0;      // 每次从序厅重新入画，焦点回到第一幅
    updateGate();

    el.fallback.classList.add("is-hidden");
    el.transitionVideo.classList.remove("is-hidden");
    el.skip.classList.remove("is-hidden");
    show(el.videoLayer);

    var v = el.transitionVideo;
    try {
      v.pause();
      v.currentTime = 0;
    } catch (err) { /* 还没载入过，忽略 */ }
    v.src = TRANSITION_VIDEO;

    var played = v.play();
    if (played && played.catch) {
      played.catch(function (err) {
        // 最常见：素材还没放进来（NotSupportedError）或浏览器拒绝自动播放
        console.warn("[云间入墨] 穿画视频无法播放，改用墨雾占位：", err && err.name);
        startInkFallback();
      });
    }

    // 视频卡在 0 秒（网络慢 / 解码卡住）时也让流程继续，避免用户被困在全屏层
    clearTimeout(state.stallTimer);
    state.stallTimer = setTimeout(function () {
      if (state.layer === "video" && !state.transitionDone) {
        console.warn("[云间入墨] 穿画视频超时，直接进入四画选择");
        finishTransition();
      }
    }, VIDEO_STALL_MS);

    MuseumUI.toast("云间入墨 · 正在穿入画中");
  }

  function startInkFallback() {
    if (state.transitionDone || state.layer !== "video") return;
    try { el.transitionVideo.pause(); } catch (err) { /* noop */ }
    el.transitionVideo.classList.add("is-hidden");
    el.fallback.classList.remove("is-hidden");
    clearTimeout(state.fallbackTimer);
    state.fallbackTimer = setTimeout(finishTransition, INK_FALLBACK_MS);
  }

  function finishTransition() {
    if (state.transitionDone || state.layer !== "video") return;
    state.transitionDone = true;
    clearTimeout(state.stallTimer);
    clearTimeout(state.fallbackTimer);
    try { el.transitionVideo.pause(); } catch (err) { /* noop */ }
    hide(el.videoLayer);
    el.videoLayer.setAttribute("aria-hidden", "true");
    showPaintingPicker();
  }

  /* ---------- 2. 四画选择 ---------- */
  function showPaintingPicker() {
    state.layer = "picker";
    show(el.picker);
    el.picker.setAttribute("aria-hidden", "false");
    setPickerFocus(state.pickerIndex);
    startGestureWatcher();
    updateGate();
  }

  function hidePicker() {
    hide(el.picker);
    el.picker.setAttribute("aria-hidden", "true");
    stopGestureWatcher();
  }

  function setPickerFocus(index) {
    var cards = el.cards.querySelectorAll(".ink-card");
    if (!cards.length) return;
    var n = cards.length;
    state.pickerIndex = ((index % n) + n) % n;
    for (var i = 0; i < n; i++) {
      cards[i].classList.toggle("is-focus", i === state.pickerIndex);
    }
  }

  function movePickerFocus(delta) {
    setPickerFocus(state.pickerIndex + delta);
  }

  function activateFocused() {
    activatePainting(state.pickerIndex);
  }

  function activatePainting(index) {
    var p = PAINTINGS[index];
    if (!p) return;
    hidePicker();

    if (p.status === "placeholder") {
      showWorldStub(p, "画境准备中", "《" + p.title + "》的画境视频尚未接入。第一阶段先开放《千里江山图》，其余三幅保留选择卡。");
      return;
    }

    // ① 优先交给组长的画境接口（§12.2）
    var leader = window.MuseumPaintingWorlds || window.MuseumInkWorldApi;
    if (leader && typeof leader.openPaintingVideo === "function") {
      try {
        leader.openPaintingVideo(p.key);
        // 组长自己会接管画面；这里只保持「阻塞漫游」状态，
        // 等他的返回按钮回调 returnToPaintingChooser / returnToHall0 再解锁。
        state.layer = "world";
        state.worldKey = p.key;
        updateGate();
        return;
      } catch (err) {
        console.warn("[云间入墨] 组长画境接口调用失败，改用本地播放器：", err && err.message ? err.message : err);
      }
    }

    // ② 兜底：本地播放器
    openLocalWorld(p);
  }

  /* ---------- 3. 画境视频（本地兜底播放器） ---------- */
  function openLocalWorld(p) {
    state.layer = "world";
    state.worldKey = p.key;
    show(el.world);
    el.world.setAttribute("aria-hidden", "false");
    el.worldStub.classList.add("is-hidden");
    el.worldVideo.classList.remove("is-hidden");
    el.worldNote.hidden = true;

    var v = el.worldVideo;
    try {
      v.pause();
      v.currentTime = 0;
    } catch (err) { /* noop */ }
    v.src = p.video;
    var played = v.play();
    if (played && played.catch) {
      played.catch(function (err) {
        console.warn("[云间入墨] 画境视频无法播放：", err && err.name);
        showWorldStub(p, "画境视频准备中", "资源暂未就位（" + p.video + "），可先返回四画选择。");
      });
    }
    MuseumUI.toast("已入画 · " + p.title);
  }

  function onWorldVideoError() {
    var p = findPainting(state.worldKey);
    if (!p) return;
    showWorldStub(p, "画境视频准备中", "资源加载失败（" + p.video + "），可先返回四画选择。");
  }

  function onWorldVideoEnded() {
    el.worldNote.hidden = false;
    el.worldNote.textContent = "画境已尽 · 返回四画选择 →";
  }

  function showWorldStub(p, title, text) {
    state.layer = "world";
    state.worldKey = p.key;
    show(el.world);
    el.world.setAttribute("aria-hidden", "false");
    try { el.worldVideo.pause(); } catch (err) { /* noop */ }
    el.worldVideo.classList.add("is-hidden");
    el.worldStub.classList.remove("is-hidden");
    el.stubTitle.textContent = "《" + p.title + "》" + title;
    el.stubText.textContent = text;
    el.worldNote.hidden = true;
    stopGestureWatcher();
    updateGate();
  }

  /* ---------- 4. 返回 ---------- */
  function returnToPaintingChooser() {
    if (state.layer !== "world") return;
    try { el.worldVideo.pause(); } catch (err) { /* noop */ }
    hide(el.world);
    el.world.setAttribute("aria-hidden", "true");
    showPaintingPicker();
  }

  function returnToHall0() {
    if (!state.layer) return;
    try { el.transitionVideo.pause(); } catch (err) { /* noop */ }
    try { el.worldVideo.pause(); } catch (err) { /* noop */ }
    clearTimeout(state.stallTimer);
    clearTimeout(state.fallbackTimer);
    hide(el.videoLayer);
    hide(el.world);
    hidePicker();
    el.videoLayer.setAttribute("aria-hidden", "true");
    el.world.setAttribute("aria-hidden", "true");
    state.layer = null;
    state.transitionDone = false;
    updateGate();
    if (window.MuseumUI) MuseumUI.toast("已返回序厅");
  }

  /* ---------- 手势：捏合确认 / 左右转向切换 ---------- */
  function startGestureWatcher() {
    if (state.raf) return;
    var lastTurnAt = 0;
    var lastPinchAt = 0;

    function tick(ts) {
      if (state.layer !== "picker") { state.raf = 0; return; }
      state.raf = requestAnimationFrame(tick);

      var gs = (window.MuseumGesture && MuseumGesture.getState) ? MuseumGesture.getState() : null;
      if (!gs) return;
      if (Math.abs(gs.turn || 0) > 0.85 && ts - lastTurnAt > 650) {
        lastTurnAt = ts;
        movePickerFocus(gs.turn > 0 ? 1 : -1);
      }
      if (gs.pinchPressed && ts - lastPinchAt > 700) {
        lastPinchAt = ts;
        activateFocused();
      }
    }
    state.raf = requestAnimationFrame(tick);
  }

  function stopGestureWatcher() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  /* ---------- 工具 ---------- */
  function findPainting(key) {
    for (var i = 0; i < PAINTINGS.length; i++) {
      if (PAINTINGS[i].key === key) return PAINTINGS[i];
    }
    return null;
  }

  function show(node) { node.classList.remove("is-hidden"); }

  // 隐藏前把焦点交还 body：焦点留在 aria-hidden 的祖先里，浏览器会报警并让读屏器读不到内容
  function hide(node) {
    if (node.contains(document.activeElement) && document.activeElement.blur) {
      document.activeElement.blur();
    }
    node.classList.add("is-hidden");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 对外 API ---------- */
  return {
    init: init,
    setHall: setHall,
    isBlocking: function () { return !!state.layer; },
    openPaintingGate: openPaintingGate,
    showPaintingPicker: showPaintingPicker,
    selectPainting: function (id) {
      for (var i = 0; i < PAINTINGS.length; i++) {
        if (PAINTINGS[i].key === id || PAINTINGS[i].title === id) {
          activatePainting(i);
          return true;
        }
      }
      return false;
    },
    returnToPaintingChooser: returnToPaintingChooser,
    returnToHall0: returnToHall0,
    getState: function () { return state; },
    getPaintings: function () { return PAINTINGS.slice(); },
  };
})();
