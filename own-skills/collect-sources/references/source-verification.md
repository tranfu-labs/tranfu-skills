# Source Verification

Use these rules to turn captured material into traceable claims without flattening every source type into a mechanical two-source rule.

## Contents

1. Source roles and independence
2. Evidence levels and use gates
3. Claim-type rules
4. Conflicts, freshness, and marketing
5. Claim wording and citation integrity

## 1. Source Roles And Independence

Classify a source by its role for the specific claim:

- Primary: official announcement, current documentation, release notes, repository artifact, original paper, dataset, filing, court or regulator record, or direct statement.
- Independent secondary: reporting or analysis that performs its own verification, interviews, testing, or contextual work.
- Expert interpretation: attributed technical or industry analysis with relevant expertise.
- Community sample: a public first-person report, issue, discussion, comment, or demonstration.
- Discovery lead: search result, feed item, aggregator entry, inaccessible post, or unattributed summary.

Authority is claim-specific. A company is authoritative about what it announced and currently prices, but not independent proof that its benchmark or marketing conclusion is correct. A community post can establish what that person reports, but not a general product fact.

Group sources by evidence origin. Treat these as one source, not independent corroboration:

- Articles that repeat the same press release or wire copy.
- Reports that cite the same unnamed person, dataset, benchmark, or study.
- Mirrors, translations, syndications, and summaries of one original page.
- Multiple pages controlled by the same organization that repeat one claim without new evidence.

## 2. Evidence Levels And Use Gates

Assign one evidence level:

| Level | Meaning | Minimum condition |
|---|---|---|
| `L0` | 线索 | Only a snippet, inaccessible reference, memory, or uninspected pointer exists. |
| `L1` | 可追溯 | The original page was inspected and an exact locator or evidence passage was captured. |
| `L2` | 交叉支持 | Independent evidence agrees, or a primary artifact plus relevant verification supports the claim. |
| `L3` | 发布可用 | The applicable claim-type gate below is satisfied, scope and date are explicit, and no material conflict is hidden. |

Assign one downstream use gate separately:

- `ready`: the claim is `L3` and may be asserted within its recorded scope and `as_of` date.
- `caveat`: the claim is traceable but incomplete, single-source where corroboration is required, contested, stale, or useful only as attributed uncertainty.
- `do_not_use`: the item is `L0`, unverifiable, materially contradicted without resolution, outside scope, or unsafe to paraphrase as fact.

Never upgrade a claim because it is popular, repeated, plausible, or useful to the planned narrative.

## 3. Claim-Type Rules

### Current official specification, price, or availability

Reach `L3/ready` when a current first-party page explicitly supports the exact claim and the claim records an `as_of` date, region, plan, version, and material qualifier. Use independent reporting when asserting comparison, performance, adoption, or impact rather than the canonical current field itself.

When an official page makes a marketing or benchmark claim, `ready` may support only the attributed sentence "the organization says/reports X" unless independent evidence verifies X itself.

### General event, date, release, and critical number

Reach `L3/ready` only with the original announcement, record, dataset, or direct evidence plus one genuinely independent source. Compare definitions, units, time ranges, regions, denominators, and revisions. A current official page alone may verify its own current canonical field, but not an external consequence or historical interpretation.

### Direct quotation

Reach `L3/ready` with the original speech, transcript, article, post, interview, video, or document; capture the speaker, date, locator, and surrounding context. One original source is enough. A secondary quotation remains `caveat` until the original is inspected.

Keep verbatim excerpts only as long as necessary for verification. Prefer a faithful Chinese explanation for downstream writing and preserve the original language beside it.

### Paper or research result

Reach `L3/ready` for the attributed formulation "the paper reports/finds X" when the original paper is inspected and the record includes authors, date, venue or preprint status, method, sample or dataset, comparison basis, and material limitations. Do not rewrite a preprint as peer-reviewed or a reported result as settled fact.

Claims that generalize beyond the paper's own scope require independent supporting research and remain `caveat` without it.

### Repository, code, or developer-tool behavior

Use the public repository, release, commit, issue, documentation, or reproducible demonstration. Distinguish maintainers from commenters and released behavior from roadmap discussion. Reach `L3/ready` for a released feature when the release artifact and current documentation agree; require independent evidence for performance or adoption claims.

### Media exclusive or unnamed-source report

Keep a single exclusive report at `L1/caveat`, even from a reputable outlet. Reach `ready` only after primary confirmation or genuinely independent corroboration. Attribute unresolved reporting explicitly and never convert "is expected/planned/reported" into "has launched/is available".

### Community or public reaction

Capture at least three independent public samples. Use two public channels when two are anonymously available; otherwise state the single-channel limitation. Remove duplicates and coordinated reposts. Record observable engagement only when the count is public.

Community evidence can support `ready` claims such as "these sampled developers reported X" but must remain labeled anecdotal. It cannot establish population sentiment, market share, technical truth, or universal user experience.

### Visual lead

A screenshot, chart, image, or video frame is a lead unless its creator, original page, date, and context are known. Record the original page and suggested use without downloading. Never treat a decorative or unattributed graphic as factual evidence.

## 4. Conflicts, Freshness, And Marketing

For conflicting credible sources:

1. Compare event date, publication date, and last update date.
2. Compare definitions, scope, region, model or product version, units, dataset, and method.
3. Identify whether one source corrects, supersedes, or merely addresses a different question.
4. Preserve both claims when the difference cannot be resolved.
5. Set the use gate to `caveat` or `do_not_use` and state the exact downstream restriction.

Use claim-specific freshness:

- Current price, availability, policy, model behavior, leadership, and product status require a current check and `as_of` date.
- Historical event records, original papers, and dated quotations may remain valid indefinitely when represented as historical evidence.
- A source older than 30 days is not automatically stale; the 30-day rule applies to hotspot discovery, not background validity.

Treat sponsored content, affiliate pages, vendor benchmarks, anonymous summaries, and promotional copy as interested claims. Preserve them only with attribution and purpose. Never use source prestige as a substitute for inspecting its evidence.

## 5. Claim Wording And Citation Integrity

Make each claim atomic: one actor, action or finding, scope, and time frame. Split sentences that combine release status, performance, adoption, and impact.

Every claim record must include:

- Claim ID and run ID.
- Exact Chinese claim proposed for downstream use.
- Claim type.
- Evidence level and use gate.
- Supporting and conflicting source IDs.
- `as_of` date or historical event date.
- Scope, definition, and material qualifier.
- Conflict, limitation, and permitted downstream wording.

Use attribution to narrow claims accurately: "官方文档显示", "该论文报告", "受访者表示", or "在本次抽取的公开样本中". Never make the attribution broader than the evidence.

Before handoff, verify that every `ready` claim has an inspected source, every source ID resolves in `01-source-notes.md`, and every restriction appears beside the claim in `02-editorial-brief.md`.
