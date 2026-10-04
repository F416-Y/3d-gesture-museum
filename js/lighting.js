/* ============================================================
 * lighting.js —— 昼夜氛围：白昼（江南水调）⇄ 入夜（灯火阑珊）
 * ------------------------------------------------------------
 * 来源：外观原型 tools/exterior-prototype.html 的 applyNight() / lampLights
 *       （原作者 Kimi）。2026-10-04 由组长接进主项目，数值与原型一一对应。
 * 用法：
 *   MuseumLighting.init(renderer, scene, MuseumExteriorLayout);  // 建灯 + 记基准
 *   MuseumLighting.update(dt);                                   // 每帧调用（平滑插值 ~2s 收敛）
 *   MuseumLighting.toggle() / setNight(0|1)                      // 切昼夜（HUD 按钮 / N 键）
 * 说明：本文件是"原型的夜景参数表 + 插值"的移植版；Kimi 在原型里改了灯位或
 *       颜色，需要同步改这里下面两张表（D = 白昼、N = 入夜）与 LAMPS 数组。
 * ============================================================ */
window.MuseumLighting = (function () {
  /* 白昼 / 入夜 参数表（对应原型 applyNight 里的 lerp 端点） */
  var D = { bg: 0xdfe9ec, fogNear: 85,  fogFar: 280, exposure: 1.30,
            sun: 0xfff2e0, sunI: 1.45, hemiSky: 0xe4eef6, hemiGround: 0x8a9578, hemiI: 0.85,
            hallI: 1.10, lampRed: 0.50, lampPaper: 0.55, lampGlow: 1.15,
            water: 0x527a6e, waterSpec: 0xd8ecf2 };
  var N = { bg: 0x15212f, fogNear: 55,  fogFar: 220, exposure: 1.08,
            sun: 0xa9c1e4, sunI: 0.32, hemiSky: 0x33465e, hemiGround: 0x1f2620, hemiI: 0.38,
            hallI: 1.80, lampRed: 2.00, lampPaper: 1.80, lampGlow: 2.00,
            water: 0x24403c, waterSpec: 0xffd9a8 };

  /* 灯笼点光群：位置对齐红灯笼 / 石灯（[x, y, z, 强度]，抄自原型） */
  var LAMPS = [
    [0, 3.0, 35.6, 1.5],    /* 序厅大门檐口一对 */
    [0, 2.8, 21.4, 1.0],    /* 中轴影壁（南侧洗亮壁心） */
    [0, 3.1, 6.7, 1.2],     /* 水榭庭院 · 南门楼 */
    [0, 3.1, -5.3, 1.2],    /* 水榭庭院 · 北门楼（对景中心庭） */
    [3.6, 2.3, 0.6, 1.2],   /* 水榭平台（临水，倒影主光源） */
    [5.7, 2.5, 4.2, 1.0],   /* 临水半亭 */
    [-2.2, 1.3, 5.8, 0.7],  /* 水榭庭院 · 石灯两座之间 */
    [21, 3.3, 16.7, 1.2],   /* 荷池庭院 · 南岸门楼 */
    [21, 1.3, 15.4, 0.8],   /* 荷池庭院 · 石灯一对 */
    [17.5, 1.5, 8.0, 0.6]   /* 荷池西北岸山石组（剪影补光） */
  ];

  /* 序厅（buildXuting）不走 buildHall，因此 slots 的室内布展没给它灯 —— 从大门看进去是一条黑缝。
     这里补两盏（位置：台基 1.2m 之上 3m，门内两侧），并纳入"馆内暖光"随昼夜一起加强。 */
  var HALL_FILL = [[-4.0, 4.2, 31.6], [4.0, 4.2, 31.6]];
  var scanT = 0;

  var renderer = null, scene = null, layout = null, sun = null, hemi = null;
  var lampLights = [], hallLights = [], btn = null;
  var goal = 0, cur = -1, ready = false;

  /* 收集室内暖光：slots.js 的 furnishHall 要等 7 个 GLB 加载完才建灯，
     所以除了 init 时收一次，update 里还会定期补收（newLights）。 */
  function collectHallLights() {
    if (!scene) return;
    scene.traverse(function (n) {
      if (!n.isPointLight) return;
      if (n.userData && n.userData.lamp) return;      /* 灯笼灯不算 */
      for (var i = 0; i < hallLights.length; i++) if (hallLights[i] === n) return;
      hallLights.push(n);
    });
  }

  function lerpC(target, dayHex, nightHex, k) {
    target.setHex(dayHex).convertSRGBToLinear()
      .lerp(new THREE.Color(nightHex).convertSRGBToLinear(), k);
  }
  function lerpN(a, b, k) { return a + (b - a) * k; }

  /* 应用某一刻的昼夜状态（k：0 白昼 → 1 入夜），逻辑与原型 applyNight 一致 */
  function apply(k) {
    var NM = layout && layout.mats, NC = layout && layout.ctx;
    if (scene.background && scene.background.setHex) lerpC(scene.background, D.bg, N.bg, k);
    if (scene.fog && scene.fog.color) {
      lerpC(scene.fog.color, D.bg, N.bg, k);
      scene.fog.near = lerpN(D.fogNear, N.fogNear, k);
      scene.fog.far = lerpN(D.fogFar, N.fogFar, k);
    }
    if (renderer) renderer.toneMappingExposure = lerpN(D.exposure, N.exposure, k);
    if (sun) { lerpC(sun.color, D.sun, N.sun, k); sun.intensity = lerpN(D.sunI, N.sunI, k); }
    if (hemi) {
      lerpC(hemi.color, D.hemiSky, N.hemiSky, k);
      lerpC(hemi.groundColor, D.hemiGround, N.hemiGround, k);
      hemi.intensity = lerpN(D.hemiI, N.hemiI, k);
    }
    /* 灯纸 / 展画灯带发光 */
    if (NM) {
      if (NM.lampRed) NM.lampRed.emissiveIntensity = lerpN(D.lampRed, N.lampRed, k);
      if (NM.lampPaper) NM.lampPaper.emissiveIntensity = lerpN(D.lampPaper, N.lampPaper, k);
      if (NM.water && NM.water.color) lerpC(NM.water.color, D.water, N.water, k);
      if (NM.water && NM.water.specular) lerpC(NM.water.specular, D.waterSpec, N.waterSpec, k);
    }
    if (NC && NC.lampGlow) NC.lampGlow.emissiveIntensity = lerpN(D.lampGlow, N.lampGlow, k);
    /* 展厅内透 + 灯笼点光 */
    var i;
    for (i = 0; i < hallLights.length; i++) hallLights[i].intensity = lerpN(D.hallI, N.hallI, k);
    for (i = 0; i < lampLights.length; i++) lampLights[i].intensity = lampLights[i].userData.full * k;
    syncBtn();
  }

  function syncBtn() {
    if (!btn) return;
    var on = goal > 0.5;
    btn.textContent = on ? "白昼 · 天光" : "入夜 · 灯火";
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function init(r, s, l) {
    renderer = r || null; scene = s || null; layout = l || null; ready = false;
    if (!scene) return false;
    /* 日光 / 半球光：主项目的 addLights 已经建好，这里按类型找出来 */
    /* 一次 traverse 收齐：日光、半球光、以及"已有"的点光（= slots.js 每厅一盏馆内暖光）。
       灯笼点光群是下面才建的，所以不会被误收（与原型顺序一致）。 */
    hallLights = [];
    scene.traverse(function (n) {
      if (n.isDirectionalLight && !sun) sun = n;
      if (n.isHemisphereLight && !hemi) hemi = n;
    });
    collectHallLights();          /* 先把已存在的收进来（异步布展的后面再补收） */
    /* 序厅补光：两盏常亮暖光（纳入 hallLights，夜间会随 k 加强） */
    HALL_FILL.forEach(function (p) {
      var fl = new THREE.PointLight(0xffe9cf, 1.0, 16, 1);
      fl.position.set(p[0], p[1], p[2]);
      scene.add(fl);
      hallLights.push(fl);
    });

    /* 灯笼点光群（初始强度 0，夜里才亮） */
    LAMPS.forEach(function (a) {
      var pl = new THREE.PointLight(0xffb46a, 0, a[3] * 7, 1);
      pl.position.set(a[0], a[1], a[2]);
      pl.userData.full = a[3];
      pl.userData.lamp = true;
      scene.add(pl);
      lampLights.push(pl);
    });
    btn = document.getElementById("btn-night");
    ready = true;
    cur = -1;
    apply(goal);          /* 首帧就把白昼态套上（原型的 nightCur = -1 同义） */
    return true;
  }

  /* 每帧：把 nightCur 平滑逼近 nightGoal（约 2s 收敛，同原型） */
  function update(dt) {
    if (!ready) return;
    /* 每 0.5 秒补收一次新出现的室内灯（布展是异步的；按时间而不是帧数，慢机器也准） */
    scanT += (dt || 0.016);
    if (scanT >= 0.5) { scanT = 0; collectHallLights(); }
    if (cur < 0 || Math.abs(goal - cur) > 0.001) {
      cur = cur < 0 ? goal : cur + (goal - cur) * Math.min(1, (dt || 0.016) * 2.2);
      if (Math.abs(goal - cur) <= 0.001) cur = goal;
      apply(cur);
    }
  }

  function setNight(k) { goal = k > 0.5 ? 1 : 0; syncBtn(); }
  /* 立即到位（不插值）：截图 / 录屏 / 测试用，主循环仍走 update 的平滑过渡 */
  function setNightNow(k) { goal = k > 0.5 ? 1 : 0; cur = goal; if (ready) apply(cur); syncBtn(); }
  function toggle() { setNight(goal > 0.5 ? 0 : 1); }

  return {
    init: init, update: update, setNight: setNight, setNightNow: setNightNow, toggle: toggle,
    isNight: function () { return goal > 0.5; },
    /* 运行时快照（排错 / 出图脚本核对用） */
    stats: function () {
      return { ready: ready, k: cur, goal: goal,
        exposure: renderer ? renderer.toneMappingExposure : null,
        sunI: sun ? sun.intensity : null, hemiI: hemi ? hemi.intensity : null,
        bg: scene && scene.background ? scene.background.getHexString() : null,
        lamp0: lampLights[0] ? lampLights[0].intensity : null, lamps: lampLights.length,
        halls: hallLights.length, hallI: hallLights[0] ? hallLights[0].intensity : null };
    },
    getK: function () { return cur < 0 ? goal : cur; },
    lampList: LAMPS
  };
})();