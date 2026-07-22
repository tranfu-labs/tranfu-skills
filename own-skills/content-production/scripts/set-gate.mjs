#!/usr/bin/env node
import { basename, join } from 'node:path';
import {
  titleAggregatePaths,
  validateTitleGenerationStage,
  validateTitlesAndSelection,
  validateTopicDecision
} from './contracts.mjs';
import { illustrationPaths, validateIllustrationPlans } from './illustration-contracts.mjs';
import {
  decisionPathForAttempt,
  validateCurrentVisualDecision
} from './visual-cardinality.mjs';
import {
  artifactBinding,
  emitJson,
  expandPath,
  fileExists,
  fileSha256,
  gateIntegrity,
  gateInvalidatesFrom,
  gateOrder,
  parseArgs,
  platforms,
  readJson,
  relativeTo,
  sha256,
  stageOrder,
  verifyQaFingerprints,
  writeJson
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const [runArg, gate, status] = args._;
const allowedStatuses = ['pending', 'awaiting_approval', 'approved', 'blocked'];

function sameBindings(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

async function decisionRef(runDir, input, fallback) {
  if (input === undefined) return fallback || null;
  const path = expandPath(input, runDir);
  if (fileExists(path)) return { path: relativeTo(runDir, path), sha256: await fileSha256(path) };
  return { inline: input, sha256: sha256(input) };
}

async function defaultArtifacts(runDir, gateName, state) {
  if (gateName === 'outline' && state?.schema_version === 2
    && state.stages?.outline?.status === 'completed') {
    return Promise.all((state.stages.outline.artifacts || []).map((binding) => artifactBinding(runDir, binding.path)));
  }
  if (gateName === 'titles' && state?.schema_version === 2
    && state.stages?.titles?.status === 'completed') {
    const active = (state.stages.titles.artifacts || []).filter((binding) =>
      /(?:^|\/)titles(?:\.v\d{3})?\.json$/.test(binding.path)
      || /(?:^|\/)title-matrix(?:\.v\d{3})?\.md$/.test(binding.path));
    return Promise.all(active.map((binding) => artifactBinding(runDir, binding.path)));
  }
  const candidates = {
    outline: ['03-outline/control-outline.md', '03-outline/A-structure.md', '03-outline/B-structure.md'],
    titles: ['06-selection/titles.json', '06-selection/title-matrix.md'],
    visual: platforms.flatMap((platform) => {
      const paths = illustrationPaths(state, platform);
      return [paths.plan, paths.shotList];
    }),
    final: ['09-qa/qa.json', '09-qa/qa.md', '09-qa/handoff.md']
  }[gateName] || [];
  const bindings = [];
  for (const path of candidates) {
    if (fileExists(join(runDir, path))) bindings.push(await artifactBinding(runDir, path));
  }
  return bindings;
}

if (!runArg || !gateOrder.includes(gate) || !allowedStatuses.includes(status)) {
  emitJson({ status: 'BLOCKED', message: 'Usage: set-gate.mjs <run-dir> <gate> <pending|awaiting_approval|approved|blocked> [--decision value-or-file] [--artifact path]' }, 2);
} else {
  try {
    const runDir = expandPath(runArg);
    const statePath = join(runDir, 'run.json');
    const state = await readJson(statePath);
    const runMode = state.run_mode || 'reviewed';
    if (runMode === 'autonomous' && status === 'awaiting_approval') {
      throw new Error(`Autonomous runs do not pause at ${gate}; create the decision artifact and approve it with actor=orchestrator.`);
    }
    const gateIndex = gateOrder.indexOf(gate);
    const integrityIssues = await gateIntegrity(runDir, state);
    if (integrityIssues.length) {
      throw Object.assign(new Error('An approved gate artifact changed or disappeared; create a new version without overwriting the approved file.'), { issues: integrityIssues });
    }

    if (status === 'approved') {
      const missingPrior = gateOrder.slice(0, gateIndex).filter((name) => state.gates?.[name]?.status !== 'approved');
      if (missingPrior.length) throw new Error(`Cannot approve ${gate}; prior gates not approved: ${missingPrior.join(', ')}`);
      const producerStage = { topic: 'discovery', outline: 'outline', titles: 'titles', visual: 'visual', final: 'final_qa' }[gate];
      const requiredProducerStatus = gate === 'visual' ? 'running' : 'completed';
      if (state.stages && state.stages[producerStage]?.status !== requiredProducerStatus) {
        throw new Error(`Cannot approve ${gate}; producer stage ${producerStage} is not ${requiredProducerStatus}.`);
      }
    }

    const previous = state.gates?.[gate] || { status: 'pending', revision: 0, decision_ref: null, bound_artifacts: [] };
    let nextDecision = await decisionRef(runDir, args.decision, previous.decision_ref);
    let nextBindings = args.artifact?.length
      ? await Promise.all(args.artifact.map((path) => artifactBinding(runDir, path)))
      : previous.bound_artifacts?.length ? previous.bound_artifacts : await defaultArtifacts(runDir, gate, state);

    if (status === 'approved' && gate === 'outline' && state.schema_version === 2 && !nextDecision?.path) {
      nextDecision = nextBindings.find((binding) => /^control-outline(?:\.v\d{3})?\.md$/.test(basename(binding.path))) || null;
    }

    if (status === 'approved' && !args.artifact?.length && previous.status !== 'approved') {
      nextBindings = await Promise.all(nextBindings.map((binding) => artifactBinding(runDir, binding.path)));
    }

    if (nextDecision?.path) {
      nextBindings = nextBindings.filter((binding) => binding.path !== nextDecision.path);
      if (gate !== 'visual') nextBindings = [...nextBindings, nextDecision];
    }
    if (status === 'approved' && gate !== 'topic' && !nextBindings.length) {
      throw new Error(`${gate} approval must bind at least one versioned artifact.`);
    }

    if (status === 'approved' && gate === 'outline') {
      if (!nextDecision?.path || !/^control-outline(?:\.v\d{3})?\.md$/.test(basename(nextDecision.path))) {
        throw new Error('Outline approval requires --decision pointing to control-outline.md or control-outline.vNNN.md.');
      }
      for (const variant of ['A', 'B']) {
        const pattern = new RegExp(`^${variant}-structure(?:\\.v\\d{3})?\\.md$`);
        if (!nextBindings.some((binding) => pattern.test(basename(binding.path)))) {
          throw new Error(`Outline approval must bind ${variant}-structure.md or a versioned equivalent.`);
        }
      }
      if (state.schema_version === 2) {
        const completed = state.stages?.outline?.artifacts || [];
        const completedByPath = new Map(completed.map((binding) => [binding.path, binding.sha256]));
        const activeByPath = new Map(nextBindings.map((binding) => [binding.path, binding.sha256]));
        const revisionOf = (path) => basename(path).match(/\.v(\d{3})\./)?.[1] || '001';
        const versions = new Set(nextBindings.map((binding) => revisionOf(binding.path)));
        const exactCompletedPackage = completed.length === 3
          && nextBindings.length === 3
          && completedByPath.size === 3
          && activeByPath.size === 3
          && [...completedByPath].every(([path, hash]) => activeByPath.get(path) === hash);
        if (!exactCompletedPackage) {
          throw new Error('Outline approval must bind exactly the completed three-file outline package.');
        }
        if (versions.size !== 1 || revisionOf(nextDecision.path) !== [...versions][0]) {
          throw new Error('Control outline and both branch structures must use the same revision.');
        }
        if (completedByPath.get(nextDecision.path) !== nextDecision.sha256) {
          throw new Error('Outline decision must be the control outline from the completed outline stage.');
        }
      }
    }

    if (status === 'approved' && gate === 'topic' && nextDecision?.path) {
      const candidatesBinding = nextBindings.find((binding) => /^topic-candidates(?:\.v\d{3})?\.json$/.test(basename(binding.path)));
      if (!candidatesBinding) throw new Error('Topic approval with a decision file must bind topic-candidates.json or a versioned equivalent.');
      const result = await validateTopicDecision(runDir, nextDecision.path, candidatesBinding.path);
      if (result.issues.length) throw Object.assign(new Error('Topic candidates or decision violate the contract.'), { issues: result.issues });
    }

    if (status === 'approved' && gate === 'titles') {
      if (!nextDecision?.path) throw new Error('Titles approval requires --decision pointing to selection.vNNN.json.');
      const titlesBinding = nextBindings.find((binding) => /^titles(?:\.v\d{3})?\.json$/.test(basename(binding.path)));
      if (!titlesBinding) throw new Error('Titles approval must bind titles.json or titles.vNNN.json.');
      const matrices = nextBindings.filter((binding) => /^title-matrix(?:\.v\d{3})?\.md$/.test(basename(binding.path)));
      if (matrices.length !== 1) throw new Error('Titles approval must bind exactly one title-matrix.md or title-matrix.vNNN.md.');
      const revisionOf = (path) => basename(path).match(/\.v(\d{3})\./)?.[1] || '001';
      if (revisionOf(titlesBinding.path) !== revisionOf(matrices[0].path)) throw new Error('titles JSON and title matrix must use the same revision.');
      if (revisionOf(nextDecision.path) !== revisionOf(titlesBinding.path)) throw new Error('selection decision, titles JSON, and title matrix must use the same revision.');
      if (state.schema_version === 2) {
        const expected = titleAggregatePaths(state);
        if (titlesBinding.path !== expected.titles_path || matrices[0].path !== expected.matrix_path
          || nextDecision.path !== expected.selection_path) {
          throw new Error('Titles approval must use the canonical aggregate and selection paths for the completed titles attempt.');
        }
        const completed = new Map((state.stages?.titles?.artifacts || []).map((binding) => [binding.path, binding.sha256]));
        if (completed.get(titlesBinding.path) !== titlesBinding.sha256
          || completed.get(matrices[0].path) !== matrices[0].sha256) {
          throw new Error('Titles approval must bind the aggregate artifacts from the completed titles stage.');
        }
        const stageValidation = await validateTitleGenerationStage(runDir, state);
        if (stageValidation.issues.length) {
          throw Object.assign(new Error('Completed title provider and aggregate artifacts violate the titles contract.'), { issues: stageValidation.issues });
        }
      }
      const result = await validateTitlesAndSelection(runDir, nextDecision.path, titlesBinding.path, { autonomous: runMode === 'autonomous' });
      if (result.issues.length) throw Object.assign(new Error('Title candidates or platform selections violate the contract.'), { issues: result.issues });
      state.platform_selections = Object.fromEntries(result.selections.map((selection) => [selection.platform, selection]));
    }

    if (status === 'approved' && gate === 'visual') {
      if (!nextDecision?.path || nextDecision.path !== decisionPathForAttempt(state)) {
        throw new Error('Visual approval requires --decision pointing to the canonical current VisualDecision file.');
      }
      const expected = platforms.flatMap((platform) => {
        const paths = illustrationPaths(state, platform);
        return [paths.plan, paths.shotList];
      });
      const businessBindings = nextBindings.filter((binding) => binding.path !== nextDecision?.path);
      const actual = businessBindings.map((binding) => binding.path);
      if (actual.length !== expected.length || new Set(actual).size !== expected.length
        || !expected.every((path) => actual.includes(path))) {
        throw new Error('Visual approval must bind exactly the five current-attempt plans and shot lists.');
      }
      const validation = await validateIllustrationPlans(runDir, state);
      if (validation.issues.length) {
        throw Object.assign(new Error('Illustration plans violate the visual approval contract.'), { issues: validation.issues });
      }
      const decisionValidation = await validateCurrentVisualDecision(runDir, state, validation.tasks);
      if (decisionValidation.issues.length || nextDecision.sha256 !== decisionValidation.sha256) {
        throw Object.assign(new Error('Visual decision is not the canonical current deterministic decision.'), {
          issues: decisionValidation.issues
        });
      }
    }

    if (status === 'approved' && gate === 'final') {
      const qaPath = join(runDir, '09-qa', 'qa.json');
      const qa = fileExists(qaPath) ? await readJson(qaPath) : null;
      if (qa?.status !== 'READY') {
        throw new Error('Final gate cannot be approved until 09-qa/qa.json is READY.');
      }
      const fingerprintIssues = await verifyQaFingerprints(runDir, qa);
      if (fingerprintIssues.length) throw Object.assign(new Error('Final gate cannot be approved because QA-bound artifacts changed.'), { issues: fingerprintIssues });
    }

    const now = new Date().toISOString();
    const changed = nextDecision?.sha256 !== previous.decision_ref?.sha256 || !sameBindings(nextBindings, previous.bound_artifacts);
    const revision = Math.max(1, (previous.revision || 0) + (changed && previous.revision ? 1 : 0));
    state.gates[gate] = {
      status,
      revision,
      decision_ref: nextDecision,
      bound_artifacts: nextBindings,
      approval_mode: args.approval_mode || previous.approval_mode || (runMode === 'autonomous' ? 'autonomous' : 'interactive'),
      actor: args.actor || (runMode === 'autonomous' ? 'orchestrator' : 'user'),
      approved_at: status === 'approved' ? now : null,
      updated_at: now
    };

    if (status !== 'approved' || changed) {
      const invalidated = [];
      for (const downstream of gateOrder.slice(gateIndex + 1)) {
        const old = state.gates[downstream];
        if (old?.status !== 'pending') invalidated.push({ gate: downstream, previous: old });
        state.gates[downstream] = {
          status: 'pending', revision: old?.revision || 0, decision_ref: null,
          bound_artifacts: [], approval_mode: null, approved_at: null,
          updated_at: now, invalidated_by: gate
        };
      }
      if (invalidated.length) {
        state.invalidations = [...(state.invalidations || []), { at: now, source_gate: gate, invalidated }];
      }
      const firstStage = gateInvalidatesFrom[gate];
      if (firstStage && state.stages) {
        const stageInvalidated = [];
        for (const stage of stageOrder.slice(stageOrder.indexOf(firstStage))) {
          const old = state.stages[stage];
          if (old?.status !== 'pending') stageInvalidated.push({ stage, previous: old });
          state.stages[stage] = {
            status: 'pending', attempt: old?.attempt || 0, artifacts: [], error: null,
            invalidated_by: gate, updated_at: now
          };
        }
        if (stageInvalidated.length) {
          state.invalidations = [...(state.invalidations || []), { at: now, source_gate: gate, stages: stageInvalidated }];
        }
      }
      if (gateIndex <= gateOrder.indexOf('titles')) state.platform_selections = gate === 'titles' && status === 'approved' ? state.platform_selections : {};
    }

    const nextStage = { topic: 'research', outline: 'masters', titles: 'visual', visual: 'visual', final: 'completed' };
    state.updated_at = now;
    state.status = status === 'blocked'
      ? 'blocked'
      : status === 'awaiting_approval'
        ? 'awaiting_approval'
        : gate === 'final' && status === 'approved' ? 'completed' : 'running';
    state.current_stage = status === 'approved' ? nextStage[gate] : `${gate}_approval`;
    state.resume = { next_stage: state.current_stage, reason: status === 'approved' ? 'gate_approved' : 'awaiting_gate' };
    state.history = [...(state.history || []), {
      at: now, event: 'gate_updated', gate, from: previous.status, to: status,
      revision, decision_sha256: nextDecision?.sha256 || null
    }];
    await writeJson(statePath, state);
    emitJson({ status: 'PASS', gate, gate_status: status, run_status: state.status, revision });
  } catch (error) {
    emitJson({ status: 'BLOCKED', message: error.message, issues: error.issues || [] }, 2);
  }
}
