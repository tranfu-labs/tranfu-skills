#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RESVG_VERSION = "2.6.2";
const PACKAGE_NAME = "@resvg/resvg-wasm";
const PACKAGE_SPEC = `${PACKAGE_NAME}@${RESVG_VERSION}`;
const PACKAGE_INTEGRITY =
  "sha512-FqALmHI8D4o6lk/LRWDnhw95z5eO+eAa6ORjVg09YRR7BkcM6oPHU9uyC0gtQG5vpFLvgpeU4+zEAz2H8APHNw==";
const LICENSE_SHA256 = "4b89d4518bd135ab4ee154a7bce722246b57a98c3d7efc1a09409898160c2bd1";
const SOURCE_REPOSITORY = "https://github.com/thx/resvg-js";
const SOURCE_TAG = `v${RESVG_VERSION}`;
const LICENSE_URL = `https://raw.githubusercontent.com/thx/resvg-js/${SOURCE_TAG}/LICENSE`;

const RUNTIME_FILES = ["index.js", "index_bg.wasm"];
const PACKAGE_FILES = [
  "README.md",
  "index.d.ts",
  "index.js",
  "index.min.js",
  "index.mjs",
  "index_bg.wasm",
  "package.json"
];
const CHECKSUM_FILES = [...RUNTIME_FILES, "LICENSE", "VERSION", "SOURCE.md"];
const VENDOR_FILES = [...CHECKSUM_FILES, "SHA256SUMS"];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const vendorParent = resolve(skillRoot, "vendor");
const vendorDir = resolve(vendorParent, "resvg-wasm");
const lockDir = resolve(vendorParent, ".resvg-wasm-vendor.lock");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpm(args, cwd) {
  const result = spawnSync(npmCommand(), args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
    windowsHide: true
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(`npm exited with status ${result.status}${details ? `:\n${details}` : ""}`);
  }

  return result.stdout;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertExactNames(actual, expected, label) {
  const actualSorted = sorted(actual);
  const expectedSorted = sorted(expected);
  invariant(
    JSON.stringify(actualSorted) === JSON.stringify(expectedSorted),
    `${label} mismatch. Expected ${expectedSorted.join(", ")}; received ${actualSorted.join(", ")}`
  );
}

async function assertRegularFiles(directory, expectedNames, label) {
  const entries = await readdir(directory, { withFileTypes: true });
  assertExactNames(
    entries.map((entry) => entry.name),
    expectedNames,
    label
  );
  for (const entry of entries) {
    invariant(entry.isFile(), `${label} entry must be a regular file: ${entry.name}`);
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function verifyTarballIntegrity(tarballPath) {
  const [algorithm, expectedDigest] = PACKAGE_INTEGRITY.split("-", 2);
  const actualDigest = createHash(algorithm).update(await readFile(tarballPath)).digest("base64");
  invariant(actualDigest === expectedDigest, `Package integrity mismatch for ${PACKAGE_SPEC}`);
}

function parsePackResult(output) {
  let result;
  try {
    result = JSON.parse(output);
  } catch (error) {
    throw new Error(`Unable to parse npm pack JSON: ${error.message}`);
  }

  invariant(Array.isArray(result) && result.length === 1, "npm pack must return exactly one package");
  const packed = result[0];
  invariant(packed.name === PACKAGE_NAME, `Unexpected package name: ${packed.name ?? "<missing>"}`);
  invariant(packed.version === RESVG_VERSION, `Unexpected package version: ${packed.version ?? "<missing>"}`);
  invariant(packed.integrity === PACKAGE_INTEGRITY, "npm dist.integrity does not match the pinned value");
  invariant(typeof packed.filename === "string" && basename(packed.filename) === packed.filename, "Unsafe npm tarball filename");
  invariant(Array.isArray(packed.files), "npm pack did not report its file list");
  assertExactNames(
    packed.files.map((file) => file.path),
    PACKAGE_FILES,
    "Published package file list"
  );
  return packed;
}

async function packAndInstall(stagingRoot) {
  const packDir = join(stagingRoot, "pack");
  const installDir = join(stagingRoot, "install");
  await mkdir(packDir);
  await mkdir(installDir);

  const packOutput = runNpm(
    ["pack", "--json", "--ignore-scripts", "--pack-destination", ".", PACKAGE_SPEC],
    packDir
  );
  const packed = parsePackResult(packOutput);
  const tarballPath = resolve(packDir, packed.filename);
  invariant(relative(packDir, tarballPath) === packed.filename, "npm tarball escaped the staging directory");
  invariant((await stat(tarballPath)).isFile(), "npm pack did not create a regular tarball");
  await verifyTarballIntegrity(tarballPath);

  const relativeTarball = join("..", "pack", packed.filename);
  runNpm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--package-lock=false",
      relativeTarball
    ],
    installDir
  );

  const packageDir = join(installDir, "node_modules", "@resvg", "resvg-wasm");
  await assertRegularFiles(packageDir, PACKAGE_FILES, "Installed package file list");
  const packageMetadata = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
  invariant(packageMetadata.name === PACKAGE_NAME, "Installed package name mismatch");
  invariant(packageMetadata.version === RESVG_VERSION, "Installed package version mismatch");
  invariant(packageMetadata.license === "MPL-2.0", "Installed package license must be MPL-2.0");
  invariant(packageMetadata.main === "index.js", "Installed package CommonJS entry must be index.js");
  invariant(packageMetadata.exports?.["."]?.default === "./index.js", "Installed package default export changed");
  invariant(
    packageMetadata.exports?.["./index_bg.wasm"] === "./index_bg.wasm",
    "Installed package WASM export changed"
  );
  assertExactNames(
    packageMetadata.files,
    PACKAGE_FILES.filter((file) => file !== "README.md" && file !== "package.json"),
    "package.json files"
  );

  const javascript = await readFile(join(packageDir, "index.js"));
  const wasm = await readFile(join(packageDir, "index_bg.wasm"));
  invariant(javascript.length > 0, "index.js is empty");
  invariant(wasm.length >= 4 && wasm.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d])), "Invalid WASM header");
  return packageDir;
}

