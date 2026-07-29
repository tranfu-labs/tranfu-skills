import fs from "node:fs";
import path from "node:path";

export const PERCEPTUAL_HASH_SIZE = 32;
export const PERCEPTUAL_FREQUENCY_SIZE = 8;
export const MAX_ICON_SIMILARITY = 0.5;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export async function perceptualHash(svgSource, sharp) {
  const canonicalSource = svgSource
    .replace(/<!--[\s\S]*?-->/g, "")
    .replaceAll("currentColor", "#000000");
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

  // Raw pHash agreement is about 50% for unrelated images. Normalize that
  // chance baseline to 0%, while identical images remain 100%.
  return Math.max(0, 1 - (2 * distance) / hashA.length);
}

function iconFile(iconRoot, iconName) {
  const file = path.join(iconRoot, `${iconName}.svg`);
  if (!fs.existsSync(file)) {
    throw new Error(`missing Lucide master for similarity check: ${iconName}`);
  }
  return file;
}

async function hashesForEntries(entries, iconRoot, sharp) {
  const hashes = new Map();
  for (const [, spec] of entries) {
    const iconName = spec[1];
    if (!hashes.has(iconName)) {
      const source = fs.readFileSync(iconFile(iconRoot, iconName), "utf8");
      hashes.set(iconName, await perceptualHash(source, sharp));
    }
  }
  return hashes;
}

export async function compareCuratedIcons(curatedSpecs, iconRoot, sharp) {
  const entries = Object.entries(curatedSpecs);
  const hashes = await hashesForEntries(entries, iconRoot, sharp);
  const comparisons = [];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const [leftSlug, leftSpec] = entries[left];
      const [rightSlug, rightSpec] = entries[right];
      if (
        leftSpec[1].startsWith("brand-") &&
        leftSpec[1] === rightSpec[1]
      ) {
        continue;
      }
      comparisons.push({
        left_slug: leftSlug,
        left_icon: leftSpec[1],
        right_slug: rightSlug,
        right_icon: rightSpec[1],
        similarity: perceptualSimilarity(
          hashes.get(leftSpec[1]),
          hashes.get(rightSpec[1]),
        ),
      });
    }
  }
  return comparisons.sort((a, b) => b.similarity - a.similarity);
}

export async function compareCandidateIcon({
  slug,
  icon,
  curatedSpecs,
  iconRoot,
  sharp,
}) {
  const candidateSource = fs.readFileSync(iconFile(iconRoot, icon), "utf8");
  const candidateHash = await perceptualHash(candidateSource, sharp);
  const referenceEntries = Object.entries(curatedSpecs).filter(
    ([referenceSlug, spec]) =>
      referenceSlug !== slug &&
      !(icon.startsWith("brand-") && spec[1] === icon),
  );
  const hashes = await hashesForEntries(referenceEntries, iconRoot, sharp);
  return referenceEntries
    .map(([referenceSlug, spec]) => ({
      slug: referenceSlug,
      icon: spec[1],
      similarity: perceptualSimilarity(candidateHash, hashes.get(spec[1])),
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

export function formatSimilarity(value) {
  return `${(value * 100).toFixed(1)}%`;
}
