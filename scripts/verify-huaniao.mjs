#!/usr/bin/env node
/**
 * 组员5花鸟厅静态验收。
 * 检查独立页面、三幅画、七件 GLB 的必要结构和本地引用，不启动浏览器。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const problems = [];
const warnings = [];

const PARTS = {
  "door-column": [1.0, 4.5, 0.8],
  "door-leaf": [2.0, 3.0, 0.18],
  "door-canopy": [6.2, 1.7, 1.6],
  "wall-pillar": [0.72, 2.6, 0.72],
  "back-wall": [14.0, 3.6, 0.55],
  "long-table": [2.4, 1.0, 0.75],
  bookshelf: [1.55, 2.0, 0.55],
};

function readGlbStructure(file) {
  const data = fs.readFileSync(path.join(ROOT, file));
  if (data.toString("ascii", 0, 4) !== "glTF") throw new Error("不是 GLB 2.0 文件");
  if (data.readUInt32LE(4) !== 2) throw new Error("GLB 版本不是 2");
  const jsonLength = data.readUInt32LE(12);
  const doc = JSON.parse(data.toString("utf8", 20, 20 + jsonLength));
  let triangles = 0;
  for (const mesh of doc.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const count = primitive.indices == null
        ? doc.accessors?.[primitive.attributes?.POSITION]?.count || 0
        : doc.accessors?.[primitive.indices]?.count || 0;
      triangles += Math.floor(count / 3);
    }
  }
  return {
    meshes: doc.meshes?.length || 0,
    materials: doc.materials?.length || 0,
    textures: doc.textures?.length || 0,
    triangles,
  };
}

const page = read("public/huaniao.html");
if (!/<canvas\s+id="scene"/.test(page)) problems.push("花鸟页缺少三维画布 #scene");
if (!page.includes('data-ready="false"')) problems.push("花鸟页缺少加载状态标记");
if (!page.includes("MuseumGesture")) problems.push("花鸟页没有接入手势模块");
if (!page.includes("./js/vendor/three.min.js")) problems.push("花鸟页没有使用本地 Three.js");
if (!page.includes("./js/vendor/GLTFLoader.js")) problems.push("花鸟页没有使用本地 GLTFLoader");
if (!page.includes("./js/vendor/mediapipe/vision_bundle.js")) problems.push("花鸟页没有使用本地 MediaPipe");
if (!page.includes("window.HuaniaoGallery")) problems.push("花鸟页缺少自动验收接口");
if (!page.includes("双扇门 · 闭合")) problems.push("花鸟页缺少门扇闭合状态");
if (/(?:C:|D:)\\\\|\/Users\//.test(page)) problems.push("花鸟页包含绝对资源路径");
if (page.includes("wenchuang.html")) problems.push("花鸟页错误引用了文创页面");
if (!page.includes('item.hall === "hall2"')) problems.push("花鸟页没有从 MuseumConfig 限定 hall2 展品");

const moduleSource = page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (!moduleSource) {
  problems.push("花鸟页缺少主模块脚本");
} else {
  try {
    new Function(moduleSource);
  } catch (error) {
    problems.push(`花鸟页模块语法错误：${error.message}`);
  }
}

for (const [id, target] of Object.entries(PARTS)) {
  const file = `assets/models/parts/opt/${id}.glb`;
  if (!page.includes(`"${id}"`) && id !== "bookshelf") problems.push(`花鸟页未声明零件 ${id}`);
  if (id === "bookshelf" && !page.includes("bookshelf")) problems.push("花鸟页未声明书架");
  if (!exists(file)) {
    problems.push(`缺少零件文件 ${file}`);
    continue;
  }
  try {
    const structure = readGlbStructure(file);
    if (!structure.meshes) problems.push(`${id} 没有 mesh`);
    if (!structure.triangles) problems.push(`${id} 没有三角面`);
    if (!structure.materials) warnings.push(`${id} 没有材质`);
    if (structure.triangles > 100000) warnings.push(`${id} 三角面 ${structure.triangles}，需继续关注网页性能`);
    console.log(
      `  ${id.padEnd(13)} ${String(structure.triangles).padStart(6)} tris · ` +
      `${structure.materials} mat · ${structure.textures} tex · target ${target.join("×")}m`
    );
  } catch (error) {
    problems.push(`${file} 解析失败：${error.message}`);
  }
}

const sandbox = { window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("js/config.js"), sandbox, { filename: "js/config.js" });
const paintings = (sandbox.MuseumConfig?.exhibits || []).filter((item) => item.hall === "hall2");
if (paintings.length !== 3) problems.push(`花鸟厅应有三幅画，实际 ${paintings.length}`);
for (const painting of paintings) {
  if (!page.includes("exhibit.image")) problems.push("花鸟页没有使用展品图片字段");
  if (!exists(painting.image)) problems.push(`展品图片缺失：${painting.image}`);
}

const doorWidth = PARTS["door-leaf"][0];
const doorOpening = 2.05;
if (doorWidth > doorOpening - 0.02) {
  problems.push(`门扇宽 ${doorWidth}m 无法放入 ${doorOpening}m 门洞`);
}
if (!page.includes(`box(room, ${doorOpening}`)) {
  problems.push("页面门洞尺寸与门扇验收值不一致");
}
const backWallCoverage = PARTS["back-wall"][0] + 2 * 3.45;
if (backWallCoverage < 20.9 - 0.01) {
  problems.push(`后墙收口不足：${backWallCoverage}m < 20.9m`);
}

/* 平面遮挡核算：书架位于 ±7.9，长案位于 0/-1.05，画作挂点位于 ±4.25/0。 */
const tableTop = PARTS["long-table"][1];
if (tableTop >= 2.34 - 1.75 / 2) {
  problems.push("长案顶面高度侵入中央画作下沿");
}
const shelfHalfX = PARTS["bookshelf"][2] / 2;
if (7.9 - shelfHalfX < 4.25 + 2.15 / 2 + 0.25) {
  warnings.push("侧画与书架的平面间距较紧，浏览器验收时需确认无透视遮挡");
}

const shots = [
  "组员5-01-door-column-360度.png",
  "组员5-02-door-leaf-360度.png",
  "组员5-03-door-canopy-360度.png",
  "组员5-04-wall-pillar-360度.png",
  "组员5-05-back-wall-360度.png",
  "组员5-06-long-table-360度.png",
  "组员5-07-bookshelf-360度.png",
  "组员5-08-花鸟厅入口机位.png",
  "组员5-09-花鸟厅画作无遮挡.png",
  "组员5-10-门关闭检查.png",
];
for (const shot of shots) {
  if (!exists(`docs/current/组员5-截图/${shot}`)) problems.push(`缺少验收图：${shot}`);
}
if (shots.length !== 10) problems.push("验收图数量不是 10 张");

console.log("");
console.log(`花鸟厅静态验收：${Object.keys(PARTS).length} 件零件 · ${paintings.length} 幅画`);
console.log(`  页面：public/huaniao.html`);
for (const warning of warnings) console.log(`  ! ${warning}`);
if (problems.length) {
  for (const problem of problems) console.error(`  x ${problem}`);
  process.exit(1);
}
console.log("OK 花鸟厅页面结构、七件 GLB、三幅画与本地资源引用完整");
