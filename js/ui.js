/* ============================================================
 * ui.js —— 界面视觉与面板交互
 * 归属：组员5（UI 与视觉设计师）
 * ------------------------------------------------------------
 * 职责：
 *   1. 加载层、标题栏、操作说明、工具栏、摄像头预览窗
 *   2. 展品鉴赏弹窗渲染（新中式卡片）
 *   3. 提示条（toast）、展厅名更新
 *   4. 按钮回调注册（main.js 注入逻辑）
 * ------------------------------------------------------------
 * 依赖：config.js（展品数据）
 * ============================================================ */

window.MuseumUI = (function () {

  var el = {};
  var handlers = {
    onCameraToggle: null,
    onReset: null,
    onHelp: null,
    onClosePanel: null,
  };

  /* ---------- 初始化 DOM 引用 ---------- */
  function init() {
    el.loading = document.getElementById("loading");
    el.loadingText = document.getElementById("loading-text");
    el.stage = document.getElementById("stage");
    el.topbar = document.getElementById("topbar");
    el.hallLabel = document.getElementById("hall-label");
    el.help = document.getElementById("help");
    el.toolbar = document.getElementById("toolbar");
    el.btnCamera = document.getElementById("btn-camera");
    el.btnReset = document.getElementById("btn-reset");
    el.btnHelp = document.getElementById("btn-help");
    el.camwrap = document.getElementById("camwrap");
    el.cam = document.getElementById("cam");
    el.panel = document.getElementById("panel");
    el.panelBody = document.getElementById("panel-body");
    el.panelClose = document.getElementById("panel-close");
    el.toast = document.getElementById("toast");

    // 按钮事件
    if (el.btnCamera) {
      el.btnCamera.addEventListener("click", function () {
        if (handlers.onCameraToggle) handlers.onCameraToggle();
      });
    }
    if (el.btnReset) {
      el.btnReset.addEventListener("click", function () {
        if (handlers.onReset) handlers.onReset();
      });
    }
    if (el.btnHelp) {
      el.btnHelp.addEventListener("click", function () {
        toggleHelp();
      });
    }
    if (el.panelClose) {
      el.panelClose.addEventListener("click", function () {
        hidePanel();
        if (handlers.onClosePanel) handlers.onClosePanel();
      });
    }
    // 点击弹窗背景关闭
    if (el.panel) {
      el.panel.addEventListener("click", function (e) {
        if (e.target === el.panel) {
          hidePanel();
          if (handlers.onClosePanel) handlers.onClosePanel();
        }
      });
    }
  }

  /* ---------- 加载层 ---------- */
  function setLoading(text) {
    if (el.loadingText) el.loadingText.textContent = text || "正在布置展厅……";
  }
  function hideLoading() {
    if (el.loading) el.loading.classList.add("hidden");
    if (el.topbar) el.topbar.classList.remove("hidden");
    if (el.toolbar) el.toolbar.classList.remove("hidden");
    if (el.help) el.help.classList.remove("hidden");
  }

  /* ---------- 操作说明 ---------- */
  function toggleHelp() {
    if (!el.help) return;
    var hidden = el.help.classList.toggle("hidden");
    if (el.btnHelp) el.btnHelp.textContent = hidden ? "操作说明" : "收起说明";
  }

  /* ---------- 摄像头按钮状态 ---------- */
  function setCameraButton(on) {
    if (!el.btnCamera) return;
    el.btnCamera.textContent = on ? "摄像头：开" : "摄像头：关";
    el.btnCamera.classList.toggle("on", !!on);
  }
  function showCam(on) {
    if (el.camwrap) el.camwrap.classList.toggle("hidden", !on);
  }

  /* ---------- 展厅名 ---------- */
  function setHall(hallId) {
    if (!el.hallLabel) return;
    var halls = window.MuseumConfig.halls;
    for (var i = 0; i < halls.length; i++) {
      if (halls[i].id === hallId) {
        el.hallLabel.textContent = halls[i].name;
        return;
      }
    }
    el.hallLabel.textContent = "园区";
  }

  /* ---------- 提示条 ---------- */
  var toastTimer = null;
  function toast(msg, ms) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove("show");
    }, ms || 2200);
  }

  /* ---------- 鉴赏弹窗 ---------- */
  function showExhibit(ex) {
    if (!el.panel || !el.panelBody) return;
    el.panelBody.innerHTML =
      '<h2>' + esc(ex.title) + '</h2>' +
      '<div class="p-meta">' +
        metaItem("作者", ex.artist) +
        metaItem("年代", ex.dynasty + (ex.era ? " · " + ex.era : "")) +
        metaItem("形制", ex.medium) +
        metaItem("馆藏", ex.collection) +
      '</div>' +
      '<p class="p-desc">' + esc(ex.intro) + '</p>' +
      '<div class="p-appr"><h4>艺术赏析</h4><p>' + esc(ex.appreciation) + '</p></div>';
    el.panel.classList.add("open");
    el.panel.setAttribute("aria-hidden", "false");
  }

  function metaItem(label, value) {
    return '<span><b>' + esc(label) + '</b>' + esc(value || "佚名") + '</span>';
  }

  function hidePanel() {
    if (!el.panel) return;
    el.panel.classList.remove("open");
    el.panel.setAttribute("aria-hidden", "true");
  }

  function isPanelOpen() {
    return !!(el.panel && el.panel.classList.contains("open"));
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 对外 API ---------- */
  return {
    init: init,
    setLoading: setLoading,
    hideLoading: hideLoading,
    toggleHelp: toggleHelp,
    setCameraButton: setCameraButton,
    showCam: showCam,
    setHall: setHall,
    toast: toast,
    showExhibit: showExhibit,
    hidePanel: hidePanel,
    isPanelOpen: isPanelOpen,
    setHandlers: function (h) {
      for (var k in h) if (h.hasOwnProperty(k)) handlers[k] = h[k];
    },
    getVideo: function () { return el.cam; },
    getStage: function () { return el.stage; },
  };
})();
