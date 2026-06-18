# Minimal Five-Pack Example

Use this as a compact filled reference for output shape. Do not copy the sample content unless it fits the user's source.

## 1. Visual DNA Design System

### Design Essence
Calm premium editorial SaaS. Quiet confidence, medium-low density, generous reading rhythm, and restrained contrast.

### Transferable Elements
- Soft hierarchy with large editorial headings and compact supporting copy.
- Warm off-white background, muted ink text, and one restrained accent role.
- Modular sections with wide gutters, thin dividers, and low-shadow surfaces.

### Non-transferable Elements
- Source logo, product name, slogans, screenshots, and exact navigation.
- Exact hero composition, distinctive CTA wording, and proprietary icon set.
- Any source claims, metrics, customer names, or product UI captures.

## 2. visual_dna_system JSON/tokens

```json
{
  "visual_dna_system": {
    "design_essence": {
      "mood": ["calm", "premium", "editorial"],
      "energy": "restrained",
      "density": "medium-low",
      "trust_signal": "quiet expertise",
      "visual_keywords": ["soft hierarchy", "wide gutters", "thin dividers"]
    },
    "color": {
      "temperature": "warm neutral",
      "contrast": "moderate",
      "background_strategy": "off-white page with slightly raised surfaces",
      "surface_strategy": "paper-like panels with thin borders",
      "accent_strategy": "single muted accent for decisions and states",
      "text_strategy": "deep ink primary with softened secondary text",
      "state_color_strategy": "subtle and non-neon",
      "palette_hints": ["warm off-white", "deep ink", "muted blue accent"]
    },
    "transferable": ["editorial pacing", "restrained accent role", "thin-divider structure"],
    "non_transferable": ["source logo", "exact hero layout", "source copy"],
    "originality_rules": ["change composition", "replace identity layer", "use new copy"],
    "downstream_prompt": "Use this Visual DNA abstractly to create an original brandless SaaS landing page. Do not copy source identity, exact layout, assets, or copy."
  }
}
```

## 3. Downstream Production Prompt

Use `visual-design-producer` to create an original brandless SaaS landing page from this Visual DNA. Preserve calm premium editorial pacing, warm neutral surfaces, thin dividers, and restrained accent behavior. Do not reuse source identity, exact layout, assets, claims, screenshots, or copy.

## 4. Transferability Notes

Transfer mood, density, hierarchy rhythm, color roles, spacing logic, and surface treatment. Replace identity, layout, copy, imagery, and product claims.

## 5. Originality Guardrails

- A viewer must not mistake the output for the source brand.
- Source assets, screenshots, slogans, and exact navigation must not appear.
- The downstream producer should work from this system without re-reading the original sample.
