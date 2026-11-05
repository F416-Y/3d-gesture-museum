/* Static scene budget report: instantiate the scene graph without a real WebGL context. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const THREE = require("three");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function makeEl() {
  return {
    width: 0, height: 0, style: {}, dataset: {},
    getContext: () => makeCtx(),
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, remove() {},
    appendChild() {}, classList: { add() {}, remove() {}, toggle() {} },
  };
}
function makeCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "", globalAlpha: 1,
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, arc() {}, arcTo() {}, rect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    fillText() {}, strokeText() {}, measureText() { return { width: 10 }; },
    createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return null; }, getImageData() { return { data: new Uint8ClampedArray(4) }; },
    ellipse() {}, roundRect() {}, setLineDash() {}, getLineDash() { return []; }, drawImage() {}, putImageData() {},
    createImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
    setTransform() {}, resetTransform() {}, transform() {}, isPointInPath() { return false; },
  };
}
const sandbox = {
  console, setTimeout, clearTimeout, Math, Date, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Set, Map,
  Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array, Float32Array,
  performance: { now: () => 0 }, navigator: { userAgent: "scene-budget" }, requestAnimationFrame() {},
  document: {
    readyState: "complete", createElement() { return makeEl(); }, createElementNS() { return makeEl(); },
    getElementById() { return null; }, querySelector() { return null; }, addEventListener() {},
  },
  Image: class { constructor() { this.width = 1; this.height = 1; } },
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.THREE = THREE;
vm.createContext(sandbox);
const savedDocument = globalThis.document;
globalThis.document = sandbox.document;
for (const file of ["js/config.js", "js/models.js", "js/exterior.js", "js/gallery.js", "js/windows.js", "js/exterior-layout.js", "js/slots.js", "js/foliage.js", "js/scene.js", "js/static-batcher.js"]) {
  vm.runInContext(read(file), sandbox, { filename: file });
}
const result = await vm.runInContext(`
  (async function () {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    MuseumScene.init({ scene: scene, camera: camera });
    var out = { objects: 0, meshes: 0, instancedMeshes: 0, triangles: 0, vertices: 0, lights: 0, pointLights: 0, shadowCasters: 0, shadowReceivers: 0, geometries: 0, materials: 0, textures: 0, byLight: {}, topMeshes: [] };
    var gs = new Set(), ms = new Set(), ts = new Set();
    scene.traverse(function (n) {
      out.objects++;
      if (n.isLight) { out.lights++; out.byLight[n.type] = (out.byLight[n.type] || 0) + 1; if (n.isPointLight) out.pointLights++; }
      if (!n.isMesh) return;
      out.meshes++; if (n.isInstancedMesh) out.instancedMeshes++;
      if (n.castShadow) out.shadowCasters++; if (n.receiveShadow) out.shadowReceivers++;
      var geo = n.geometry;
      if (geo) {
        gs.add(geo.uuid);
        var count = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
        out.vertices += geo.attributes.position ? geo.attributes.position.count : 0;
        out.triangles += Math.floor(count / 3);
        out.topMeshes.push({ name: n.name || geo.type, triangles: Math.floor(count / 3), instanced: n.isInstancedMesh ? n.count : 1 });
      }
      var mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(function (m) {
        if (!m) return; ms.add(m.uuid);
        ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "emissiveMap"].forEach(function (k) { if (m[k]) ts.add(m[k].uuid); });
      });
    });
    out.geometries = gs.size; out.materials = ms.size; out.textures = ts.size;
    out.topMeshes.sort(function (a, b) { return b.triangles - a.triangles; });
    out.topMeshes = out.topMeshes.slice(0, 20);
    out.topBranches = scene.children.map(function (child, index) {
      var branch = { index: index, name: child.name || child.type, meshes: 0, triangles: 0, lights: 0 };
      child.traverse(function (n) {
        if (n.isLight) branch.lights++;
        if (!n.isMesh) return;
        branch.meshes++;
        var geo = n.geometry;
        if (geo) {
          var count = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
          branch.triangles += Math.floor(count / 3);
        }
      });
      return branch;
    }).sort(function (a, b) { return b.meshes - a.meshes; }).slice(0, 15);
    var geometryTypes = {}, materialTypes = {};
    scene.traverse(function (n) {
      if (n.isMesh && n.geometry) geometryTypes[n.geometry.type] = (geometryTypes[n.geometry.type] || 0) + 1;
      var mats = n.isMesh && n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
      mats.forEach(function (m) { if (m) materialTypes[m.type] = (materialTypes[m.type] || 0) + 1; });
    });
    out.geometryTypes = Object.entries(geometryTypes).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 15);
    out.materialTypes = Object.entries(materialTypes).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 15);
    var buckets = {};
    scene.traverse(function (n) {
      if (!n.isMesh || !n.geometry || !n.material || Array.isArray(n.material)) return;
      if (n.isSkinnedMesh || n.isInstancedMesh || n.userData.noStaticBatch) return;
      var sig = Object.keys(n.geometry.attributes).sort().map(function (k) { var a = n.geometry.attributes[k]; return k + ":" + a.itemSize + ":" + a.normalized; }).join("|");
      var key = n.material.uuid + "|" + (n.castShadow ? 1 : 0) + "|" + (n.receiveShadow ? 1 : 0) + "|" + sig;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    out.estimatedBatches = Object.keys(buckets).length;
    out.largestBuckets = Object.values(buckets).sort(function (a, b) { return b - a; }).slice(0, 15);
    out.batchResult = await MuseumStaticBatcher.optimize(scene, { immediate: true });
    out.afterBatch = { objects: 0, meshes: 0, triangles: 0, shadowCasters: 0 };
    scene.traverse(function (n) {
      out.afterBatch.objects++;
      if (!n.isMesh) return;
      out.afterBatch.meshes++;
      if (n.castShadow) out.afterBatch.shadowCasters++;
      var geo = n.geometry;
      if (geo) {
        var count = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
        out.afterBatch.triangles += Math.floor(count / 3);
      }
    });
    return out;
  })();
`, sandbox);
globalThis.document = savedDocument;
console.log(JSON.stringify(result, null, 2));