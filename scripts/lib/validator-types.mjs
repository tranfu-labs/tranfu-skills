export const SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
});

export function makeError({
  validator,
  skill,
  path,
  rule,
  severity,
  message,
  line = null,
  fix_hint = null,
}) {
  return { validator, skill, path, rule, severity, message, line, fix_hint };
}

export function formatHuman(err) {
  const loc = err.line != null ? `${err.path}:${err.line}` : err.path;
  const mark = err.severity === SEVERITY.ERROR ? "✗" : "⚠";
  const hint = err.fix_hint ? `\n    ↳ ${err.fix_hint}` : "";
  return `${mark} ${loc}: ${err.rule}: ${err.message}${hint}`;
}

export function formatJSON(results) {
  const errors = results.filter((r) => r.severity === SEVERITY.ERROR).length;
  const warnings = results.filter((r) => r.severity === SEVERITY.WARNING).length;
  return JSON.stringify(
    {
      ok: errors === 0,
      summary: { errors, warnings, skipped: 0 },
      results,
    },
    null,
    2,
  );
}

export function hasErrors(results) {
  return results.some((r) => r.severity === SEVERITY.ERROR);
}
