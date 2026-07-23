# Marketing Outline Output Contract

## Contents

1. Run directory
2. Shared metadata
3. Required files
4. Channel outline schema
5. Master-outline compatibility
6. Final quality checks

## 1. Run Directory

Use the output root explicitly supplied by the user. Otherwise use:

`~/Documents/product-marketing`

Expand `~` against the current user's home directory before resolving the path.

Resolve and check the execution-pack directory before writing. It must be outside every inspected product-project root. If an explicit override is inside a target project, use the default only when the default is external and record the safety decision in `00_执行摘要与发布判定.md`. If both are unsafe, ask for a safe absolute output root before creating files.

Create:

`{产品名}_营销内容大纲执行包_{YYYYMMDD-HHmm}/`

Determine `{产品名}` from visible product identity, then current product documentation, then URL slug or project-folder name. Preserve useful Chinese and Latin characters; replace `/`, `:`, path separators, and control characters with `-`.

Use Asia/Shanghai local time. Never overwrite. If the same minute collides, append `-02`, `-03`, and so on.

Use experiment ID:

`EXP-{YYMMDD}-{slug}`

Prefer the URL path slug, then product English slug or pinyin, then a normalized folder name.

Successful and partial runs must contain exactly these six Markdown files:

1. `00_执行摘要与发布判定.md`
2. `01_产品证据与用户路径.md`
3. `02_营销策略与内容矩阵.md`
4. `03_六渠道编辑大纲.md`
5. `04_通用母大纲.md`
6. `05_素材清单与发布门禁.md`

Exception: a `无法形成可信大纲` run creates only `00_执行摘要与发布判定.md` with the diagnostic, sources attempted, and the minimum next input needed.

## 2. Shared Metadata

Begin every generated file with:

- Product name.
- Experiment ID.
- Credential-free input URL and/or absolute project path.
- Evidence observation date/time.
- Release verdict.
- Campaign target: `正式发布营销`.
- Document status: `可进入制作`, `待发布`, or `仅内部`.

Do not label an outline `可发布`; this Skill does not create final copy.

## 3. Required Files

### 00_执行摘要与发布判定.md

Include:

1. One-sentence conclusion.
2. Input and inspection coverage.
3. Product stage observed versus formal-launch campaign target.
4. Release verdict and concise reason.
5. Primary audience, one core scene, direct result, winning hook, content archetype, primary channel, and primary CTA.
6. Assumptions made.
7. Release blockers ordered P0/P1.
8. Execution-pack file index.

For a diagnostic-only run, replace strategy fields with the access failure, attempted evidence sources, and exact recovery input.

### 01_产品证据与用户路径.md

Include:

1. URL status card and/or project status card.
2. Inspection boundary and excluded actions.
3. Evidence table with `EV-###`, claim, source, level, safe wording, and notes.
4. Product understanding card: definition, users, scene, problem, before/after state, result, functions, limits, and ownership.
5. Shortest user path with observed versus unverified steps.
6. Existing result/asset inventory.
7. Safe-claim whitelist.
8. Prohibited or pending-claim list.
9. Evidence conflicts and missing tests.

### 02_营销策略与内容矩阵.md

Include:

1. Primary and secondary tool roles with evidence-based reasons.
2. Primary audience and secondary-opportunity pool.
3. `场景 -> 冲突 -> 实验 -> 结果 -> 回流` with evidence IDs.
4. Two or three hook candidates scored on 广度/直观度/匹配度, one winner, and rejected hooks.
5. One primary content archetype.
6. Six-channel matrix with job, angle, format, required evidence, media, CTA, and priority.
7. D0-D7 launch sequence.
8. TranFu brand connection and UTM pattern.
9. Feedback signals for product, content, and direction learning.

### 03_六渠道编辑大纲.md

Create sections in this order:

1. 小红书
2. 微信公众号
3. 知乎
4. 头条号
5. 微博
6. 官网工具页与实验记录页

Use the channel schema below. Keep all writing at editor-outline level. Do not draft publishable paragraphs.

### 04_通用母大纲.md

Create one evidence-bound, platform-neutral source outline that a downstream writing pipeline can accept through an `--outline` input.

Include:

