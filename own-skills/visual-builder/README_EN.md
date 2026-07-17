# Visual Builder

[中文](README.md) | English

Visual Builder is a Codex skill that converts a user-supplied designed image or an existing `visual_dna_system` document into a debranded, platform-specific illustration style candidate bundle. The bundle can be reviewed and approved independently, or optionally registered and used for production by `post-illustration-images`.

It extracts reusable visual grammar instead of reproducing the source pixel for pixel. Brands, subject matter, copy, proper nouns, and identity-bearing elements from the source are excluded from the resulting template.

## Installation And Recommended Companions

Install Visual Builder with Codex's built-in `skill-installer`:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo BruceL017/visual-builder \
  --path . \
  --name visual-builder
```

Visual Builder works standalone. Two optional companion skills provide the full pipeline:

| Position | Skill | Role | Behavior when missing |
| --- | --- | --- | --- |
| Upstream | `visual-dna-system` | Extracts a more complete Visual DNA from designed images | Uses Visual Builder's compact built-in extraction path |
| Current | `visual-builder` | Compiles, calibrates, validates, and approves template candidates | Completes a portable `approved` candidate bundle independently |
| Downstream | [`post-illustration-images`](https://github.com/BruceL017/post-illustration-images) | Registers approved styles and uses them for production illustrations | Preserves the approved bundle without registration or production |

`visual-dna-system` does not currently have a public installation URL. If you have a trusted repository URL or path, install from that source and name the destination `visual-dna-system`; do not use an unverified repository with a matching name.

Install the public downstream skill:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo BruceL017/post-illustration-images \
  --path . \
  --name post-illustration-images
```

On the first Visual Builder invocation in each task, it checks both optional skills. It recommends only missing companions, never installs automatically, never pauses the task, and does not repeat the notice within the same task.

## Core Capabilities

- Accept designed images or Visual DNA documents as input.
- Evaluate design signals across color, typography, composition, shapes, material, and illustration language.
- Compile debranded style documents, structured specifications, and text-only prompts.
- Generate separate calibration images for concept, process, and checklist structures.
- Validate dimensions, file integrity, PNG structure, review scores, and safety constraints.
- Require explicit human review before a candidate can be approved and installed.

## Supported Platforms

| Platform | Design coordinate system | Ratio | Orientation |
| --- | ---: | ---: | --- |
| WeChat | 1600 x 1200 | 4:3 | Horizontal |
| Xiaohongshu | 1080 x 1440 | 3:4 | Vertical |
| Zhihu | 1600 x 900 | 16:9 | Horizontal |
| Weibo | 1080 x 1440 | 3:4 | Vertical |
| Toutiao | 1600 x 900 | 16:9 | Horizontal |

These dimensions define layout coordinates. Calibration images that pass the ratio check preserve their native pixels without cropping, padding, stretching, or forced resizing. Toutiao images must also have a shortest edge of at least 900 pixels.

## Workflow

1. Confirm the input mode, source, target platform, and output directory.
2. Extract or validate Visual DNA and pass the design-signal and source-integrity gates.
3. Suggest debranded candidate metadata such as name, purpose, and aliases.
4. Compile the style contract, platform geometry, prompts, and candidate metadata.
5. Generate independent concept, process, and checklist calibration images.
6. Run machine QA, select the best reference, and build a contact sheet.
7. Validate the complete bundle and stop for human review.
8. After explicit approval, deliver a portable bundle; install it only when requested and the downstream skill is available.

## Candidate Bundle

```text
visual-builder-output/<style_id>/
├── candidate.json
├── visual-dna.md
├── visual-dna.json
├── style.md
├── style.spec.json
├── provenance.json
├── prompts/
│   ├── concept.md
│   ├── process.md
│   └── checklist.md
├── calibration/
│   ├── concept.png
│   ├── process.png
│   ├── checklist.png
│   ├── style-reference.png
│   └── contact-sheet.png
└── qa.json
```

Candidate states progress through `draft`, `ready_for_review`, `approved`, and `installed`; failed hard gates use `blocked`. Generated does not mean reviewed, and machine validation does not replace explicit human approval.

## Usage

Load this repository as a Codex skill and invoke it with explicit inputs. For example:

```text
Use $visual-builder to turn this 1080 x 1440 knowledge card into a Xiaohongshu illustration template candidate.
Remove the original branding and copy, preserve the paper texture, editorial hierarchy, and whitespace rhythm, then stop for review after generating the calibration images.
```

Required inputs:

- `input_mode`: `image` or `visual-dna`
- `source`: an image path or JSON/Markdown containing `visual_dna_system`
- `target_platform`: `wechat`, `xhs`, `zhihu`, `weibo`, or `toutiao`
- `output_root`: the directory in which to create the candidate bundle

## Local Validation

Run the test suite:

```bash
node --test tests/validate-candidate.test.mjs
```

Validate a candidate bundle:

```bash
node scripts/validate-candidate.mjs /absolute/path/to/candidate
```

Mark a candidate approved after human review:

```bash
node scripts/mark-approved.mjs /absolute/path/to/candidate \
  --confirm-human-review \
  --confirmed-by "<reviewer>"
```

## Guardrails

- Never send the source image to the image-generation backend.
- Never copy brands, logos, watermarks, characters, source copy, or unique identity elements.
- Never treat a natural photo, standalone logo, or content without a reusable design system as a valid template source.
- Never infer the target platform from the source aspect ratio; the user must choose it explicitly.
- Never install a candidate without all three calibration images, machine QA, and human review.
- Never use the selected calibration reference as a generation input.

See [candidate-contract.md](references/candidate-contract.md), [compiler.md](references/compiler.md), and [qa.md](references/qa.md) for the complete behavior contract, compilation rules, and QA requirements.
