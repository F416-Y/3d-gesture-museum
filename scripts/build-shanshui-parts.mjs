import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const OUTPUT_DIR = "assets/models/parts/opt";

// GLTFExporter r147 uses FileReader for its final Blob -> ArrayBuffer step.
// Node has Blob and arrayBuffer(), so this narrow shim keeps the export headless.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          if (typeof this.onloadend === "function") this.onloadend();
        })
        .catch((error) => {
          if (typeof this.onerror === "function") this.onerror(error);
        });
    }
  };
}

const exporter = new GLTFExporter();

const materials = {
  agedWood: new MeshStandardMaterial({
    color: 0x4a3327,
    roughness: 0.84,
    metalness: 0.0,
    name: "aged-warm-brown-wood",
  }),
  wornWood: new MeshStandardMaterial({
    color: 0x624838,
    roughness: 0.78,
    metalness: 0.0,
    name: "worn-walnut-wood",
  }),
  stone: new MeshStandardMaterial({
    color: 0xa7a69f,
    roughness: 0.94,
    metalness: 0.0,
    name: "pale-gray-limestone",
  }),
  plaster: new MeshStandardMaterial({
    color: 0xe7e2d5,
    roughness: 0.96,
    metalness: 0.0,
    name: "off-white-plaster",
  }),
  paper: new MeshStandardMaterial({
    color: 0xf2eee3,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.72,
    side: DoubleSide,
    name: "frosted-rice-paper",
  }),
  glass: new MeshStandardMaterial({
    color: 0xdce8e4,
    roughness: 0.32,
    metalness: 0.0,
    transparent: true,
    opacity: 0.38,
    side: DoubleSide,
    name: "frosted-skylight-glass",
  }),
  darkMetal: new MeshStandardMaterial({
    color: 0x2e2924,
    roughness: 0.7,
    metalness: 0.12,
    name: "muted-dark-iron",
  }),
};

