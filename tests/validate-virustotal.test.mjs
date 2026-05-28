import { test } from "node:test";
import assert from "node:assert/strict";

import { validateSkillVirustotal } from "../scripts/validate-virustotal.mjs";
import { makeTmpRepo, cleanup, writeSkill } from "./helpers.mjs";

test("vt: no api key → single skipped warning, no error", async () => {
  const root = makeTmpRepo();
  try {
    const dir = writeSkill(root, { name: "x" });
    const errs = await validateSkillVirustotal(dir, root, "");
    assert.equal(errs.length, 1);
    assert.equal(errs[0].rule, "virustotal.skipped");
    assert.equal(errs[0].severity, "warning");
  } finally {
    cleanup(root);
  }
});

