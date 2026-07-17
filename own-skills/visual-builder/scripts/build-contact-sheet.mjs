#!/usr/bin/env node

import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const items = ["concept", "process", "checklist"];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readPng(filePath, label) {
  const bytes = readFileSync(filePath);
  invariant(bytes.length >= 24, `${label} is too short to be a PNG`);
  invariant(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${label} is not a PNG`);
  invariant(bytes.subarray(12, 16).toString("ascii") === "IHDR", `${label} has no PNG IHDR header`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  invariant(width > 0 && height > 0, `${label} has invalid dimensions`);
  return { bytes, width, height };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    invariant(["--concept", "--process", "--checklist", "--output"].includes(key) && value && !value.startsWith("--"), `Invalid argument near ${key ?? "<end>"}`);
    args[key.slice(2)] = value;
  }
  for (const key of [...items, "output"]) invariant(args[key], `--${key} is required`);
  return args;
}

export function buildContactSheet({ concept, process, checklist, output }) {
  const sources = { concept, process, checklist };
  const loaded = items.map((id) => ({ id, ...readPng(resolve(sources[id]), id) }));
  const sheetWidth = 1200;
  const padding = 32;
  const gap = 24;
  const labelHeight = 52;
  const columnWidth = (sheetWidth - padding * 2 - gap * 2) / 3;
  const rendered = loaded.map((item) => ({
    ...item,
    renderedWidth: columnWidth,
    renderedHeight: columnWidth * item.height / item.width
  }));
  const imageHeight = Math.max(...rendered.map((item) => item.renderedHeight));
  const sheetHeight = Math.ceil(padding * 2 + labelHeight + imageHeight);
  const cards = rendered.map((item, index) => {
    const x = padding + index * (columnWidth + gap);
    const y = padding + labelHeight;
    return `
      <text x="${x}" y="${padding + 28}" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#171717">${item.id}</text>
      <rect x="${x}" y="${y}" width="${columnWidth}" height="${item.renderedHeight}" fill="#ffffff" stroke="#d7d7d7"/>
      <image x="${x}" y="${y}" width="${columnWidth}" height="${item.renderedHeight}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${item.bytes.toString("base64")}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">
    <rect width="100%" height="100%" fill="#f3f3f3"/>${cards}
  </svg>`;

  const outputPath = resolve(output);
  const temporaryPath = `${outputPath}.tmp-${process.pid}.png`;
  mkdirSync(dirname(outputPath), { recursive: true });
  try {
    const result = spawnSync("rsvg-convert", ["--format=png", `--output=${temporaryPath}`], {
      input: svg,
      encoding: "utf8"
    });
    invariant(!result.error, `rsvg-convert failed: ${result.error?.message}`);
    invariant(result.status === 0, `rsvg-convert failed: ${result.stderr?.trim() || `exit ${result.status}`}`);
    readPng(temporaryPath, "contact sheet");
    renameSync(temporaryPath, outputPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return { output: outputPath, width: sheetWidth, height: sheetHeight };
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    console.log(JSON.stringify(buildContactSheet(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
