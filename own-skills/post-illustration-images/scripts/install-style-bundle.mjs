#!/usr/bin/env node

import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateStyleIndex } from "./generate-style-index.mjs";
import { isSafeRelativePath, PLATFORM_BASELINES, validateInstalledRegistry, validateStyleBundle } from "./validate-style-bundle.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = resolve(scriptDir, "..");

const platformRegistrations = Object.freeze({
  weibo: Object.freeze({
    displayName: "Weibo",
    routingPhrases: Object.freeze(["微博", "微博配图", "微博竖版配图", "微博竖版信息图"])
  }),
  toutiao: Object.freeze({
    displayName: "Toutiao",
    routingPhrases: Object.freeze(["头条号", "今日头条", "头条配图", "头条号配图"])
  })
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function writeAtomic(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaryPath, content);
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function restoreFile(filePath, existed, content) {
  if (existed) writeAtomic(filePath, content);
  else rmSync(filePath, { force: true });
}

function installStyleBundleLocked({ bundleDir, skillRoot, registryPath }) {
  const validation = validateStyleBundle({ bundleDir, skillRoot, registryPath });
  const { candidate, spec, registry } = validation;
  const resolvedSkillRoot = validation.skillRoot;
  const indexRelativePath = registry.indexFile ?? "references/style-index.md";
  invariant(isSafeRelativePath(indexRelativePath), "style-registry.json indexFile must be a safe relative path");
  const indexPath = resolve(resolvedSkillRoot, indexRelativePath);

  const copies = [
    {
      source: resolve(validation.bundleDir, candidate.files.styleMarkdown),
      destination: resolve(resolvedSkillRoot, validation.destinations.styleFile)
    },
    {
      source: resolve(validation.bundleDir, candidate.files.styleSpec),
      destination: resolve(resolvedSkillRoot, validation.destinations.specFile)
    },
    {
      source: resolve(validation.bundleDir, candidate.files.styleReference),
      destination: resolve(resolvedSkillRoot, validation.destinations.styleReference)
    },
    {
      source: resolve(validation.bundleDir, candidate.files.provenance),
      destination: resolve(resolvedSkillRoot, validation.destinations.provenanceFile)
    }
  ];

  for (const copy of copies) {
    invariant(!existsSync(copy.destination), `Installer will not overwrite existing file: ${copy.destination}`);
  }

  const registryBefore = readFileSync(validation.registryPath);
  const indexExisted = existsSync(indexPath);
  const indexBefore = indexExisted ? readFileSync(indexPath) : null;
  const candidateBefore = readFileSync(validation.candidatePath);
  const created = [];

  try {
    for (const copy of copies) {
      mkdirSync(dirname(copy.destination), { recursive: true });
      copyFileSync(copy.source, copy.destination, constants.COPYFILE_EXCL);
      created.push(copy.destination);
    }

    const currentPlatform = registry.platforms.find((platform) => platform.id === candidate.style.platform);
    let nextPlatforms;
    if (currentPlatform) {
      nextPlatforms = registry.platforms.map((platform) => (
        platform.id === candidate.style.platform && candidate.style.makeDefault === true
          ? { ...platform, defaultStyleId: candidate.style.id }
          : platform
      ));
    } else {
      const baseline = PLATFORM_BASELINES[candidate.style.platform];
      const registration = platformRegistrations[candidate.style.platform];
      invariant(registration, `Installer cannot register platform ${candidate.style.platform}`);
      nextPlatforms = [
        ...registry.platforms,
        {
          id: candidate.style.platform,
          specPlatform: baseline.specPlatform,
          displayName: registration.displayName,
          defaultStyleId: candidate.style.id,
          canvas: {
            width: baseline.width,
            height: baseline.height,
            ratio: baseline.ratio,
            orientation: baseline.orientation,
            ...(baseline.sizing ? { sizing: baseline.sizing } : {}),
            ...(baseline.minShortEdge ? { minShortEdge: baseline.minShortEdge } : {})
          },
          routingPhrases: [...registration.routingPhrases]
        }
      ];
    }

    const nextRegistry = {
      ...registry,
      platforms: nextPlatforms,
      styles: [
        ...registry.styles,
        {
          id: candidate.style.id,
          displayName: candidate.style.displayName,
          platform: candidate.style.platform,
          styleFile: spec.styleFile,
          specFile: validation.destinations.specFile,
          styleReference: spec.styleReference.image,
          provenanceFile: validation.destinations.provenanceFile,
          aliases: candidate.style.aliases,
          defaultUse: candidate.style.defaultUse
        }
      ]
    };
    writeAtomic(validation.registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`);
    generateStyleIndex({ registryPath: validation.registryPath, outputPath: indexPath });
    validateInstalledRegistry({ skillRoot: resolvedSkillRoot, registryPath: validation.registryPath });

    const installedCandidate = {
      ...candidate,
      status: "installed"
    };
    writeAtomic(validation.candidatePath, `${JSON.stringify(installedCandidate, null, 2)}\n`);

    return {
      styleId: candidate.style.id,
      styleFile: validation.destinations.styleFile,
      specFile: validation.destinations.specFile,
      styleReference: validation.destinations.styleReference,
      provenanceFile: validation.destinations.provenanceFile,
      defaultStyleId: nextPlatforms.find((platform) => platform.id === candidate.style.platform).defaultStyleId,
      registryPath: validation.registryPath,
      indexPath
    };
  } catch (error) {
    const rollbackErrors = [];
    for (const filePath of created.reverse()) {
      try {
        rmSync(filePath, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    for (const [filePath, existed, content] of [
      [validation.registryPath, true, registryBefore],
      [indexPath, indexExisted, indexBefore],
      [validation.candidatePath, true, candidateBefore]
    ]) {
      try {
        restoreFile(filePath, existed, content);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    const suffix = rollbackErrors.length ? ` Rollback errors: ${rollbackErrors.join("; ")}` : "";
    throw new Error(`Style installation failed: ${error.message}.${suffix}`);
  }
}

export function installStyleBundle({ bundleDir, skillRoot = defaultSkillRoot, registryPath } = {}) {
  const resolvedSkillRoot = resolve(skillRoot);
  const lockPath = resolve(resolvedSkillRoot, ".style-install.lock");
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Another style installation is in progress: ${lockPath}`);
    throw error;
  }
  try {
    return installStyleBundleLocked({ bundleDir, skillRoot: resolvedSkillRoot, registryPath });
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const argument = argv[index];
    const value = argv[index + 1];
    if ((argument !== "--bundle" && argument !== "--skill-root" && argument !== "--registry") || !value || value.startsWith("--")) {
      throw new Error(`Invalid argument near ${argument ?? "<end>"}`);
    }
    args[argument.slice(2)] = value;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  invariant(args.bundle, "--bundle is required");
  const result = installStyleBundle({
    bundleDir: resolve(args.bundle),
    skillRoot: args["skill-root"] ? resolve(args["skill-root"]) : defaultSkillRoot,
    registryPath: args.registry ? resolve(args.registry) : undefined
  });
  console.log(JSON.stringify({ installed: true, style_id: result.styleId }, null, 2));
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
