#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_DIR = path.join(ROOT, "public", "videos", "paintings");
const MAX_BYTES = 5 * 1024 * 1024;
const EXPECTED = [
  { key: "qianli", file: "qianli-jiangshan.mp4", title: "千里江山图" },
  { key: "shanshui", file: "fuchun-shanju.mp4", title: "富春山居图" },
  { key: "renwu", file: "hanxizai.mp4", title: "韩熙载夜宴图" },
  { key: "huaniao", file: "molan.mp4", title: "墨兰图" },
];

function fail(message) {
  throw new Error(message);
}

function readMvhd(buffer) {
  const marker = buffer.indexOf(Buffer.from("mvhd"));
  if (marker < 0) fail("缺少 mvhd 元数据");
  const version = buffer[marker + 4];
  if (version === 1) {
    return {
      timescale: buffer.readUInt32BE(marker + 24),
      duration: Number(buffer.readBigUInt64BE(marker + 28)),
    };
  }
  return {
    timescale: buffer.readUInt32BE(marker + 16),
    duration: buffer.readUInt32BE(marker + 20),
  };
}

function readTkhdSize(buffer) {
  const marker = buffer.indexOf(Buffer.from("tkhd"));
  if (marker < 0) fail("缺少 tkhd 元数据");
  const version = buffer[marker + 4];
  const widthOffset = marker + (version === 1 ? 92 : 80);
  const heightOffset = widthOffset + 4;
  return {
    width: Math.round(buffer.readUInt32BE(widthOffset) / 65536),
    height: Math.round(buffer.readUInt32BE(heightOffset) / 65536),
  };
}

const source = fs.readFileSync(path.join(ROOT, "js", "ink-worlds.js"), "utf8");
for (const item of EXPECTED) {
  const file = path.join(VIDEO_DIR, item.file);
  if (!fs.existsSync(file)) fail(`缺少画境视频：${item.file}`);
  const size = fs.statSync(file).size;
  if (size <= 0 || size > MAX_BYTES) fail(`${item.file} 文件大小异常：${size} bytes`);

  const buffer = fs.readFileSync(file);
  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") fail(`${item.file} 不是有效 MP4`);
  if (!buffer.includes(Buffer.from("avc1"))) fail(`${item.file} 不是 H.264/AVC`);

  const mvhd = readMvhd(buffer);
  const duration = mvhd.duration / mvhd.timescale;
  if (Math.abs(duration - 15) > 0.2) fail(`${item.file} 时长应为 15 秒，实际 ${duration.toFixed(2)} 秒`);

  const dimensions = readTkhdSize(buffer);
  if (dimensions.width !== 1280 || dimensions.height !== 720) {
    fail(`${item.file} 应为 1280x720，实际 ${dimensions.width}x${dimensions.height}`);
  }

  if (!source.includes(`video: "./videos/paintings/${item.file}"`)) {
    fail(`${item.title} 未指向 ${item.file}`);
  }
  console.log(`${item.title}: ${item.file} · ${(size / 1024 / 1024).toFixed(2)}MB · 15s · 1280x720`);
}

if (/status:\s*["']placeholder["']/.test(source)) {
  fail("仍有画境卡片处于 placeholder 状态");
}

console.log("OK 四幅画境视频、页面路径与开放状态完整");
