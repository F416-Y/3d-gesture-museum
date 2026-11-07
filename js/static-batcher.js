/* ============================================================
 * static-batcher.js —— 运行时静态 Mesh 合批
 * ------------------------------------------------------------
 * 场景由程序化建筑与大量小构件组成，独立 Mesh 数量超过 4,600。
 * 每帧数千次 draw call 会导致主线程/GPU 卡死。
 * 本模块在资源加载稳定后，把同材质、同属性布局、同阴影设置的静态
 * Mesh 合并为少量 BufferGeometry，保留动态对象不参与合批。
 * ============================================================ */
window.MuseumStaticBatcher = (function () {
  function hasDynamicAncestor(node, stop) {
    for (var current = node; current && current !== stop; current = current.parent) {
      if (current.userData && current.userData.noStaticBatch) return true;
      if (current.name === "third-person-avatar") return true;
    }
    return false;
  }

  function attributeSignature(geometry) {
    return Object.keys(geometry.attributes).sort().map(function (name) {
      var attr = geometry.attributes[name];
      return name + ":" + attr.itemSize + ":" + attr.normalized + ":" + attr.array.constructor.name;
    }).join("|");
  }

  function canBatch(mesh) {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.children.length) return false;
    if (!mesh.geometry || !mesh.material || Array.isArray(mesh.material) || !mesh.visible) return false;
    if (!mesh.geometry.attributes.position) return false;
    if (mesh.geometry.morphAttributes && Object.keys(mesh.geometry.morphAttributes).length) return false;
    if (mesh.material.transparent || mesh.material.depthWrite === false) return false;
    if (mesh.userData && mesh.userData.noStaticBatch) return false;
    return true;
  }

  function mergeBucket(items, material, castShadow, receiveShadow, renderOrder, layersMask) {
    if (!items.length) return null;
    var prepared = [];
    var attributeNames = Object.keys(items[0].geometry.attributes).sort();
    try {
      for (var i = 0; i < items.length; i++) {
        var mesh = items[i];
        mesh.updateWorldMatrix(true, false);
        var geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        prepared.push(geometry);
      }

      var merged = new THREE.BufferGeometry();
      for (var a = 0; a < attributeNames.length; a++) {
        var name = attributeNames[a];
        var first = prepared[0].attributes[name];
        if (!first) continue;
        var total = 0;
        for (var p = 0; p < prepared.length; p++) {
          var attr = prepared[p].attributes[name];
          if (!attr) { total = 0; break; }
          total += attr.array.length;
        }
        if (!total) continue;
        var mergedArray = new first.array.constructor(total);
        var offset = 0;
        for (var q = 0; q < prepared.length; q++) {
          var source = prepared[q].attributes[name].array;
          mergedArray.set(source, offset);
          offset += source.length;
        }
        merged.setAttribute(name, new THREE.BufferAttribute(mergedArray, first.itemSize, first.normalized));
      }
      merged.computeBoundingBox();
      merged.computeBoundingSphere();

      var combined = new THREE.Mesh(merged, material);
      combined.name = "static-batch:" + material.name + ":" + items.length;
      combined.castShadow = castShadow;
      combined.receiveShadow = receiveShadow;
      combined.renderOrder = renderOrder;
      combined.layers.mask = layersMask;
      combined.matrixAutoUpdate = false;
      combined.updateMatrix();
      combined.userData.staticBatch = true;

      for (var r = 0; r < items.length; r++) {
        if (items[r].parent) items[r].parent.remove(items[r]);
      }
      return combined;
    } finally {
      prepared.forEach(function (geometry) { geometry.dispose(); });
    }
  }

  function nextIdle() {
    return new Promise(function (resolve) {
      if (typeof requestIdleCallback === "function") requestIdleCallback(function () { resolve(); }, { timeout: 250 });
      else setTimeout(resolve, 0);
    });
  }

  async function optimize(scene, options) {
    options = options || {};
    if (!scene) return { beforeMeshes: 0, afterMeshes: 0, batches: 0 };
    scene.updateMatrixWorld(true);
    var buckets = new Map();
    var beforeMeshes = 0;

    scene.traverse(function (mesh) {
      if (!canBatch(mesh) || hasDynamicAncestor(mesh, scene)) return;
      beforeMeshes++;
      var key = [
        mesh.material.uuid,
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
        mesh.renderOrder,
        mesh.layers.mask,
        attributeSignature(mesh.geometry),
      ].join("|");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(mesh);
    });

    var groups = Array.from(buckets.values()).filter(function (items) { return items.length > 1; });
    groups.sort(function (a, b) { return b.length - a.length; });
    var batches = 0;
    for (var i = 0; i < groups.length; i++) {
      var items = groups[i];
      var sample = items[0];
      var merged = mergeBucket(
        items,
        sample.material,
        sample.castShadow,
        sample.receiveShadow,
        sample.renderOrder,
        sample.layers.mask
      );
      if (merged) {
        scene.add(merged);
        batches++;
      }
      if (!options.immediate && batches % 2 === 0) await nextIdle();
    }

    var afterMeshes = 0;
    scene.traverse(function (node) { if (node.isMesh) afterMeshes++; });
    return { beforeMeshes: beforeMeshes, afterMeshes: afterMeshes, batches: batches, saved: beforeMeshes - afterMeshes };
  }

  return { optimize: optimize };
})();