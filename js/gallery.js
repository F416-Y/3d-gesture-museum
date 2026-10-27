/* ============================================================
 * 廊道画廊 · 真画上墙
 * ------------------------------------------------------------
 * 中轴双廊、东长廊与书斋/茶室/文创/临摹背墙均通过 seed 接入这里。
 * 有同名图片时显示真实素材；图片尚未入库时显示题名占位卷轴，
 * 素材文件放入 assets/images/<id>.jpg 后会自动替换。
 * ============================================================ */
window.MuseumGallery = (function () {
  var MAP = {
    350: "hanxizai",
    357: "qianlijiangshan",
    364: "fuchunshanjv",
    371: "xishanxinglvtu",
    450: "buniantu",
    457: "xieshengzhenqintu",
    464: "wuniutu",
    471: "molantu",
    601: "lantingjixu",
    602: "jizhiwengao",
    603: "hanshitie",
    604: "tingqintu",
    605: "huishanchahui",
    606: "shimingtu",
    607: "pinchatu",
    608: "luyupengchatu",
    640: "luoshenfu"
  };
  var cache = {};
  var loader = null;

  function exhibitTitle(id) {
    var list = (window.MuseumConfig && window.MuseumConfig.exhibits) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].title || id;
    }
    return id;
  }

  function placeholder(id) {
    if (typeof document === "undefined" || typeof THREE === "undefined" || !THREE.CanvasTexture) return null;
    var cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 512;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#efe7d6";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#8d4b3f";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, cv.width - 24, cv.height - 24);
    ctx.fillStyle = "#2f2924";
    ctx.font = "28px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var chars = exhibitTitle(id).split("");
    var startY = 98;
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cv.width / 2, startY + i * 42);
    }
    ctx.fillStyle = "#7b6e62";
    ctx.font = "16px serif";
    ctx.fillText("素材待入库", cv.width / 2, cv.height - 52);
    var t = new THREE.CanvasTexture(cv);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  function texById(id) {
    if (!id) return null;
    if (cache[id]) return cache[id];
    if (!loader && typeof THREE !== "undefined" && THREE.TextureLoader) loader = new THREE.TextureLoader();

    var fallback = placeholder(id);
    if (!fallback && !loader) return null;
    if (!fallback) {
      var loaded = loader.load("assets/images/" + id + ".jpg");
      if (THREE.sRGBEncoding) loaded.encoding = THREE.sRGBEncoding;
      loaded.anisotropy = 4;
      cache[id] = loaded;
      return loaded;
    }

    cache[id] = fallback;
    if (loader) {
      loader.load("assets/images/" + id + ".jpg", function (imageTexture) {
        fallback.image = imageTexture.image;
        if (THREE.sRGBEncoding) fallback.encoding = THREE.sRGBEncoding;
        fallback.anisotropy = 4;
        fallback.needsUpdate = true;
      }, undefined, function () {
        /* 素材尚未入库：保留题名占位卷轴，不产生空白画心。 */
      });
    }
    return fallback;
  }

  function tex(seed) {
    return texById(MAP[seed]);
  }

  return {
    tex: tex,
    texById: texById,
    map: MAP,
    list: function () {
      var out = [];
      for (var s in MAP) out.push({ seed: +s, id: MAP[s], url: "assets/images/" + MAP[s] + ".jpg" });
      return out;
    }
  };
})();
