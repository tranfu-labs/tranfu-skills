#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCandidate } from "./validate-candidate.mjs";

function usage() {
  return "Usage: node scripts/mark-approved.mjs <candidate-dir> --confirm-human-review --confirmed-by <reviewer> [--note <text>]";
}

function parseArguments(argv) {
  const options = { candidateDirectory: null, confirmed: false, confirmedBy: null, note: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--confirm-human-review") options.confirmed = true;
    else if (argument === "--confirmed-by") options.confirmedBy = argv[++index];
    else if (argument === "--note") options.note = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else if (options.candidateDirectory) throw new Error("Only one candidate directory is allowed");
    else options.candidateDirectory = argument;
  }
  if (options.confirmedBy === undefined) throw new Error("--confirmed-by requires a value");
  if (options.note === undefined) throw new Error("--note requires a value");
  return options;
}

function reviewerNote(confirmedBy, note) {
  const prefix = `Approved by ${confirmedBy.trim()}.`;
  return note?.trim() ? `${prefix} ${note.trim()}` : prefix;
}

async function writeJsonAtomically(file, value) {
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, file);
}

export async function markApproved(candidateDirectory, options) {
  if (options?.confirmHumanReview !== true) throw new Error("Explicit --confirm-human-review acknowledgement is required");
  if (typeof options.confirmedBy !== "string" || !options.confirmedBy.trim()) throw new Error("A non-empty --confirmed-by reviewer is required");
  if (options.note !== undefined && options.note !== null && (typeof options.note !== "string" || !options.note.trim())) {
    throw new Error("--note must be omitted or contain non-empty text");
  }

  const root = path.resolve(candidateDirectory);
  const validation = await validateCandidate(root);
  if (!validation.valid) {
    const details = validation.errors.map((error) => `${error.field}: ${error.message}`).join("; ");
    throw new Error(`Candidate validation failed: ${details}`);
  }
  if (validation.summary.status !== "ready_for_review") {
    throw new Error(`Candidate must be ready_for_review, received ${validation.summary.status ?? "unknown"}`);
  }

  const candidateFile = path.join(root, "candidate.json");
  const candidate = JSON.parse(await readFile(candidateFile, "utf8"));
  const approvedAt = new Date().toISOString();
  const approved = {
    ...candidate,
    status: "approved",
    template_ready: true,
    humanApproval: {
      status: "approved",
      approvedAt,
      note: reviewerNote(options.confirmedBy, options.note),
    },
  };

  await writeJsonAtomically(candidateFile, approved);
  const finalValidation = await validateCandidate(root, { requireInstallable: true });
  if (!finalValidation.valid) {
    await writeJsonAtomically(candidateFile, candidate);
    const details = finalValidation.errors.map((error) => `${error.field}: ${error.message}`).join("; ");
    throw new Error(`Approval transition failed validation and was rolled back: ${details}`);
  }
  return { styleId: finalValidation.summary.styleId, status: "approved", approvedAt };
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.candidateDirectory || !options.confirmed || !options.confirmedBy?.trim()) {
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  try {
    const result = await markApproved(options.candidateDirectory, {
      confirmHumanReview: options.confirmed,
      confirmedBy: options.confirmedBy,
      note: options.note,
    });
    console.log(`Approved candidate: ${result.styleId} at ${result.approvedAt}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
