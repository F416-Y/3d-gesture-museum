#!/usr/bin/env node
/**
 * 组员5花鸟厅静态验收。
 * 花鸟厅与山水厅共用同一场景壳，只替换三幅画作和对应文案。
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

const SHARED_PARTS = ["column", "lattice-window", "skylight", "painting-frame"];
const PAINTING_IDS = ["xieshengzhenqintu", "wuniutu", "molantu"];

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
if (!/<canvas\s+id="gallery"/.test(page)) problems.push("花鸟页缺少三维画布 #gallery");
if (!page.includes('data-ready="false"')) problems.push("花鸟页缺少加载状态标记");
if (!page.includes("./js/vendor/three.min.js")) problems.push("花鸟页没有使用本地 Three.js");
if (!page.includes("./js/vendor/GLTFLoader.js")) problems.push("花鸟页没有使用本地 GLTFLoader");
if (!page.includes("./js/vendor/mediapipe/vision_bundle.js")) problems.push("花鸟页没有使用本地 MediaPipe");
if (!page.includes("window.HuaniaoGallery")) problems.push("花鸟页缺少自动验收接口");
if (!page.includes("花鸟清趣")) problems.push("花鸟页缺少厅名");
if (!page.includes("花鸟厅 · 北墙")) problems.push("花鸟页缺少展厅位置标识");
if (/(?:C:|D:)\\\\|\/Users\//.test(page)) problems.push("花鸟页包含绝对资源路径");
if (page.includes("wenchuang.html")) problems.push("花鸟页错误引用了文创页面");
if (!page.includes("handleGestureState")) problems.push("花鸟页缺少手势状态测试接口");
if (!page.includes("stepArtwork")) problems.push("花鸟页缺少画作切换逻辑");
if (page.includes("canvas.addEventListener(\"wheel\"")) problems.push("花鸟页仍保留滚轮改变视角");
if (page.includes("KeyW") || page.includes("KeyA") || page.includes("KeyS") || page.includes("KeyD")) {
  problems.push("花鸟页仍包含 WASD 漫游逻辑");
}
if (page.includes('desired.yaw -= dx') || page.includes('state.turn) desired.yaw')) {
  problems.push("花鸟页仍保留自由旋转或手势转向");
}

const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
for (const href of hrefs) {
  if (href.startsWith("data:")) continue;
  if (href !== "./index.html") problems.push(`花鸟页存在跨展厅链接：${href}`);
}

const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const mainScript = scripts.sort((a, b) => b.length - a.length)[0];
if (!mainScript) {
  problems.push("花鸟页缺少主脚本");
} else {
  try {
    new Function(mainScript);
  } catch (error) {
    problems.push(`花鸟页脚本语法错误：${error.message}`);
  }
}

for (const id of SHARED_PARTS) {
  const file = `assets/models/parts/opt/${id}.glb`;
  if (!page.includes(`"${id}"`)) problems.push(`花鸟页未声明共享构件 ${id}`);
  if (!exists(file)) {
    problems.push(`缺少共享构件 ${file}`);
    continue;
  }
  try {
    const structure = readGlbStructure(file);
    if (!structure.meshes) problems.push(`${id} 没有 mesh`);
    if (!structure.triangles) problems.push(`${id} 没有三角面`);
    if (!structure.materials) warnings.push(`${id} 没有材质`);
    console.log(
      `  ${id.padEnd(15)} ${String(structure.triangles).padStart(6)} tris · ` +
      `${structure.materials} mat · ${structure.textures} tex`,
    );
  } catch (error) {
    problems.push(`${file} 解析失败：${error.message}`);
  }
}

const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("js/config.js"), sandbox, { filename: "js/config.js" });
const paintings = (sandbox.MuseumConfig?.exhibits || []).filter((item) => PAINTING_IDS.includes(item.id));
if (paintings.length !== 3) problems.push(`花鸟厅应有三幅画，实际 ${paintings.length}`);
for (const id of PAINTING_IDS) {
  if (!paintings.some((painting) => painting.id === id)) problems.push(`花鸟页缺少画作 ${id}`);
  if (!page.includes(id)) problems.push(`页面未接入画作 ${id}`);
  if (!exists(`assets/images/${id}.jpg`)) problems.push(`展品图片缺失：assets/images/${id}.jpg`);
}
if (!page.includes('"./assets/images/" + painting.id + ".jpg"')) {
  problems.push("花鸟页没有使用三幅花鸟画的实际图片路径");
}

const shots = [
  "组员5-08-花鸟厅入口机位.png",
  "组员5-09-花鸟厅画作无遮挡.png",
  "组员5-11-花鸟厅移动端.png",
];
for (const shot of shots) {
  if (!exists(`docs/current/组员5-截图/${shot}`)) problems.push(`缺少验收图：${shot}`);
}
for (const shot of shots.slice(0, 2)) {
  const file = path.join(ROOT, "docs/current/组员5-截图", shot);
  if (!fs.existsSync(file)) continue;
  const image = fs.readFileSync(file);
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width !== 1600 || height !== 900) {
    problems.push(`浏览器截图尺寸异常：${shot} 为 ${width}×${height}`);
  }
}
const mobileShot = path.join(ROOT, "docs/current/组员5-截图", shots[2]);
if (fs.existsSync(mobileShot)) {
  const image = fs.readFileSync(mobileShot);
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width !== 390 || height !== 844) {
    problems.push(`移动端截图尺寸异常：${width}×${height}`);
  }
}

if (!exists("assets/reference/exhibition/current/huaniao-interior-front-elevation-v1.jpg")) {
  problems.push("缺少花鸟厅当前参考图");
}
const handoff = read("docs/current/组员5-花鸟厅交接.md");
if (!handoff.includes("feature/huaniao-visual-parity-5")) {
  problems.push("交接文档分支名未更新");
}
if (!handoff.includes("assets/reference/exhibition/current/huaniao-interior-front-elevation-v1.jpg")) {
  problems.push("交接文档未引用当前参考图");
}

console.log("");
console.log(`花鸟厅静态验收：${SHARED_PARTS.length} 件共享构件 · ${paintings.length} 幅画`);
console.log("  场景：与山水厅共用固定机位、墙面、木地板、梁架、门窗和手势交互");
for (const warning of warnings) console.log(`  ! ${warning}`);
if (problems.length) {
  for (const problem of problems) console.error(`  x ${problem}`);
  process.exit(1);
}
console.log("OK 花鸟厅视觉同构、固定交互、三幅画与资源引用完整");