1. Assignment metadata.
2. One-sentence thesis.
3. Primary reader and desired action.
4. One scene, conflict, result, and TranFu connection.
5. Verified claim ledger with evidence IDs.
6. Restricted claims and required qualifications.
7. The nine-section master narrative defined below.
8. Media/evidence placement plan.
9. Platform adaptation notes without writing platform copy.

Nine-section master narrative:

1. Result hook.
2. Concrete user moment.
3. One old-method conflict.
4. Why TranFu turned it into a focused product.
5. Shortest use path.
6. Observable result and proof.
7. Honest limits and human responsibility.
8. `Agent 公司养成记` connection.
9. One launch action and one feedback signal.

For each section specify `section intent`, `editorial points`, `evidence IDs`, and `media slot`. Do not write final prose.

### 05_素材清单与发布门禁.md

Include:

1. Existing usable assets and evidence IDs.
2. Missing launch assets.
3. Screenshot/recording shot list without creating the assets.
4. Claim-to-asset mapping.
5. G1-G10 marketing-readiness checklist with pass/fail/pending and reason.
6. P0 blockers before copy/asset production and P1 improvements before scale.
7. Per-channel UTM table or placeholder when no public URL exists.
8. Final handoff condition for downstream copy production.

## 4. Channel Outline Schema

Every channel section must include:

- Content job.
- Primary audience.
- Core view.
- Winning hook and content archetype.
- Three title directions, not polished final titles.
- Structure beats appropriate to the channel.
- Evidence IDs required for each material claim.
- Media or demonstration slots.
- Primary CTA and optional non-competing secondary CTA.
- TranFu return sentence direction.
- Prohibited claims and required qualifications.
- Status: `可进入制作`, `待发布`, or `仅内部`.

Apply these shapes:

| Channel | Required structure |
|---|---|
| 小红书 | 6-8 group-image or short-video beats: result cover, scene, conflict, product action, shortest path, result proof, limit, CTA |
| 微信公众号 | 6-8 sections: problem origin, decision, build experiment, evidence, limitation/failure, reusable learning, TranFu meaning, CTA |
| 知乎 | One real question plus 5-8 answer sections: conclusion, why problem exists, existing friction, solution logic, evidence, tradeoffs, reusable insight, CTA |
| 头条号 | 5-7 plain-language sections: everyday scene, old hassle, what product does, short path, result, limits, CTA |
| 微博 | Three-post launch sequence; each post gets purpose, 3-5 beats, one evidence set, one media slot, and one action |
| 官网工具页 | Problem promise, audience, primary CTA, <=3 steps, result/sample, limits/trust, related experiment/TranFu path |
| 官网实验记录页 | Experiment question, source scene, build approach, evidence/result, known limits, reusable asset, next test, feedback path |

## 5. Master-Outline Compatibility

Keep `04_通用母大纲.md` self-contained:

- Resolve all evidence IDs inside the same file.
- State audience, tone, outcome, and forbidden claims explicitly.
- Do not require a downstream writer to read the product repository.
- Preserve credential-free source URLs and absolute evidence paths. Never preserve URL userinfo or suspected secret query/fragment values.
- Distinguish fact, inference, and hypothesis.
- Avoid instructions to publish, log in, generate images, or modify the product.

The downstream pipeline may research or fact-check again, but it must not need to decide the primary scene, hook, content archetype, or CTA.

## 6. Final Quality Checks

Fail the run until all applicable checks pass:

- The directory name is new and timestamped.
- All required files exist for the verdict.
- Shared metadata agrees across files.
- Exactly one primary audience, scene, hook, archetype, and CTA lead the campaign.
- All six channel sections exist and differ in editorial task and structure.
- Every outward promise uses evidence IDs allowed by the evidence policy.
- Every repeated evidence ID preserves the same atomic claim, level, and source across all six files.
- No HTTP status, page load, rendered shell, or navigation-only observation is labeled `E0-T`.
- No input or evidence URL contains userinfo or a suspected token, key, secret, signature, authorization value, or login code.
- E2/E3 statements appear only as hypotheses, gaps, blockers, or prohibited claims.
- TranFu and `Agent 公司养成记` appear as a concise return path.
- Formal-launch strategy remains present even when the document status is `待发布` or `仅内部`.
- No full social post, article paragraph sequence, website final copy, or generated asset appears.
- The source product's final Git status exactly matches its initial snapshot, including untracked paths, and no local inspection server remains running.