async function fetchLicense() {
  const response = await fetch(LICENSE_URL, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  invariant(response.ok, `Unable to download the exact-tag license: HTTP ${response.status}`);
  const license = Buffer.from(await response.arrayBuffer());
  const text = license.toString("utf8");
  invariant(text.includes("Mozilla Public License Version 2.0"), "Downloaded license is not MPL-2.0");
  invariant(
    createHash("sha256").update(license).digest("hex") === LICENSE_SHA256,
    "Downloaded license checksum does not match the pinned v2.6.2 license"
  );
  return license;
}

async function buildCandidate(stagingRoot, packageDir, license) {
  const candidateDir = join(stagingRoot, "candidate");
  await mkdir(candidateDir);

  for (const fileName of RUNTIME_FILES) {
    await copyFile(join(packageDir, fileName), join(candidateDir, fileName));
  }
  await writeFile(join(candidateDir, "LICENSE"), license);
  await writeFile(join(candidateDir, "VERSION"), `${RESVG_VERSION}\n`, "utf8");

  const sourceDocument = `# Vendored resvg WASM

- Package: \`${PACKAGE_NAME}\`
- Version: \`${RESVG_VERSION}\`
- npm dist integrity: \`${PACKAGE_INTEGRITY}\`
- Upstream repository: ${SOURCE_REPOSITORY}
- Upstream tag: \`${SOURCE_TAG}\`
- Upstream license: ${LICENSE_URL}
- Upstream license SHA-256: \`${LICENSE_SHA256}\`
- Runtime files retained: \`${RUNTIME_FILES.join("\`, \`")}\`
- Local modifications: none
- License: MPL-2.0; see \`LICENSE\`

This directory is generated by \`node scripts/vendor-resvg-wasm.mjs\`.
End users do not run npm install. The files are committed into the skill repository.
`;
  await writeFile(join(candidateDir, "SOURCE.md"), sourceDocument, "utf8");

  const checksums = [];
  for (const fileName of CHECKSUM_FILES) {
    checksums.push(`${await sha256(join(candidateDir, fileName))}  ${fileName}`);
  }
  await writeFile(join(candidateDir, "SHA256SUMS"), `${checksums.join("\n")}\n`, "utf8");
  await verifyCandidate(candidateDir);
  return candidateDir;
}

async function verifyCandidate(candidateDir) {
  await assertRegularFiles(candidateDir, VENDOR_FILES, "Vendored file list");
  invariant((await readFile(join(candidateDir, "VERSION"), "utf8")) === `${RESVG_VERSION}\n`, "VERSION mismatch");

  const checksumLines = (await readFile(join(candidateDir, "SHA256SUMS"), "utf8")).trimEnd().split("\n");
  invariant(checksumLines.length === CHECKSUM_FILES.length, "SHA256SUMS entry count mismatch");
  for (let index = 0; index < CHECKSUM_FILES.length; index += 1) {
    const fileName = CHECKSUM_FILES[index];
    const expectedLine = `${await sha256(join(candidateDir, fileName))}  ${fileName}`;
    invariant(checksumLines[index] === expectedLine, `SHA256SUMS mismatch for ${fileName}`);
  }
}

async function replaceVendor(candidateDir, stagingRoot) {
  const previousDir = join(stagingRoot, "previous");
  let hadPrevious = false;

  try {
    await rename(vendorDir, previousDir);
    hadPrevious = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  try {
    await rename(candidateDir, vendorDir);
  } catch (error) {
    if (!hadPrevious) throw error;
    try {
      await rename(previousDir, vendorDir);
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "Unable to install or restore vendored resvg WASM");
    }
    throw error;
  }
}

async function main() {
  await mkdir(vendorParent, { recursive: true });
  let locked = false;
  let stagingRoot;

  try {
    try {
      await mkdir(lockDir);
      locked = true;
    } catch (error) {
      if (error?.code === "EEXIST") throw new Error(`Another resvg vendoring process holds ${lockDir}`);
      throw error;
    }

    stagingRoot = await mkdtemp(join(vendorParent, ".resvg-wasm-stage-"));
    const packageDir = await packAndInstall(stagingRoot);
    const license = await fetchLicense();
    const candidateDir = await buildCandidate(stagingRoot, packageDir, license);
    await replaceVendor(candidateDir, stagingRoot);
  } finally {
    try {
      if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
    } finally {
      if (locked) await rm(lockDir, { recursive: true, force: true });
    }
  }

  console.log(`Vendored ${PACKAGE_SPEC} into ${vendorDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
