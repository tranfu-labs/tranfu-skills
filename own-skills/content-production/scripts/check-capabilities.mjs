#!/usr/bin/env node
import { emitJson, expandPath, inspectCapabilities, parseArgs, skillDir } from './lib.mjs';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const configPath = expandPath(args.config || join(skillDir, 'capabilities.yaml'));

try {
  const report = await inspectCapabilities(configPath);
  emitJson(report, report.status === 'PASS' ? 0 : 2);
} catch (error) {
  emitJson({ status: 'BLOCKED', blockers: [{ code: 'capability_check_failed', message: error.message }] }, 2);
}
