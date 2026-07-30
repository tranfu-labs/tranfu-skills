import fs from "node:fs";
import path from "node:path";

export const PERCEPTUAL_HASH_SIZE = 32;
export const PERCEPTUAL_FREQUENCY_SIZE = 8;
export const MAX_ICON_SIMILARITY = 0.7;

const SKIP_DIRECTORIES = new Set([".git", ".next", "node_modules"]);
const REPOSITORY_SKILL_ROOTS = ["own-skills", "external-skills", "meta-skills"];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match ? match[1] : "";
}

function removeFullCanvasRects(source) {
  return source.replace(/<rect\b[^>]*\/>/gi, (tag) => {
    const width = Number(attribute(tag, "width"));
    const height = Number(attribute(tag, "height"));
    const x = attribute(tag, "x");
    const y = attribute(tag, "y");
    return width === 48 &&
      height === 48 &&
      (!x || Number(x) === 0) &&
      (!y || Number(y) === 0)
      ? ""
      : tag;
  });
}

export function normalizeShapeSvg(svgSource) {
  const withoutComments = svgSource.replace(/<!--[\s\S]*?-->/g, "");
  const generatedGroup = withoutComments.match(
    /<g\b([^>]*)transform=["']translate\(9(?:\s+|,\s*)9\)\s+scale\(1\.25\)["']([^>]*)>([\s\S]*?)<\/g>/i,
  );
  let canonicalSource;
  if (generatedGroup) {
    const groupAttributes = `${generatedGroup[1]} ${generatedGroup[2]}`;
    const fill = attribute(groupAttributes, "fill") || "none";
    const stroke = attribute(groupAttributes, "stroke") || "none";
    const markStyle =
      stroke.toLowerCase() === "none"
        ? `fill="${fill}" stroke="none"`
        : `fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    canonicalSource = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ${markStyle}>${generatedGroup[3]}</svg>`;
  } else {
    canonicalSource = removeFullCanvasRects(withoutComments);
  }
  return canonicalSource
    .replaceAll("currentColor", "#000000")
    .replace(/#[0-9a-f]{3,8}\b/gi, "#000000")
    .replace(/\brgb\([^)]*\)/gi, "#000000");
}

export async function perceptualHash(svgSource, sharp) {
  const canonicalSource = normalizeShapeSvg(svgSource);
  const { data } = await sharp(Buffer.from(canonicalSource))
    .resize(PERCEPTUAL_HASH_SIZE, PERCEPTUAL_HASH_SIZE, { fit: "fill" })
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const coefficients = [];
  for (let u = 0; u < PERCEPTUAL_FREQUENCY_SIZE; u += 1) {
    for (let v = 0; v < PERCEPTUAL_FREQUENCY_SIZE; v += 1) {
      let sum = 0;
      for (let x = 0; x < PERCEPTUAL_HASH_SIZE; x += 1) {
        for (let y = 0; y < PERCEPTUAL_HASH_SIZE; y += 1) {
          sum +=
            data[y * PERCEPTUAL_HASH_SIZE + x] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * PERCEPTUAL_HASH_SIZE)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * PERCEPTUAL_HASH_SIZE));
        }
      }
      coefficients.push(sum);
    }
  }

  const lowFrequency = coefficients.slice(1);
  const threshold = median(lowFrequency);
  return lowFrequency.map((value) => value > threshold);
}

export function perceptualSimilarity(hashA, hashB) {
  if (hashA.length !== hashB.length || hashA.length === 0) {
    throw new Error("perceptual hashes must have the same non-zero length");
  }
  let distance = 0;
  for (let index = 0; index < hashA.length; index += 1) {
    if (hashA[index] !== hashB[index]) distance += 1;
  }
  return Math.max(0, 1 - (2 * distance) / hashA.length);
}

function walkIconFiles(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkIconFiles(absolute, output);
    } else if (entry.isFile() && entry.name === "icon.svg") {
      output.push(absolute);
    }
  }
}

function skillNameForIcon(iconFile) {
  const skillDir = path.dirname(path.dirname(iconFile));
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) return path.basename(skillDir);
  const source = fs.readFileSync(skillFile, "utf8");
  const match = source.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match ? match[1].trim() : path.basename(skillDir);
}

export function repositoryIconInventory(repositoryRoot, targetSkillName = "") {
  const files = [];
  for (const folder of REPOSITORY_SKILL_ROOTS) {
    walkIconFiles(path.join(repositoryRoot, folder), files);
  }
  return files
    .map((file) => ({
      file,
      skill: skillNameForIcon(file),
      relative_path: path.relative(repositoryRoot, file),
    }))
    .filter((entry) => entry.skill !== targetSkillName)
    .sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}

export function isSkillRepository(repositoryRoot) {
  return REPOSITORY_SKILL_ROOTS.some((folder) =>
    fs.existsSync(path.join(repositoryRoot, folder)),
  );
}

export async function compareCandidateToRepository({
  candidateSource,
  repositoryRoot,
  targetSkillName,
  sharp,
}) {
  const inventory = repositoryIconInventory(repositoryRoot, targetSkillName);
  const candidateHash = await perceptualHash(candidateSource, sharp);
  const comparisons = [];
  for (const entry of inventory) {
    const referenceSource = fs.readFileSync(entry.file, "utf8");
    const referenceHash = await perceptualHash(referenceSource, sharp);
    comparisons.push({
      skill: entry.skill,
      file: entry.file,
      relative_path: entry.relative_path,
      similarity: perceptualSimilarity(candidateHash, referenceHash),
    });
  }
  return {
    inventory_count: inventory.length,
    comparisons: comparisons.sort((left, right) => right.similarity - left.similarity),
  };
}

export function formatSimilarity(value) {
  return `${(value * 100).toFixed(1)}%`;
}