function box(parent, name, width, height, depth, x, y, z, material) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, radiusTop, radiusBottom, height, x, y, z, material, segments = 20) {
  const mesh = new Mesh(
    new CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function plane(parent, name, width, height, x, y, z, material, rotationX = 0) {
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotationX;
  parent.add(mesh);
  return mesh;
}

function createColumn() {
  const root = new Group();
  root.name = "column";
  root.userData = {
    id: "column",
    sizeM: 4.2,
    front: "+Z",
    origin: "bottom-center",
  };

  box(root, "stone-base", 0.58, 0.22, 0.58, 0, 0.11, 0, materials.stone);
  cylinder(root, "base-roll", 0.225, 0.255, 0.1, 0, 0.32, 0, materials.stone, 24);
  cylinder(root, "timber-shaft", 0.165, 0.19, 3.66, 0, 2.2, 0, materials.agedWood, 24);

  cylinder(root, "lower-iron-band", 0.197, 0.197, 0.045, 0, 0.48, 0, materials.darkMetal, 24);
  cylinder(root, "upper-iron-band", 0.177, 0.177, 0.04, 0, 3.78, 0, materials.darkMetal, 24);
  box(root, "timber-capital", 0.48, 0.18, 0.48, 0, 4.11, 0, materials.wornWood);
  box(root, "capital-top-plate", 0.58, 0.05, 0.58, 0, 4.175, 0, materials.agedWood);

  return root;
}

function createLatticeWindow() {
  const root = new Group();
  root.name = "lattice-window";
  root.userData = {
    id: "lattice-window",
    sizeM: 2.2,
    front: "+Z",
    origin: "bottom-center",
  };

  const outerWidth = 1.82;
  const outerHeight = 2.2;
  const surround = 0.12;
  const frame = 0.055;
  const depth = 0.15;

  box(root, "plaster-surround-top", outerWidth, surround, depth + 0.03, 0, outerHeight - surround / 2, 0, materials.plaster);
  box(root, "plaster-surround-bottom", outerWidth, surround, depth + 0.03, 0, surround / 2, 0, materials.plaster);
  box(root, "plaster-surround-left", surround, outerHeight, depth + 0.03, -outerWidth / 2 + surround / 2, outerHeight / 2, 0, materials.plaster);
  box(root, "plaster-surround-right", surround, outerHeight, depth + 0.03, outerWidth / 2 - surround / 2, outerHeight / 2, 0, materials.plaster);

  const innerWidth = outerWidth - surround * 2;
  const innerHeight = outerHeight - surround * 2;
  const innerX = 0;
  const innerY = outerHeight / 2;

  box(root, "window-top-rail", innerWidth, frame, depth, innerX, innerY + innerHeight / 2 - frame / 2, 0, materials.agedWood);
  box(root, "window-bottom-rail", innerWidth, frame, depth, innerX, innerY - innerHeight / 2 + frame / 2, 0, materials.agedWood);
  box(root, "window-left-rail", frame, innerHeight, depth, innerX - innerWidth / 2 + frame / 2, innerY, 0, materials.agedWood);
  box(root, "window-right-rail", frame, innerHeight, depth, innerX + innerWidth / 2 - frame / 2, innerY, 0, materials.agedWood);

  plane(root, "rice-paper", innerWidth - frame * 2, innerHeight - frame * 2, innerX, innerY, -0.015, materials.paper);

  for (let col = 1; col <= 2; col += 1) {
    const x = -innerWidth / 2 + (innerWidth / 3) * col;
    box(root, `vertical-lattice-${col}`, 0.026, innerHeight - frame * 2, depth * 0.72, x, innerY, 0.012, materials.agedWood);
  }
  for (let row = 1; row <= 4; row += 1) {
    const y = innerY - innerHeight / 2 + (innerHeight / 5) * row;
    box(root, `horizontal-lattice-${row}`, innerWidth - frame * 2, 0.024, depth * 0.72, 0, y, 0.012, materials.agedWood);
  }

  for (let col = 0; col < 3; col += 1) {
    for (let row = 0; row < 5; row += 1) {
      const x = -innerWidth / 2 + innerWidth / 6 + col * (innerWidth / 3);
      const y = innerY - innerHeight / 2 + innerHeight / 10 + row * (innerHeight / 5);
      box(root, `window-detail-${col}-${row}`, innerWidth / 3 - 0.1, 0.014, depth * 0.58, x, y, 0.022, materials.wornWood);
    }
  }

  box(root, "inner-sill", innerWidth + 0.08, 0.055, depth + 0.14, 0, surround + 0.025, 0.08, materials.wornWood);
  return root;
}

function createSkylight() {
  const root = new Group();
  root.name = "skylight";
  root.userData = {
    id: "skylight",
    sizeM: 6,
    front: "top-down",
    origin: "bottom-center",
  };

  const size = 6;
  const rail = 0.18;
  const height = 0.28;
  const half = size / 2;

  plane(root, "frosted-glass", size - rail * 2, size - rail * 2, 0, 0.08, 0, materials.glass, -Math.PI / 2);

  box(root, "outer-frame-north", size, height, rail, 0, height / 2, -half + rail / 2, materials.agedWood);
  box(root, "outer-frame-south", size, height, rail, 0, height / 2, half - rail / 2, materials.agedWood);
  box(root, "outer-frame-west", rail, height, size - rail * 2, -half + rail / 2, height / 2, 0, materials.agedWood);
  box(root, "outer-frame-east", rail, height, size - rail * 2, half - rail / 2, height / 2, 0, materials.agedWood);

  for (let index = 1; index <= 4; index += 1) {
    const position = -half + (size / 5) * index;
    box(root, `cross-beam-x-${index}`, 0.055, 0.16, size - rail * 2, position, 0.12, 0, materials.wornWood);
    box(root, `cross-beam-z-${index}`, size - rail * 2, 0.16, 0.055, 0, 0.12, position, materials.wornWood);
  }

  box(root, "recessed-inner-frame-north", size - 0.36, 0.06, 0.07, 0, 0.265, -half + 0.34, materials.agedWood);
  box(root, "recessed-inner-frame-south", size - 0.36, 0.06, 0.07, 0, 0.265, half - 0.34, materials.agedWood);
  box(root, "recessed-inner-frame-west", 0.07, 0.06, size - 0.72, -half + 0.34, 0.265, 0, materials.agedWood);
  box(root, "recessed-inner-frame-east", 0.07, 0.06, size - 0.72, half - 0.34, 0.265, 0, materials.agedWood);

  return root;
}

function createPaintingFrame() {
  const root = new Group();
  root.name = "painting-frame";
  root.userData = {
    id: "painting-frame",
    sizeM: 1.6,
    front: "+Z",
    origin: "bottom-center",
    opening: "inner rebate only; no painting texture",
  };

  const width = 1.1;
  const height = 1.6;
  const frame = 0.08;
  const depth = 0.12;
  const halfW = width / 2;
  const halfH = height / 2;

  box(root, "frame-top", width, frame, depth, 0, height - frame / 2, 0, materials.agedWood);
  box(root, "frame-bottom", width, frame, depth, 0, frame / 2, 0, materials.agedWood);
  box(root, "frame-left", frame, height - frame * 2, depth, -halfW + frame / 2, halfH, 0, materials.agedWood);
  box(root, "frame-right", frame, height - frame * 2, depth, halfW - frame / 2, halfH, 0, materials.agedWood);

  box(root, "bevel-top", width - frame * 2, 0.018, depth + 0.012, 0, height - frame * 1.45, 0.008, materials.wornWood);
  box(root, "bevel-bottom", width - frame * 2, 0.018, depth + 0.012, 0, frame * 1.45, 0.008, materials.wornWood);
  box(root, "bevel-left", 0.018, height - frame * 2.9, depth + 0.012, -halfW + frame * 1.45, halfH, 0.008, materials.wornWood);
  box(root, "bevel-right", 0.018, height - frame * 2.9, depth + 0.012, halfW - frame * 1.45, halfH, 0.008, materials.wornWood);

  plane(root, "mount-board", width - frame * 2, height - frame * 2, 0, halfH, -0.025, materials.plaster);
  box(root, "hanging-cleat", 0.42, 0.035, 0.035, 0, height - 0.0175, -0.045, materials.darkMetal);
  return root;
}

function disposeGeometry(root) {
  root.traverse((object) => {
    if (object.geometry instanceof BufferGeometry) object.geometry.dispose();
  });
}

async function exportPart(id, root, expectedSize) {
  root.name = id;
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const center = bounds.getCenter(new Vector3());
  root.position.set(-center.x, -bounds.min.y, -center.z);
  root.updateMatrixWorld(true);

  const finalBounds = new Box3().setFromObject(root);
  const size = finalBounds.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (Math.abs(maxDim - expectedSize) > 0.003) {
    throw new Error(`${id}: expected max size ${expectedSize}m, got ${maxDim.toFixed(4)}m`);
  }
  if (Math.abs(finalBounds.min.y) > 0.001) {
    throw new Error(`${id}: lowest point is ${finalBounds.min.y.toFixed(4)}, expected 0`);
  }
  if (Math.abs(finalBounds.min.x + finalBounds.max.x) > 0.001 ||
      Math.abs(finalBounds.min.z + finalBounds.max.z) > 0.001) {
    throw new Error(`${id}: horizontal origin is not centered`);
  }

  const binary = await new Promise((resolve, reject) => {
    exporter.parse(root, resolve, reject, {
      binary: true,
      onlyVisible: true,
      truncateDrawRange: false,
      maxTextureSize: 1024,
    });
  });

  await writeFile(join(OUTPUT_DIR, `${id}.glb`), Buffer.from(binary));
  console.log(
    `${id.padEnd(16)} ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)} m  ` +
    `minY=${finalBounds.min.y.toFixed(3)}  ${binary.byteLength} bytes`,
  );
  disposeGeometry(root);
}

await mkdir(OUTPUT_DIR, { recursive: true });

const parts = [
  ["column", createColumn(), 4.2],
  ["lattice-window", createLatticeWindow(), 2.2],
  ["skylight", createSkylight(), 6],
  ["painting-frame", createPaintingFrame(), 1.6],
];

for (const [id, root, expectedSize] of parts) {
  await exportPart(id, root, expectedSize);
}

Object.values(materials).forEach((material) => material.dispose());
