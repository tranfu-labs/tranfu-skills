#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

export function resolveBrandPolicy(styleSpec, override = "null") {
  if (!["enabled", "disabled", "null"].includes(override)) {
    throw new Error("Brand override must be enabled, disabled, or null");
  }

  const slot = styleSpec.fixedComponents?.brandSlot;
  if (!slot?.enabled || slot.anchor !== "top-right") {
    throw new Error(`Style Spec ${styleSpec.id ?? "<unknown>"} has no enabled top-right brandSlot`);
  }

  const hasPolicy = styleSpec.brandPolicy !== undefined;
  const policy = styleSpec.brandPolicy ?? {
    defaultEnabled: true,
    userOverrideAllowed: true
  };
  if (typeof policy.defaultEnabled !== "boolean" || typeof policy.userOverrideAllowed !== "boolean") {
    throw new Error(`Style Spec ${styleSpec.id ?? "<unknown>"} has an invalid brandPolicy`);
  }
  if (override !== "null" && !policy.userOverrideAllowed) {
    throw new Error(`Style Spec ${styleSpec.id ?? "<unknown>"} does not allow brand overrides`);
  }

  if (override !== "null") {
    return {
      brand_enabled: override === "enabled",
      brand_policy_default_enabled: policy.defaultEnabled,
      brand_override: override,
      brand_policy_source: "user-override"
    };
  }

  return {
    brand_enabled: policy.defaultEnabled,
    brand_policy_default_enabled: policy.defaultEnabled,
    brand_override: null,
    brand_policy_source: hasPolicy ? "style-default" : "legacy-default"
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args["style-spec"]) {
    throw new Error("Usage: resolve-brand-policy.mjs --style-spec <path> [--override enabled|disabled|null]");
  }
  const specPath = resolve(args["style-spec"]);
  if (!existsSync(specPath)) {
    throw new Error(`Style Spec is missing: ${specPath}`);
  }
  const styleSpec = JSON.parse(readFileSync(specPath, "utf8"));
  console.log(JSON.stringify(resolveBrandPolicy(styleSpec, args.override ?? "null"), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
