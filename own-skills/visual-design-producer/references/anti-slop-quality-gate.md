# Anti-Slop Quality Gate

Run this gate before delivering output from `visual-design-producer`.

## Required Checks

The output must:

- Follow the production source priority: `Producer Handoff`, then Visual DNA, then standalone brief.
- Use any provided real target context before inventing structure, copy, data, or product details.
- Use visual DNA abstractly when present rather than copying the source.
- Avoid source logos, source brand assets, proprietary components, protected layouts, and exact copy.
- Include target brand elements only when `brand-on` is active.
- Run in `brandless` mode when no brand context exists.
- Avoid filler content, fake data, unnecessary icons, and decorative clutter.
- Avoid generic AI visual tropes such as aggressive gradients, random emoji, meaningless glass cards, generic rounded-card grids, left-border accent cards, gradient blobs, sparkle/orbit decorations, stock-looking abstract SVG art, and invented stats.
- Have clear hierarchy, spacing, scale, rhythm, and alignment.
- Fit the requested artifact type and channel.
- Be visually original.

## Content Rules

- Use supplied copy and data when available.
- If content is missing, use clearly marked placeholders rather than fake claims or fake metrics.
- Ask before adding major sections, pages, or content not implied by the brief.
- Every element must serve information, navigation, emphasis, interaction, or visual rhythm.

## Visual Rules

- Prefer design-system colors or the extracted color roles.
- Do not invent colors that conflict with the DNA or provided brand context.
- Use typography hierarchy deliberately; do not rely on default-looking `Inter`, `Roboto`, `Arial`, `system-ui`, or decorative display fonts as a substitute for a real type direction.
- Keep spacing and density consistent with the intended medium.
- Use images, icons, and illustrations only when they serve the artifact.

## Producer Self-Check

Before delivery, verify internally:

- Which production source was used: `Producer Handoff`, Visual DNA, or standalone brief.
- Whether provided product code, screenshots, URLs, assets, copy, data, or brand material were read and reflected.
- Whether brand mode is resolved without requiring a missing brand path.
- Whether the HTML follows `references/html-engineering-spec.md`.
- Whether placeholders are marked and no unsupported claims or fake metrics were added.

## Originality Check

Before delivery, answer internally:

- Could a viewer mistake this for the source sample or source brand?
- Did any exact source layout, asset, copy, or proprietary component survive?
- Does the output solve the new brief rather than display the old reference?
- Does the artifact still work if no brand context exists?

If any answer exposes a risk, revise before delivering.
