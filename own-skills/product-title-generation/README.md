---
prompt_examples:
  - prompt: Give me a 4-6 character Chinese product title for a team-level Agent observability platform.
    scene: scene description
  - prompt: GitHub Learning Lab · codebase-understanding cockpit — I need a short Chinese title.
    scene: keyword bundle
  - prompt: Name a 30-day Japanese sprint coaching course in Chinese — should feel time-pressured.
    scene: category naming
  - prompt: Give an 8-character Chinese product title for "observability layer for heterogeneous team agents".
    scene: length override
  - prompt: Follow the "cockpit" / "foundation" pattern and name an AI infrastructure product in Chinese.
    scene: anchor naming
  - prompt: Name two things at once — a language coaching course and an Agent product launchpad.
    scene: multi-product batch
---

[English](./README.md) | [中文](./README.zh.md)

# Product Title Generation

Turn a product, feature, module, campaign theme, or brand short name into 1 recommended + 6 alternate Chinese titles in a single pass — short enough to drop straight into the UI.

## When to use it

**Scene description**:

I need a Chinese name for a platform / module / entry point. I describe what it does and want a batch of candidates to pick from.

**Keyword bundle**:

I paste the English source name plus a Chinese description together (e.g., `GitHub Learning Lab · codebase-understanding cockpit`) and want the skill to compress it into a 4-6 character Chinese product title.

**Category naming**:

My product falls into a category that already has an established Chinese naming pattern — learning coach, tech platform, observability layer, incubation launchpad, code understanding — and I want the skill to apply the matching convention (coach / foundation / observatory / launchpad / insights hub).

**Length override**:

Default is 4-6 characters. When I explicitly say "make it 8 characters" or "give me 10 alternates", my constraint overrides the default.

**Anchor naming**:

I toss in a reference word ("cockpit", "foundation", "hub") and want the skill to keep naming in the same style.

**Multi-product batch**:

I drop in two or three source concepts at once and want the skill to produce a full candidate set for each, independently.

**Not in scope**:

Marketing copy / ads / long landing-page prose → **copywriting workflow**; SEO titles / headline keywords → **SEO / content workflow**; trademark clearance / legal registrability → **legal review**; code variables / class names / package names → **code naming / refactor workflow**; brand strategy / naming architecture / brand books → **brand strategy workflow**.

## What it produces

**Default delivery: 1 recommended + 6 alternates** — no more, no less, unless you explicitly override the count or length.

- **Output blocks**: `Recommended title` / `Alternate titles (6)` / `Rationale` as a single markdown segment; multi-product input repeats one block per source concept
- **Never does**: edit any file / check trademarks / write ad slogans / name code variables / produce a brand book

## Preconditions & boundaries

**Precondition**:

Supply at least one recognizable product object, feature description, or concept — empty input is bounced back once with a clarifying question, never guessed at.

**Adjacent-request routing**:

| Request | Send to |
|---|---|
| Marketing slogans / ads / landing-page copy | **copywriting workflow** |
| SEO titles / headline keywords | **SEO / content workflow** |
| Trademark clearance / legal registrability | **legal review** |
| Code variables / class / package naming | **code naming / refactor workflow** |
| Brand strategy / naming architecture | **brand strategy workflow** |

**Out of scope**:

- Long-form marketing copy or oversized slide headlines (more than 6 characters and rhetorical)
- Anything requiring a trademark or legal-risk judgment
- Pure abstractions with no product object (e.g., just "future" or "ultimate")

**Fine-grained edges**:

- Single product object with multiple valid readings → the skill asks once to lock intent, never guesses
- Multi-product batch input → each source concept gets its own full block; results are never merged into a shared candidate pool
- Explicit length override (e.g., 8 characters) → replaces the default 4-6 rule, called out in the rationale
