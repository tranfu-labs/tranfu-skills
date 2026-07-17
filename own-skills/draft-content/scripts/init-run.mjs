#!/usr/bin/env node

import { access, copyFile, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCHEMA_VERSION,
  appendEvent,
  atomicWriteJson,
  failJson,
  isDirectory,
  isRegularFile,
  localRunTimestamp,
  nowIso,
  parseArgs,
  printJson,
  sha256File,
  slugify,
  toRunRelative,
} from "./_lib.mjs";

const HELP = `draft-content init-run

Usage:
  node init-run.mjs [options]

Standard mode (default):
  --topic-plan PATH       Explicit PASS ContentTopicPlan Markdown file
  --research-dir PATH     Explicit collect-sources package directory
  --research-run RUN-ID   Select a run from the package (requires or auto-finds its directory)

Equivalent-input mode:
  --mode equivalent       Select equivalent-input mode explicitly
  --topic TEXT            Required topic; also selects equivalent mode when --mode is omitted
  --material PATH         Required readable material file; repeat for more files
  --audience TEXT         Required target audience
  --outline PATH          Optional user outline to snapshot as input

Common options:
  --mode MODE             standard | equivalent
  --workdir PATH          Project work directory (default: current directory)
  --execution-mode MODE   parallel_subagents (default) | sequential_fallback
  --help                  Show this help

The command prints JSON. NEEDS_INPUT_SELECTION and NEEDS_UPSTREAM do not create a run.`;

const RESEARCH_FILES = ["00-research-brief.md", "01-source-notes.md", "02-editorial-brief.md"];
const SKIP_DIRECTORIES = new Set([".git", "node_modules", "03-内容创作"]);

function normalizeTopic(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[`*_>#\[\](){}：:，,。.!！?？、\s\-—_]+/gu, "");
}

function topicMatches(left, right) {
  const a = normalizeTopic(left);
  const b = normalizeTopic(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const grams = (value) => {
    const result = new Set();
    if (value.length === 1) result.add(value);
    for (let index = 0; index < value.length - 1; index += 1) result.add(value.slice(index, index + 2));
    return result;
  };
  const aa = grams(a);
  const bb = grams(b);
  let overlap = 0;
  for (const gram of aa) if (bb.has(gram)) overlap += 1;
  const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const dice = (2 * overlap) / Math.max(1, aa.size + bb.size);
  return lengthRatio >= 0.75 && dice >= 0.82;
}

function parseTimestamp(value) {
  if (!value) return Number.NaN;
  const normalized = value
    .trim()
    .replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:)/, "$1T$2");
  return Date.parse(normalized);
}

function frontmatter(markdown) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(markdown);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z_][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (field) result[field[1]] = field[2].replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function firstCapture(markdown, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(markdown);
    if (match?.[1]?.trim()) return match[1].trim().replace(/^['"`]|['"`]$/g, "");
  }
  return null;
}

async function parseTopicPlan(filePath) {
  const absolutePath = path.resolve(filePath);
  const markdown = await readFile(absolutePath, "utf8");
  const metadata = frontmatter(markdown);
  const fileStat = await stat(absolutePath);
  const topic = firstCapture(markdown, [
    /^###\s+标题原型\s*\r?\n(?!\s*[-#|])\s*([^\r\n]+)/m,
    /^-\s*标题原型[：:]\s*([^\r\n]+)/m,
    /^-\s*核心角度[：:]\s*([^\r\n]+)/m,
  ]);
  const audience = firstCapture(markdown, [/^-\s*目标人群[：:]\s*([^\r\n]+)/m]);
  const contentForm = firstCapture(markdown, [/^-\s*内容形式[：:]\s*([^\r\n]+)/m]);
  return {
    path: absolutePath,
    artifact: metadata.artifact,
    status: metadata.status,
    generated_at: metadata.generated_at ?? null,
    sort_time: Number.isFinite(parseTimestamp(metadata.generated_at)) ? parseTimestamp(metadata.generated_at) : fileStat.mtimeMs,
    topic,
    audience,
    content_form: contentForm,
  };
}

async function walk(root, maxDepth = 5) {
  const files = [];
  const directories = [];
  async function visit(directory, depth) {
    directories.push(directory);
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await visit(entryPath, depth + 1);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }
  await visit(root, 0);
  return { files, directories };
}

