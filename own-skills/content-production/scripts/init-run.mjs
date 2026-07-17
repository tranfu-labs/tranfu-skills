#!/usr/bin/env node
import { basename, join } from 'node:path';
import { copyFile } from 'node:fs/promises';
import {
  emitJson,
  ensureDir,
  expandPath,
  fileSha256,
  fileExists,
  gateOrder,
  inspectCapabilities,
  parseArgs,
  platforms,
  readText,
  sha256,
  skillDir,
  slugify,
  stageOrder,
  todayStamp,
  uniqueRunDir,
  variants,
  writeJson,
  writeText
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const brief = typeof args.brief === 'string' ? args.brief.trim() : '';
const topic = typeof args.topic === 'string' ? args.topic.trim() : '';
const outlineText = typeof args.outline_text === 'string' ? args.outline_text.trim() : '';
const rawSlug = args._[0] || topic || brief || 'content-run';
const root = expandPath(args.root || join(skillDir, 'runs'));
const capabilitiesPath = expandPath(args.capabilities || join(skillDir, 'capabilities.yaml'));
const audiencePath = expandPath(args.core_audience || join(skillDir, 'references', 'core-audience.md'));
const platformProfilesPath = expandPath(args.platform_profiles || join(skillDir, 'references', 'platform-profiles.json'));
const stylePath = expandPath(args.style_b || join(skillDir, 'references', 'style-b.md'));
const outlinePath = expandPath(args.outline);
const topicHistoryPath = expandPath(args.topic_history);
const articleAudiencePath = expandPath(args.article_audience);
const materials = (args.material || []).map((path) => expandPath(path));
const runMode = args.run_mode || 'autonomous';
const entryInputs = [brief && 'brief', topic && 'topic', outlinePath && 'outline', outlineText && 'outline_text'].filter(Boolean);
const entryBlockers = [];
if (!entryInputs.length) entryBlockers.push({ code: 'missing_entry_input', message: 'Provide exactly one of --brief, --topic, --outline, or --outline-text.' });
if (entryInputs.length > 1) entryBlockers.push({ code: 'ambiguous_entry_input', inputs: entryInputs, message: 'Provide only one creative entry input.' });
if (!['autonomous', 'reviewed'].includes(runMode)) entryBlockers.push({ code: 'invalid_run_mode', message: 'run-mode must be autonomous or reviewed.' });

const missingInputs = [
  ['core_audience', audiencePath],
  ['platform_profiles', platformProfilesPath],
  ['style_b', stylePath],
  ...(outlinePath ? [['outline', outlinePath]] : []),
  ...(topicHistoryPath ? [['topic_history', topicHistoryPath]] : []),
  ...(articleAudiencePath ? [['article_audience', articleAudiencePath]] : []),
  ...materials.map((path) => ['material', path])
].filter(([, path]) => !fileExists(path));

if (entryBlockers.length || missingInputs.length) {
  emitJson({
    status: 'BLOCKED',
    blockers: [
      ...entryBlockers,
      ...missingInputs.map(([kind, path]) => ({ code: 'missing_input', kind, path }))
    ]
  }, 2);
} else {
  const capabilityReport = await inspectCapabilities(capabilitiesPath);
  const slug = slugify(rawSlug);
  await ensureDir(root);
  const runDir = uniqueRunDir(root, `${todayStamp()}-${slug}`);

  const directories = [
    '00-intake/raw', '01-discovery', '02-research', '03-outline', '06-selection', '07-visual/wechat-cover', '09-qa',
    ...variants.flatMap((variant) => [`04-masters/${variant}/reviews`]),
    ...platforms.flatMap((platform) => [
      ...variants.map((variant) => `05-platforms/${platform}/${variant}/reviews`),
      `07-visual/${platform}`,
      `08-publish-pack/${platform}/images`
    ])
  ];
  await Promise.all(directories.map((path) => ensureDir(join(runDir, path))));

  const audience = await readText(audiencePath);
  const style = await readText(stylePath);
  const platformProfiles = JSON.parse(await readText(platformProfilesPath));
  await copyFile(audiencePath, join(runDir, '00-intake', 'core-audience.md'));
  await copyFile(platformProfilesPath, join(runDir, '00-intake', 'platform-profiles.json'));
  await copyFile(stylePath, join(runDir, '00-intake', 'style-b.md'));
  if (topicHistoryPath) {
    await copyFile(topicHistoryPath, join(runDir, '00-intake', 'topic-history.md'));
  } else {
    await writeText(join(runDir, '00-intake', 'topic-history.md'), '# 历史选题\n\n未提供；按空集合处理。');
  }
  if (articleAudiencePath) {
    await copyFile(articleAudiencePath, join(runDir, '00-intake', 'article-audience.md'));
  } else {
    await writeText(join(runDir, '00-intake', 'article-audience.md'), '# 本篇细分受众\n\n未单独指定；不增加细分覆盖层。');
  }
  await writeJson(join(runDir, '00-intake', 'capabilities.json'), capabilityReport);
  const briefPath = join(runDir, '00-intake', 'brief.md');
  const entryBody = outlinePath || outlineText
    ? '# 创作简述\n\n用户提供创作大纲，按大纲入口处理。'
    : `# 创作简述\n\n${topic || brief}`;
  await writeText(briefPath, entryBody);

  const materialItems = [];
  for (const [index, source] of materials.entries()) {
    const targetName = `${String(index + 1).padStart(2, '0')}-${basename(source)}`;
    const target = join(runDir, '00-intake', 'raw', targetName);
    await copyFile(source, target);
    materialItems.push({
      id: `m-${String(index + 1).padStart(3, '0')}`,
      original_path: source,
      snapshot_path: `raw/${targetName}`,
      sha256: await fileSha256(source)
    });
  }
  await writeJson(join(runDir, '00-intake', 'materials.json'), { items: materialItems, notes: [] });
  const materialsManifestPath = join(runDir, '00-intake', 'materials.json');

  if (outlinePath) await copyFile(outlinePath, join(runDir, '03-outline', 'provided-outline.md'));
  if (outlineText) await writeText(join(runDir, '03-outline', 'provided-outline.md'), outlineText);

  const now = new Date().toISOString();
  const gates = Object.fromEntries(gateOrder.map((gate) => [gate, {
    status: 'pending', revision: 0, decision_ref: null, bound_artifacts: [],
    approval_mode: null, approved_at: null, updated_at: null
  }]));
  const hasOutline = Boolean(outlinePath || outlineText);
  if (topic) {
    gates.topic = {
      status: 'approved', revision: 1,
      decision_ref: { inline: topic, sha256: sha256(topic) },
      bound_artifacts: [], approval_mode: 'user_preselected', actor: 'user-explicit-input',
      approved_at: now, updated_at: now
    };
  } else if (hasOutline) {
    gates.topic = {
      status: 'approved', revision: 1,
      decision_ref: { inline: 'provided-outline', sha256: sha256('provided-outline') },
      bound_artifacts: [{ path: '03-outline/provided-outline.md', sha256: await fileSha256(join(runDir, '03-outline', 'provided-outline.md')) }],
      approval_mode: 'outline_preauthorized', actor: 'fast-path', approved_at: now, updated_at: now
    };
  }

  let discoverySkip = null;
  if (gates.topic.status === 'approved') {
    const skipPath = join(runDir, '01-discovery', 'skip.json');
    await writeJson(skipPath, {
      stage: 'discovery', status: 'SKIPPED',
      mode: hasOutline ? 'outline_provided' : 'topic_provided',
      reason: hasOutline ? 'user_provided_outline' : 'user_provided_topic',
      input_sha256: hasOutline ? await fileSha256(join(runDir, '03-outline', 'provided-outline.md')) : sha256(topic),
      recorded_at: now
    });
    discoverySkip = { path: '01-discovery/skip.json', sha256: await fileSha256(skipPath) };
  }


  const state = {
    schema_version: 2,
    run_id: basename(runDir),
    slug,
    created_at: now,
    updated_at: now,
    status: capabilityReport.status === 'PASS' ? 'running' : 'blocked',
    current_stage: capabilityReport.status === 'PASS'
      ? (gates.topic.status === 'approved' ? 'research' : 'discovery')
      : 'init',
    mode: hasOutline ? 'outline_provided' : topic ? 'topic_provided' : 'brief',
    input_mode: hasOutline ? 'outline' : topic ? 'topic' : 'brief',
    run_mode: runMode,
    capabilities: {
      config_path: capabilitiesPath,
      config_sha256: fileExists(capabilitiesPath) ? await fileSha256(capabilitiesPath) : null,
      status: capabilityReport.status,
      providers: Object.fromEntries(capabilityReport.capabilities.map((item) => [item.id, {
        skill_path: item.skill_path,
        skill_sha256: item.skill_sha256,
        status: item.status,
        required: item.required,
        contract: item.contract
      }]))
    },
    snapshots: {
      brief: { source_path: outlinePath, snapshot_path: '00-intake/brief.md', sha256: await fileSha256(briefPath) },
      core_audience: { source_path: audiencePath, snapshot_path: '00-intake/core-audience.md', sha256: sha256(audience) },
      platform_profiles: {
        source_path: platformProfilesPath,
        snapshot_path: '00-intake/platform-profiles.json',
        sha256: await fileSha256(join(runDir, '00-intake', 'platform-profiles.json')),
        version: platformProfiles.profile_set?.version || null
      },
      style_b: { source_path: stylePath, snapshot_path: '00-intake/style-b.md', sha256: sha256(style) },
      topic_history: {
        source_path: topicHistoryPath,
        snapshot_path: '00-intake/topic-history.md',
        sha256: await fileSha256(join(runDir, '00-intake', 'topic-history.md')),
        empty: !topicHistoryPath
      },
      article_audience: {
        source_path: articleAudiencePath,
        snapshot_path: '00-intake/article-audience.md',
        sha256: await fileSha256(join(runDir, '00-intake', 'article-audience.md')),
        empty: !articleAudiencePath
      },
      materials: { snapshot_path: '00-intake/materials.json', sha256: await fileSha256(materialsManifestPath) }
    },
    stages: Object.fromEntries(stageOrder.map((stage) => [stage, {
      status: stage === 'init'
        ? (capabilityReport.status === 'PASS' ? 'completed' : 'blocked')
        : stage === 'discovery' && discoverySkip && capabilityReport.status === 'PASS' ? 'completed' : 'pending',
      attempt: stage === 'init' ? 1 : 0,
      artifacts: stage === 'discovery' && discoverySkip && capabilityReport.status === 'PASS' ? [discoverySkip] : [], error: null
    }])),
    gates,
    platform_selections: {},
    resume: {
      next_stage: capabilityReport.status === 'PASS' ? (gates.topic.status === 'approved' ? 'research' : 'discovery') : 'init',
      reason: capabilityReport.status === 'PASS' ? 'first_incomplete' : 'capability_blocked'
    },
    invalidations: [],
    history: [{ at: now, event: 'run_initialized', status: capabilityReport.status }]
  };
  await writeJson(join(runDir, 'run.json'), state);

  emitJson({ status: state.status.toUpperCase(), run_dir: runDir, capability_status: capabilityReport.status }, capabilityReport.status === 'PASS' ? 0 : 2);
}
