/* ============================================================
 * 廊道画廊 · 真画上墙
 * ------------------------------------------------------------
 * 观澜亭旁两条中轴游廊的外侧半壁墙就是展画廊（原型做的），
 * 原型每开间挂一幅程序化立轴；这里按 seed 把真画顶上去。
 *
 * seed 来源（原型的 galleryWall / halfPavilion，勿改）：
 *   西廊 galleryWall(-8.1, 1)   -> seed 350/357/364/371/378（z 10.93→22.37，面朝东）
 *   东廊 galleryWall( 8.1, -1)  -> seed 450/457/464/471/478（z 10.93→22.37，面朝西）
 *   观澜亭背壁大立轴            -> seed 999（放大 1.15 倍）
 * 留空的开间不在表里，会自动保留原型的程序化立轴。
 * ============================================================ */
window.MuseumGallery = (function () {
  /* seed -> 画作 id（文件在 assets/images/<id>.jpg，组员6 PR #7 入库的真画） */
  var MAP = {
    350: "hanxizai",           // 西廊北端 · 韩熙载夜宴图
    357: "qianlijiangshan",    // 西廊中 1 · 千里江山图
    364: "fuchunshanjv",       // 西廊中 2 · 富春山居图
    371: "xishanxinglvtu",     // 西廊中 3 · 溪山行旅图
    378: "luoshenfu",          // 西廊南端 · 洛神赋图
    450: "buniantu",           // 东廊北端 · 步辇图
    457: "xieshengzhenqintu",  // 东廊中 1 · 写生珍禽图
    464: "wuniutu",            // 东廊中 2 · 五牛图
    471: "molantu"             // 东廊中 3 · 墨兰图
    /* 478 东廊南端 留空；999 观澜亭大立轴 留空 */
  };
  var cache = {};
  var loader = null;

  function tex(seed) {
    var id = MAP[seed];
    if (!id) return null;
    if (!cache[id]) {
      if (!loader && typeof THREE !== "undefined" && THREE.TextureLoader) loader = new THREE.TextureLoader();
      if (!loader) return null;
      var t = loader.load("assets/images/" + id + ".jpg");
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      cache[id] = t;
    }
    return cache[id];
  }

  return {
    tex: tex,
    map: MAP,
    /* 调试用：看看每幅画挂在哪 */
    list: function () {
      var out = [];
      for (var s in MAP) out.push({ seed: +s, id: MAP[s], url: "assets/images/" + MAP[s] + ".jpg" });
      return out;
    }
  };
})();