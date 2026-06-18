# Visual DNA Output Schema

Use this reference when writing the required output for `visual-dna-system`.

## Required Five-Pack Artifacts

The final response MUST contain these five top-level named artifacts. Use the names exactly:

### Visual DNA Design System

Markdown design-system artifact. It MUST include an `Evidence And Confidence` section and the visual DNA sections below.

### visual_dna_system

JSON/tokens artifact. It MUST include the `visual_dna_system` JSON field and the nested evidence fields below.

### Downstream Production Prompt

Copyable prompt artifact for `visual-design-producer`.

### Transferability Notes

Named artifact explaining what can transfer, what cannot transfer, and what evidence is missing or lower-confidence.

### Originality Guardrails

Named artifact listing source-identity risks and required de-branding constraints.

## Markdown Artifact

```text
# Visual DNA Design System

## Evidence And Confidence
Evidence sources used, confidence level, missing evidence, and any lower-confidence inferences.

## 1. Design Essence
Core mood, visual temperament, energy level, density, trust signal, emotional tone, and design intent.

## 2. Color System
Color roles, temperature, contrast strategy, background/surface/accent/text/state color behavior, and palette guidance.

## 3. Typography System
Type personality, hierarchy, scale, weight rhythm, line-height behavior, reading density, and text treatment.

## 4. Layout And Spacing System
Grid logic, spacing rhythm, alignment, whitespace behavior, section pacing, visual weight, and scan path.

## 5. Shape And Component System
Abstract component language for buttons, cards, navigation, forms, tags, panels, charts, and controls.

## 6. Material System
Radius, borders, shadows, transparency, gradients, texture, depth, surface treatment, and layering rules.

## 7. Imagery And Iconography System
Image style, icon style, illustration logic, photography rules, diagram behavior, and placeholder guidance.

## 8. Motion And Interaction System
Animation pace, easing, transitions, hover/click feedback, state changes, and interaction restraint.

## 9. Composition Grammar
How the sample creates hierarchy, rhythm, contrast, focus, narrative flow, and visual tension.

## 10. Transferable Elements
Abstract principles that can be reused in another context.

## 11. Non-transferable Elements
Source brand assets, logos, proprietary components, distinctive protected layouts, exact copy, and unique identity markers that must not be reused.

## 12. Originality Guardrails
How to preserve the underlying visual temperament while producing a visually original result.

## 13. Downstream Production Prompt
A copyable prompt block that instructs `visual-design-producer` how to use this visual system.
```

## JSON/Tokens Artifact

```json
{
  "visual_dna_system": {
    "evidence_and_confidence": {
      "evidence_sources": [],
      "confidence_level": "",
      "missing_evidence": []
    },
    "design_essence": {
      "mood": [],
      "energy": "",
      "density": "",
      "trust_signal": "",
      "visual_keywords": []
    },
    "color": {
      "temperature": "",
      "contrast": "",
      "background_strategy": "",
      "surface_strategy": "",
      "accent_strategy": "",
      "text_strategy": "",
      "state_color_strategy": "",
      "palette_hints": []
    },
    "typography": {
      "personality": "",
      "hierarchy": "",
      "scale": "",
      "weight_rhythm": "",
      "line_height": "",
      "density": ""
    },
    "layout": {
      "grid": "",
      "spacing": "",
      "alignment": "",
      "composition": "",
      "section_rhythm": "",
      "scan_path": ""
    },
    "components": {
      "shape_language": "",
      "button_style": "",
      "card_style": "",
      "navigation_style": "",
      "form_style": "",
      "data_display_style": ""
    },
    "materials": {
      "radius": "",
      "shadow": "",
      "border": "",
      "texture": "",
      "gradient": "",
      "depth": ""
    },
    "imagery": {
      "image_style": "",
      "iconography": "",
      "illustration": "",
      "photography": "",
      "diagram_style": ""
    },
    "motion": {
      "pace": "",
      "easing": "",
      "transition_style": "",
      "interaction_feedback": ""
    },
    "transferability_notes": [],
    "transferable": [],
    "non_transferable": [],
    "originality_rules": [],
    "downstream_prompt": ""
  }
}
```

## Downstream Prompt Requirements

The downstream prompt must tell `visual-design-producer`:

- If a structured `Producer Handoff` block is present, use it as the primary production brief.
- If no `Producer Handoff` is present but Visual DNA is present, infer production direction from Visual DNA.
- If no Visual DNA is present, operate in standalone production mode from the user brief.
- Use the Visual DNA abstractly.
- Create an original artifact for the new brief.
- Do not copy the source identity, logos, exact layouts, proprietary components, or exact copy.
- Use `brandless` mode unless brand context is supplied.
- Run the anti-slop quality gate before delivery.

When the downstream prompt is structured, prefer this lightweight shape:

```text
Producer Handoff
- Production brief:
- Target artifact:
- Visual DNA to preserve:
- JSON/tokens to use:
- Real target context to read, if any:
- Brand mode:
- Non-transferable source elements:
- Quality checks:
```
