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
  var social = { favorited: false, favLoading: false, comments: [] };
  var currentExhibit = null;
  var handlers = {
    onCameraToggle: null,
    onReset: null,
    onHelp: null,
    onClosePanel: null,
  };

  /* ---------- 初始化 DOM 引用 ---------- */
  function init() {
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
    document.addEventListener("keydown", function (e) {
      if (!isPanelOpen() || !currentExhibit || currentExhibit.type !== "painting") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); movePainting(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); movePainting(1); }
    });
  }

  /* ---------- 加载层 ---------- */
  function hideLoading() {
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

  /* ---------- 鉴赏弹窗（含收藏 + 评论区） ---------- */
  function showExhibit(ex) {
    if (!el.panel || !el.panelBody) return;
    currentExhibit = ex;
    social.favorited = false;
    social.favLoading = false;
    social.comments = [];

    var artVisual = ex.image
      ? '<img class="p-art-img" src="' + ex.image + '" alt="' + esc(ex.title) + ' 画作" />'
      : '<div class="p-art-ph"><span>' + esc(ex.title) + '</span></div>';
    var artCol = '<div class="p-art">' + artVisual + paintingNav(ex) + '</div>';
    el.panelBody.innerHTML =
      '<div class="panel-card">' +
        '<h2>' + esc(ex.title) + '</h2>' +
        '<div class="p-body">' +
          artCol +
          '<div class="p-info">' +
            '<div class="p-meta">' +
              metaItem("作者", ex.artist) +
              metaItem("年代", ex.dynasty + (ex.era ? " · " + ex.era : "")) +
              metaItem("形制", ex.medium) +
              metaItem("馆藏", ex.collection) +
            '</div>' +
            '<p class="p-desc">' + esc(ex.intro) + '</p>' +
            '<div class="p-appr"><h4>艺术赏析</h4><p>' + esc(ex.appreciation) + '</p></div>' +
            renderSocial() +
          '</div>' +
        '</div>' +
      '</div>';

    el.panel.classList.add("open");
    el.panel.setAttribute("aria-hidden", "false");

    var favBtn = document.getElementById("p-fav-btn");
    if (favBtn) favBtn.addEventListener("click", function () { toggleFav(ex); });
    var cmtSend = document.getElementById("p-cmt-send");
    var cmtInput = document.getElementById("p-cmt-input");
    if (cmtSend) cmtSend.addEventListener("click", function () { sendComment(ex, cmtInput); });
    if (cmtInput) cmtInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && cmtInput.value.trim()) sendComment(ex, cmtInput);
    });

    bindPaintingNavigation(ex);

    refreshSocial(ex);
  }

  function paintingNeighbors(ex) {
    var list = (window.MuseumConfig && window.MuseumConfig.exhibits) || [];
    var paintings = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === "painting" && list[i].hall === ex.hall) paintings.push(list[i]);
    }
    return paintings;
  }

  function paintingNav(ex) {
    var paintings = paintingNeighbors(ex);
    if (paintings.length < 2) return "";
    var index = 0;
    for (var i = 0; i < paintings.length; i++) {
      if (paintings[i].id === ex.id) { index = i; break; }
    }
    return '<div class="p-art-nav" aria-label="画作左右切换">' +
      '<button type="button" class="p-art-prev" aria-label="上一幅画">‹</button>' +
      '<span class="p-art-count">' + (index + 1) + ' / ' + paintings.length + '</span>' +
      '<button type="button" class="p-art-next" aria-label="下一幅画">›</button>' +
      '</div>';
  }

  function bindPaintingNavigation(ex) {
    if (ex.type !== "painting") return;
    var prev = document.querySelector(".p-art-prev");
    var next = document.querySelector(".p-art-next");
    if (prev) prev.addEventListener("click", function () { movePainting(-1); });
    if (next) next.addEventListener("click", function () { movePainting(1); });

    var art = document.querySelector(".p-art");
    if (!art) return;
    var startX = null;
    art.addEventListener("touchstart", function (e) {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });
    art.addEventListener("touchend", function (e) {
      if (startX == null) return;
      var delta = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(delta) > 42) movePainting(delta < 0 ? 1 : -1);
    }, { passive: true });
  }

  function movePainting(direction) {
    if (!currentExhibit || currentExhibit.type !== "painting") return;
    var paintings = paintingNeighbors(currentExhibit);
    if (paintings.length < 2) return;
    var index = 0;
    for (var i = 0; i < paintings.length; i++) {
      if (paintings[i].id === currentExhibit.id) { index = i; break; }
    }
    var nextIndex = (index + direction + paintings.length) % paintings.length;
    showExhibit(paintings[nextIndex]);
  }

  /* 收藏 + 评论区模板（区分登录 / 未登录） */
  function renderSocial() {
    var bridge = window.CloudInkBridge;
    var loggedIn = !!(bridge && bridge.isLoggedIn());
    var formBlock = loggedIn
      ? '<div class="p-cmt-form">' +
        '<input id="p-cmt-input" class="p-cmt-input" type="text" maxlength="120" placeholder="写下你的观展感受……" />' +
        '<button id="p-cmt-send" class="p-cmt-send" type="button">发送</button>' +
        '</div>'
      : '<p class="p-cmt-login"><a href="#/login">登录</a> 后留言</p>';
    return (
      '<div class="p-social">' +
        '<div class="p-fav-row">' +
          '<button id="p-fav-btn" type="button" class="p-fav-btn">☆ 收藏</button>' +
        '</div>' +
        '<div class="p-comments">' +
          '<h4 class="p-cmt-title">观众留言 <span id="p-cmt-count">0</span></h4>' +
          '<div id="p-cmt-list" class="p-cmt-list"><p class="p-cmt-empty">还没有留言，来写第一句吧。</p></div>' +
          formBlock +
        '</div>' +
      '</div>'
    );
  }

  /* 拉取收藏状态 + 评论 */
  function refreshSocial(ex) {
    var bridge = window.CloudInkBridge;
    if (!bridge || !bridge.ready) return;
    if (bridge.isLoggedIn()) {
      bridge.isFavorited(ex.id).then(function (on) {
        social.favorited = !!on;
        paintFavBtn(on);
      }).catch(function () {});
    }
    bridge.listComments(ex.id).then(function (list) {
      social.comments = list || [];
      paintComments();
    }).catch(function () {
      social.comments = [];
      paintComments();
    });
  }

  function paintFavBtn(on) {
    var btn = document.getElementById("p-fav-btn");
    if (!btn) return;
    btn.classList.toggle("on", !!on);
    btn.innerHTML = on ? "★ 已收藏" : "☆ 收藏";
  }

  function toggleFav(ex) {
    var bridge = window.CloudInkBridge;
    if (!bridge || !bridge.isLoggedIn()) { bridge.toast("请先登录后收藏"); return; }
    if (social.favLoading) return;
    social.favLoading = true;
    var action = social.favorited ? bridge.removeFavorite(ex.id) : bridge.addFavorite(ex.id);
    action.then(function () {
      social.favorited = !social.favorited;
      paintFavBtn(social.favorited);
      bridge.toast(social.favorited ? "已收藏 · 可在「我的收藏」查看" : "已取消收藏");
    }).catch(function (e) {
      bridge.toast("收藏操作失败：" + (e && e.message ? e.message : "未知错误"));
    }).finally(function () {
      social.favLoading = false;
    });
  }

  function sendComment(ex, input) {
    var bridge = window.CloudInkBridge;
    var text = (input && input.value || "").trim();
    if (!text) return;
    if (!bridge || !bridge.isLoggedIn()) { bridge.toast("请先登录后留言"); return; }
    input.value = "";
    bridge.addComment(ex.id, text).then(function () {
      return bridge.listComments(ex.id);
    }).then(function (list) {
      social.comments = list || [];
      paintComments();
      bridge.toast("留言已发布");
    }).catch(function (e) {
      bridge.toast("留言失败：" + (e && e.message ? e.message : "未知错误"));
    });
  }

  function paintComments() {
    var list = document.getElementById("p-cmt-list");
    var count = document.getElementById("p-cmt-count");
    var items = social.comments || [];
    if (count) count.textContent = String(items.length);
    if (!list) return;
    if (items.length === 0) {
      list.innerHTML = '<p class="p-cmt-empty">还没有留言，来写第一句吧。</p>';
      return;
    }
    var html = '<ul class="p-cmt-rows">';
    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      var time = c.createdAt ? new Date(c.createdAt).toLocaleDateString("zh-CN") : "";
      html +=
        '<li>' +
          '<span class="p-cmt-who">' + esc(c.nickname || "匿名") + '</span>' +
          '<span class="p-cmt-time">' + esc(time) + '</span>' +
          '<p class="p-cmt-body">' + esc(c.content) + '</p>' +
        '</li>';
    }
    html += '</ul>';
    list.innerHTML = html;
  }

  function metaItem(label, value) {
    return '<span><b>' + esc(label) + '</b>' + esc(value || "佚名") + '</span>';
  }

  function hidePanel() {
    if (!el.panel) return;
    el.panel.classList.remove("open");
    el.panel.setAttribute("aria-hidden", "true");
    currentExhibit = null;
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
