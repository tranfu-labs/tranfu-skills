# Brand Integration Slot

The first version of `visual-design-producer` must run without a fixed brand path. Treat brand as an optional input.

## Default

Default to:

```text
brandless
```

Use only:

```text
Visual DNA Design System + new user brief
```

Do not require a brand manual, brand assets, or configured path.

## Activate Brand-On

Use `brand-on` when:

- The user provides a brand guide, logo package, color tokens, type scale, voice guide, component rules, existing brand website, or inline brand notes.
- The user explicitly asks to add brand elements, apply a brand, or use "our brand".
- A future configured brand reference is available and the user asks for brand integration.

If the user asks for brand integration but provides no brand context, ask for brand material or offer to continue in `brandless` mode.

## Blend Rule

Keep source sample DNA and target brand identity separate:

```text
source sample -> abstract visual DNA
target brand -> identity layer
new brief -> content and purpose
```

Blend them into an original artifact. Do not import source sample brand identity into the target brand.

## Accepted Brand Inputs

Brand context may include:

- Brand guide or design system.
- Logo or asset package.
- Color tokens or CSS variables.
- Typography rules.
- Voice and tone notes.
- Component rules.
- Existing brand website or screenshots.
- Inline notes from the user.
- Future reference file configured by the skill owner.

## Safety Rules

- Never copy source sample logos, names, proprietary layouts, or distinctive brand identity.
- Use target-brand assets only when the user provides or authorizes them.
- If target-brand and visual DNA conflict, prioritize target-brand identity for brand marks, palette, typography, and tone, while preserving DNA as mood, rhythm, composition, and interaction feel.
- If brand evidence is incomplete, state assumptions briefly and continue only when the missing detail is not essential.
- For producer-side originality and anti-slop checks, use `references/anti-slop-quality-gate.md` as the authority.