async function discoverTopicPlans(workdir, explicitPath, inventory) {
  if (explicitPath) {
    if (!(await isRegularFile(explicitPath))) throw new Error(`Topic plan is not a readable file: ${path.resolve(explicitPath)}`);
    const candidate = await parseTopicPlan(explicitPath);
    return { explicit: true, candidates: [candidate] };
  }
  const candidates = [];
  for (const filePath of inventory.files) {
    if (!filePath.endsWith(".md")) continue;
    let prefix;
    try {
      prefix = (await readFile(filePath, "utf8")).slice(0, 4096);
    } catch {
      continue;
    }
    if (!/artifact:\s*ContentTopicPlan\b/.test(prefix)) continue;
    try {
      candidates.push(await parseTopicPlan(filePath));
    } catch {
      // Ignore unreadable discovery candidates. Explicit candidates fail above.
    }
  }
  return { explicit: false, candidates };
}

function splitRunSections(markdown) {
  const headings = [...markdown.matchAll(/^##\s+(RUN-\d{8}-\d{6})\s*$/gm)];
  const result = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const start = headings[index].index;
    const end = headings[index + 1]?.index ?? markdown.length;
    result.set(headings[index][1], markdown.slice(start, end));
  }
  return result;
}

function field(section, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^-\\s*${escaped}[：:]\\s*([^\\r\\n]+)`, "m").exec(section)?.[1]?.trim() ?? null;
}

function readyLedgerCount(section) {
  const lines = section.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^\s*\|/.test(line) && /Claim ID/i.test(line) && /使用门禁/.test(line));
  if (headerIndex < 0) return 0;
  const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((value) => value.trim());
  const headers = cells(lines[headerIndex]);
  const claimIndex = headers.findIndex((value) => /Claim ID/i.test(value));
  const gateIndex = headers.findIndex((value) => value === "使用门禁");
  if (claimIndex < 0 || gateIndex < 0) return 0;
  let count = 0;
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^#{1,6}\s/.test(line)) break;
    if (!/^\s*\|/.test(line)) continue;
    const row = cells(line);
    if (/^CLM-/i.test(row[claimIndex] ?? "") && (row[gateIndex] ?? "").toLocaleLowerCase() === "ready") count += 1;
  }
  return count;
}

async function parseResearchPackage(directory) {
  const absoluteDirectory = path.resolve(directory);
  const paths = Object.fromEntries(RESEARCH_FILES.map((name) => [name, path.join(absoluteDirectory, name)]));
  for (const filePath of Object.values(paths)) {
    if (!(await isRegularFile(filePath))) throw new Error(`Incomplete collect-sources package; missing ${filePath}`);
  }
  const [researchText, sourceText, editorialText] = await Promise.all(RESEARCH_FILES.map((name) => readFile(paths[name], "utf8")));
  const researchRuns = splitRunSections(researchText);
  const sourceRuns = splitRunSections(sourceText);
  const editorialRuns = splitRunSections(editorialText);
  const runs = [];
  for (const [runId, researchSection] of researchRuns) {
    const sourceSection = sourceRuns.get(runId);
    const editorialSection = editorialRuns.get(runId);
    const researchStatus = field(researchSection, "状态");
    const editorialStatus = editorialSection ? field(editorialSection, "状态") : null;
    const declaredReadyText = editorialSection ? field(editorialSection, "Ready 主张数") : null;
    const declaredReady = declaredReadyText !== null && /^\d+$/.test(declaredReadyText) ? Number(declaredReadyText) : null;
    const readyClaims = editorialSection ? readyLedgerCount(editorialSection) : 0;
    const readyCountConsistent = declaredReady !== null && declaredReady === readyClaims;
    const topic = field(researchSection, "主题");
    const valid = Boolean(
      sourceSection &&
      editorialSection &&
      ["complete", "partial"].includes(researchStatus) &&
      editorialStatus === researchStatus &&
      readyCountConsistent &&
      readyClaims > 0 &&
      topic,
    );
    const reasons = [];
    if (!sourceSection || !editorialSection) reasons.push("run_missing_from_package_file");
    if (!["complete", "partial"].includes(researchStatus)) reasons.push(`research_status_${researchStatus ?? "missing"}`);
    if (editorialSection && editorialStatus !== researchStatus) reasons.push("status_mismatch");
    if (declaredReady === null) reasons.push("ready_count_missing_or_invalid");
    else if (!readyCountConsistent) reasons.push("ready_count_mismatch");
    if (readyClaims <= 0) reasons.push("zero_ready_claims");
    if (!topic) reasons.push("missing_topic");
    runs.push({
      directory: absoluteDirectory,
      run_id: runId,
      status: researchStatus,
      editorial_status: editorialStatus,
      topic,
      ready_claims: readyClaims,
      valid,
      reasons,
      sort_time: Number(runId.replace(/\D/g, "")),
      files: paths,
    });
  }
  return runs;
}

async function discoverResearchRuns(workdir, explicitDirectory, inventory) {
  let directories;
  if (explicitDirectory) {
    let resolved = path.resolve(explicitDirectory);
    if (await isRegularFile(resolved)) resolved = path.dirname(resolved);
    if (!(await isDirectory(resolved))) throw new Error(`Research package is not a directory: ${resolved}`);
    directories = [resolved];
  } else {
    directories = inventory.directories.filter((directory) => RESEARCH_FILES.every((name) => inventory.files.includes(path.join(directory, name))));
  }
  const runs = [];
  for (const directory of directories) {
    try {
      runs.push(...(await parseResearchPackage(directory)));
    } catch (error) {
      if (explicitDirectory) throw error;
    }
  }
  return { explicit: Boolean(explicitDirectory), runs };
}

function candidateSummary(candidate) {
  return {
    path: candidate.path,
    status: candidate.status,
    generated_at: candidate.generated_at,
    topic: candidate.topic,
  };
}

function researchSummary(candidate) {
  return {
    directory: candidate.directory,
    run_id: candidate.run_id,
    status: candidate.status,
    editorial_status: candidate.editorial_status,
    topic: candidate.topic,
    ready_claims: candidate.ready_claims,
    reasons: candidate.reasons,
  };
}

async function resolveStandardInputs(options, workdir) {
  const inventory = await walk(workdir);
  const topicDiscovery = await discoverTopicPlans(workdir, options["topic-plan"], inventory);
  const passPlans = topicDiscovery.candidates.filter((candidate) => candidate.artifact === "ContentTopicPlan" && candidate.status === "PASS" && candidate.topic);

  if (topicDiscovery.explicit && passPlans.length === 0) {
    return {
      terminal: {
        ok: false,
        status: "NEEDS_UPSTREAM",
        error: "The explicit ContentTopicPlan must have artifact=ContentTopicPlan, status=PASS, and a main topic",
        candidates: topicDiscovery.candidates.map(candidateSummary),
      },
    };
  }
  if (passPlans.length === 0) {
    return {
      terminal: {
        ok: false,
        status: "NEEDS_UPSTREAM",
        error: "No valid PASS ContentTopicPlan was found",
        candidates: topicDiscovery.candidates.map(candidateSummary),
      },
    };
  }

  const newestPlanTime = Math.max(...passPlans.map((candidate) => candidate.sort_time));
  const newestPlans = passPlans.filter((candidate) => candidate.sort_time === newestPlanTime);
  if (!topicDiscovery.explicit && newestPlans.length > 1) {
    return {
      terminal: {
        ok: false,
        status: "NEEDS_INPUT_SELECTION",
        error: "Multiple equally recent PASS ContentTopicPlan files were found; pass --topic-plan",
        candidates: newestPlans.map(candidateSummary),
      },
    };
  }
  const topicPlan = newestPlans[0];

  const researchDiscovery = await discoverResearchRuns(workdir, options["research-dir"], inventory);
  let relevantRuns = researchDiscovery.runs.filter((candidate) => topicMatches(topicPlan.topic, candidate.topic));
  if (options["research-run"]) relevantRuns = relevantRuns.filter((candidate) => candidate.run_id === options["research-run"]);
  const validRuns = relevantRuns.filter((candidate) => candidate.valid);

  if (validRuns.length === 0) {
    return {
      terminal: {
        ok: false,
        status: "NEEDS_UPSTREAM",
        error: options["research-run"]
          ? `Research run ${options["research-run"]} is missing, invalid, blocked, in progress, topic-mismatched, or has zero ready claims`
          : "No topic-matching complete/partial collect-sources run with ready claims was found",
        candidates: researchDiscovery.runs.map(researchSummary),
      },
    };
  }

  const newestRunTime = Math.max(...validRuns.map((candidate) => candidate.sort_time));
  const newestRuns = validRuns.filter((candidate) => candidate.sort_time === newestRunTime);
  const distinct = new Set(newestRuns.map((candidate) => `${candidate.directory}\0${candidate.run_id}`));
  if (distinct.size > 1) {
    return {
      terminal: {
        ok: false,
        status: "NEEDS_INPUT_SELECTION",
        error: "Multiple equally recent matching research runs were found; pass --research-dir and --research-run",
        candidates: newestRuns.map(researchSummary),
      },
    };
  }

  return { topicPlan, research: newestRuns[0] };
}

async function requireInputFile(value, label) {
  const absolutePath = path.resolve(value);
  if (!(await isRegularFile(absolutePath))) throw new Error(`${label} is not a readable file: ${absolutePath}`);
  return absolutePath;
}

async function reserveRunPath(base, stem) {
  await mkdir(base, { recursive: true });
  for (let suffix = 1; ; suffix += 1) {
    const name = suffix === 1 ? stem : `${stem}-${suffix}`;
    const candidate = path.join(base, name);
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }
}

async function snapshot(source, destination, runDir) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return {
    source_path: path.resolve(source),
    snapshot_path: toRunRelative(runDir, destination),
    sha256: await sha256File(destination),
  };
}

async function createRun({ workdir, mode, topic, audience, contentForm, topicPlan, research, materials, outline, executionMode }) {
  const styleSource = fileURLToPath(new URL("../references/style-b.md", import.meta.url));
  if (!(await isRegularFile(styleSource))) throw new Error(`Bundled B style reference is missing: ${styleSource}`);

  const outputBase = path.join(workdir, "03-内容创作");
  const stem = `${localRunTimestamp()}-${slugify(topic)}`;
  const finalRunDir = await reserveRunPath(outputBase, stem);
  const temporaryRunDir = `${finalRunDir}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  await mkdir(temporaryRunDir, { recursive: false });

  try {
    const inputDir = path.join(temporaryRunDir, "00-input");
    const inputs = {
      topic_plan: null,
      research: null,
      materials: [],
      supplied_outline: null,
      style_b: null,
    };

    if (topicPlan) {
      inputs.topic_plan = {
        ...(await snapshot(topicPlan.path, path.join(inputDir, "topic-plan.md"), temporaryRunDir)),
        status: topicPlan.status,
        topic: topicPlan.topic,
        generated_at: topicPlan.generated_at,
        content_form: topicPlan.content_form,
      };
    }

    if (research) {
      const files = [];
      for (const name of RESEARCH_FILES) {
        files.push(await snapshot(research.files[name], path.join(inputDir, "research", name), temporaryRunDir));
      }
      inputs.research = {
        source_directory: research.directory,
        run_id: research.run_id,
        status: research.status,
        topic: research.topic,
        ready_claims: research.ready_claims,
        files,
      };
    }

    for (let index = 0; index < materials.length; index += 1) {
      const source = materials[index];
      const filename = `${String(index + 1).padStart(3, "0")}-${path.basename(source)}`;
      inputs.materials.push({
        ...(await snapshot(source, path.join(inputDir, "materials", filename), temporaryRunDir)),
        trusted_as_fact_input: true,
      });
    }

    if (outline) {
      inputs.supplied_outline = await snapshot(outline, path.join(inputDir, "supplied-outline.md"), temporaryRunDir);
    }
    inputs.style_b = await snapshot(styleSource, path.join(inputDir, "style-b.md"), temporaryRunDir);

    const createdAt = nowIso();
    const manifest = {
      schema_version: SCHEMA_VERSION,
      skill: "draft-content",
      run_id: path.basename(finalRunDir),
      created_at: createdAt,
      updated_at: createdAt,
      status: "AWAITING_OUTLINE_APPROVAL",
      input_mode: mode,
      topic,
      audience: audience ?? null,
      content_form: contentForm ?? null,
      execution: { strategy: executionMode },
      inputs,
      outline_gate: {
        state: "unbound",
        path: null,
        sha256: null,
        version: null,
        approved_at: null,
        history: [],
      },
      artifacts: {
        valid: false,
        invalidated_at: null,
        reason: "outline_not_approved",
        invalidation_baseline: {},
        lineage_assurance: "deterministic_binding_not_causal_proof",
        masters: { A: null, B: null },
        platforms: Object.fromEntries(["wechat", "xiaohongshu", "zhihu", "weibo", "toutiao"].map((platform) => [platform, { A: null, B: null }])),
      },
      events: [],
    };
    appendEvent(manifest, "run_initialized", { input_mode: mode, execution_strategy: executionMode });
    await atomicWriteJson(path.join(temporaryRunDir, "manifest.json"), manifest);
    await mkdir(path.join(temporaryRunDir, "01-outline"), { recursive: true });
    await mkdir(path.join(temporaryRunDir, "02-masters"), { recursive: true });
    for (const platform of ["wechat", "xiaohongshu", "zhihu", "weibo", "toutiao"]) {
      await mkdir(path.join(temporaryRunDir, "03-platforms", platform), { recursive: true });
    }
    await mkdir(path.join(temporaryRunDir, "04-qa"), { recursive: true });
    await rename(temporaryRunDir, finalRunDir);
    return { runDir: finalRunDir, manifest };
  } catch (error) {
    await rm(temporaryRunDir, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), {
      values: ["mode", "workdir", "topic-plan", "research-dir", "research-run", "topic", "audience", "outline", "execution-mode"],
      repeatable: ["material"],
    });
  } catch (error) {
    failJson(error);
    return;
  }
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (options._.length > 0) {
    failJson(new Error(`Unexpected positional arguments: ${options._.join(" ")}`));
    return;
  }

  try {
    const workdir = path.resolve(options.workdir ?? process.cwd());
    if (!(await isDirectory(workdir))) throw new Error(`Work directory does not exist: ${workdir}`);
    const inferredMode = options.topic || options.material?.length ? "equivalent" : "standard";
    const mode = options.mode ?? inferredMode;
    if (!new Set(["standard", "equivalent"]).has(mode)) throw new Error("--mode must be standard or equivalent");
    const executionMode = options["execution-mode"] ?? "parallel_subagents";
    if (!new Set(["parallel_subagents", "sequential_fallback"]).has(executionMode)) {
      throw new Error("--execution-mode must be parallel_subagents or sequential_fallback");
    }

    let topic;
    let audience = options.audience ?? null;
    let contentForm = null;
    let topicPlan = null;
    let research = null;
    let materials = [];
    let outline = null;

    if (mode === "standard") {
      if (options.topic || options.material?.length || options.audience) {
        throw new Error("--topic, --material, and --audience belong to equivalent mode");
      }
      const resolved = await resolveStandardInputs(options, workdir);
      if (resolved.terminal) {
        printJson(resolved.terminal);
        process.exitCode = 2;
        return;
      }
      topicPlan = resolved.topicPlan;
      research = resolved.research;
      topic = topicPlan.topic;
      audience = topicPlan.audience;
      contentForm = topicPlan.content_form;
    } else {
      if (options["topic-plan"] || options["research-dir"] || options["research-run"]) {
        throw new Error("Standard upstream options cannot be combined with equivalent mode");
      }
      topic = options.topic?.trim();
      if (!topic) throw new Error("Equivalent mode requires --topic");
      if (!options.material?.length) throw new Error("Equivalent mode requires at least one --material");
      audience = options.audience?.trim();
      if (!audience) {
        printJson({
          ok: false,
          status: "NEEDS_UPSTREAM",
          error: "Equivalent mode requires --audience",
        });
        process.exitCode = 2;
        return;
      }
      materials = await Promise.all(options.material.map((value) => requireInputFile(value, "Material")));
    }
    if (options.outline) outline = await requireInputFile(options.outline, "Outline");

    const result = await createRun({
      workdir,
      mode,
      topic,
      audience,
      contentForm,
      topicPlan,
      research,
      materials,
      outline,
      executionMode,
    });
    printJson({
      ok: true,
      status: result.manifest.status,
      run_dir: result.runDir,
      manifest: path.join(result.runDir, "manifest.json"),
      next_stage: "create_or_optimize_outline",
    });
  } catch (error) {
    failJson(error);
  }
}

await main();
