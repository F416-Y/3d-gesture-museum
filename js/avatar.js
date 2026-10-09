/* ============================================================
 * avatar.js —— 可选第三人称人物
 * eggman.glb 仅作为玩家外观，不参与建筑碰撞。
 * ============================================================ */
window.MuseumAvatar = (function () {
  var scene = null;
  var holder = null;
  var model = null;
  var enabled = false;

  function init(root) {
    scene = root;
    holder = new THREE.Group();
    holder.name = "third-person-avatar";
    holder.visible = false;
    scene.add(holder);
    if (!THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load("assets/models/eggman.glb", function (gltf) {
      model = gltf.scene;
      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var scale = 1.72 / Math.max(size.y || 1, 0.001);
      model.scale.setScalar(scale);
      box.setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      model.traverse(function (o) {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      holder.add(model);
      holder.visible = enabled;
    }, undefined, function (err) {
      console.warn("[云墨美术馆] eggman.glb 加载失败：", err);
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    if (holder) holder.visible = enabled && !!model;
    return enabled;
  }

  function update(camera) {
    if (!enabled || !holder || !model || !window.MuseumPlayer) return;
    var p = MuseumPlayer.getPosition();
    var yaw = MuseumPlayer.getYaw();
    var eye = (window.MuseumConfig && MuseumConfig.player && MuseumConfig.player.eyeHeight) || 1.7;
    var groundY = p.y - eye;
    holder.position.set(p.x, groundY, p.z);
    // eggman.glb 的正面朝 +Z，而项目玩家的前进方向是 -Z，补半圈后人物才会面向行进方向。
    holder.rotation.y = yaw + Math.PI;
    if (camera) {
      camera.position.set(p.x + Math.sin(yaw) * 3.4, groundY + 2.25, p.z + Math.cos(yaw) * 3.4);
      camera.lookAt(p.x, groundY + 1.05, p.z);
    }
  }

  return { init: init, setEnabled: setEnabled, isEnabled: function () { return enabled; }, update: update };
})();
