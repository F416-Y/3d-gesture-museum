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
    350: "hanxizai",           // 西廊 1（z 11.6）· 韩熙载夜宴图
    357: "qianlijiangshan",    // 西廊 2（z 14.2）· 千里江山图
    364: "fuchunshanjv",       // 西廊 3（z 16.8）· 富春山居图
    371: "xishanxinglvtu",     // 西廊 4（z 19.4）· 溪山行旅图
    450: "buniantu",           // 东廊 1 · 步辇图
    457: "xieshengzhenqintu",  // 东廊 2 · 写生珍禽图
    464: "wuniutu",            // 东廊 3 · 五牛图
    471: "molantu",            // 东廊 4 · 墨兰图
    640: "luoshenfu"           // 东长廊第 1 开间 · 洛神赋图
    /* 2026-09-29：双廊画廊墙由 5 开间改 4 开间（z 11.6/14.2/16.8/19.4），原 378 位取消，
       洛神赋图移到东长廊（galleryWallX）第 1 开间；
       651/662/673/684/695 东长廊其余 5 间、999 临水半亭大立轴 —— 暂时留空（等更多真画入库） */
    /* 601~608 书斋/茶室/文创/临摹 背墙立轴（组长已挂好画位，暂用程序化立轴贴图）：
       组员6 出图后，把下面两行注释放开即可换真图 */
    /* 601: "lantingjixu",   602: "jizhiwengao",  603: "hanshitie",    604: "tingqintu",
       605: "huishanchahui", 606: "shimingtu",    607: "pinchatu",     608: "luyupengchatu" */
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