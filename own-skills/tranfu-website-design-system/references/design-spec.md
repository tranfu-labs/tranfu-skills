# Visual DNA Design System: TranFu Website Design Spec

## Evidence And Confidence

Evidence sources:

- Figma file `Z2yIHyY9g9WMgxU98StF2H`, extracted nodes `1627:3048`, `1627:10523`, `1651:13642`, `1653:15597`.
- Local screenshots:
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-1440-default-site/00-overview-1440-default-site.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-1440-default-site/01-home.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-1440-default-site/02-product-center.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-1440-default-site/03-skill-resources.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-1440-default-site/04-practice.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-responsive/00-1280-overview.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-responsive/01-756-overview.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-responsive/02-375-overview.png`
  - `/Users/tranfu/Documents/官网skill/figma-captures/tranfu-responsive/03-1920-overview.png`
- 1440 baseline group: `1439:8108` (`1440-默认官网`), including home `1326:3215`, product center `1337:4432`, skill resources `1350:6080`, practice `1350:6860`, and detail-page states.
- Token samples extracted from representative frames: desktop home `1653:15598`, tablet home `1627:8605`, mobile home `1651:14505`, product center `1667:7055`, skill resources `1669:8389`, detail pages `1653:16795`, `1653:17496`, `1653:17883`.

Confidence: high for color, type, radius, spacing, navigation, list/card/detail page behavior, and responsive breakpoints. Medium for motion because Figma screenshots and static node data do not expose interaction timelines.

Missing evidence:

- Runtime hover/active animation recordings.
- Final production code tokens, if a separate implementation already exists.

## 1. Visual Theme And Atmosphere

TranFu feels like a practical AI Agent operations site: restrained, technical, product-grounded, and quietly energetic. The mood is clean and systematic rather than flashy. It uses white/gray workspace surfaces, precise red accents, dense information cards, code/config previews, real interface-like imagery, and clear page segmentation.

Design keywords:

- engineering-oriented
- agent workflow
- practical resource library
- neutral product surface
- concise red focus
- dense but breathable
- trustworthy and operational

Avoid:

- generic SaaS gradient hero pages
- large decorative red backgrounds
- purple-blue product-marketing palettes
- soft blob/orb decoration
- vague stock illustrations
- heavy shadows or glassmorphism
- oversized empty cards that reduce information density

## 2. Color System

### Palette Roles

| Role | Color | Usage |
| --- | --- | --- |
| Brand Red | `#E63A46` | logo, primary CTA, active state, focus, selected page, important count, small emphasis |
| Red Tint | `#FEF2F3` | selected tags, subtle red surface, alert-like emphasis background |
| Text Primary | `#111111` | headings, important body text, navigation, labels |
| Text Secondary | `#666666` | metadata, supporting text, descriptions |
| Text Tertiary | `#CCCCCC` | low-emphasis technical labels and faded grid labels |
| Surface Base | `#F7F7F7` | page background, nav background, section background, large side gutters |
| Surface Alt | `#F0F0F0` | section bands, dividers, code/info surface |
| Surface Soft | `#F5F5F5` | small controls, subdued cards |
| White | `#FFFFFF` | cards, CTA text, content surfaces, inverse text on red/dark media |
| Border Gray | `#E6E6E6`, `#D9D9D9`, `#EBEBEB`, `#CFCFCF` | dividers, tag borders, light frames, pagination dots |
| Dark Gray | `#333333`, `#2F2D2D` | secondary headings or stronger metadata |
| Status Orange | `#FA5D19`, `#DC6803`, `#FFF7F3` | rare category/status labels only |
| Status Green | `#039855` | success/category status only |

### Color Rules

- Use red sparingly. Red should guide action or state, not flood large areas.
- Keep the page mostly neutral. Large surfaces should be `#F7F7F7`, `#F0F0F0`, or white.
- Prefer thin border contrast over shadow contrast.
- Use red tint backgrounds for selected/category tags, paired with red text.
- Use white text only on red/dark media surfaces or solid action buttons.
- Do not introduce a second dominant accent family. Blue/purple/green/orange may appear only as small product-card badges or status tags.

## 3. Typography Rules

### Font Families

- Primary UI font: `MiSans`.
- Compact English badge/command font: `Hammersmith One`.
- Existing earlier desktop draft may use `Alimama_ShuHeiTi` for hero-scale headings; newer responsive nodes mostly use `MiSans Semibold` for major headings. Prefer existing project tokens if already defined, but keep the observed hierarchy.

### Type Scale

| Use | Desktop | Tablet 756 | Mobile 375 | Weight | Line Height |
| --- | --- | --- | --- | --- | --- |
| Page hero / major section heading | `48px` | `32px` | `20-24px` | `Semibold` | Auto |
| Product-page title | `40px` | `32px` | `24px` | `Semibold` | Auto |
| Detail title | `24px` | `24px` | `20px` | `Semibold` | Auto |
| Detail section heading | `20px` | `20px` | `16-20px` | `Demibold` | Auto |
| Card title / nav active | `16px` | `16px` | `16px` | `Demibold` | Auto |
| Body / nav / CTA | `14-16px` | `14-16px` | `12-16px` | `Regular` | `180%` for paragraphs |
| Metadata / tag / chip | `11-12px` | `11-12px` | `11-12px` | `Regular` | Auto |
| Footer/legal | `10.5px` | `10.5px` | `10.5px` | `Regular` | `180%` |

### Typography Behavior

- Letter spacing is `0` throughout.
- Paragraph and descriptive body copy often uses `line-height: 180%`.
- Use `Demibold` for card names, active nav, and detail step titles.
- Use `Semibold` for page/section headline emphasis.
- Keep copy concrete and engineering-oriented. Favor exact product/workflow nouns over abstract marketing claims.
- On mobile, reduce heading scale sharply while retaining body readability. Do not scale font sizes by viewport width.

## 4. Layout Principles

### Desktop 1920

- Outer page width is `1920px`.
- Core content sits in a centered `1440px` stage, usually offset by `240px` side gutters.
- Common content inner width is `1200px`, with `120px` margins inside the `1440px` stage.
- Navigation is `1920 x 64`; its inner row is `1792 x 40` at `x=64`, `y=12`.
- Large section heights are explicit and modular: hero/list/detail sections are stacked rather than free-flowing.

### Desktop 1440

- `1440px` is the standard TranFu website desktop baseline.
- The page stage equals the viewport width; the extra `240px` side gutters only exist in the `1920` wrapper.
- Common content width is `1200px`, with `120px` side margins inside the `1440px` stage.
- Navigation is `1440 x 64`; its inner row uses `64px` side insets, usually `1312px` wide and `40px` tall.
- Home, product center, skill resources, practice list, and detail pages all have 1440 baseline states. Desktop implementation should first preserve the 1440 breakpoint, then extend outward to 1920 and inward to 1280.
- In `1920`, `1440` is the centered content stage. In `1440`, `1440` is the full viewport.

### Desktop 1280

- Use a `1280px` page width.
- Keep the same content grammar as 1440/1920 but reduce stage width and side gutters.
- Do not collapse into mobile layout yet.

### Tablet 756

- Page width is `756px`.
- Navigation height is `76px`.
- Horizontal page padding is `32px`, producing common content width `692px`.
- Sections stack vertically.
- Product cards and content groups often switch from horizontal grids to vertical or narrower multi-row layouts.

### Mobile 375

- Page width is `375px`.
- Navigation height is `64px`.
- Horizontal page padding is `16px`, producing common content width `343px`.
- Major page sections stack in one column:
  - nav
  - hero
  - product
  - skill
  - practice
  - community CTA
  - footer
- Mobile content should stay dense but readable. Prefer one-column cards, horizontal chip groups, and compact metadata rows.

### Spacing Scale

Observed spacing values:

- Micro: `2`, `3`, `4`, `6`, `7.5`, `8`, `9`, `10`, `12`
- Component: `16`, `18`, `24`, `32`, `36`, `45`, `48`
- Section/navigation: `64`, `76`, `80`, `90`, `120`, `180`

Rules:

- Use `16px` as the default internal padding rhythm.
- Use `24px` and `32px` for card/list groups and tablet/mobile section rhythm.
- Use `48px+` for major section spacing.
- Keep layout grids optically aligned to page gutters and content stage.
- Do not let dynamic labels resize fixed-format toolbars, nav rows, cards, or pagination.

## 5. Shape, Radius, And Component System

### Radius Scale

Observed radius values:

- `6px`: small tags, small pills, logo/badge wrappers.
- `8px`: product cards, chips, small image/cards.
- `9px`: compact nav/utility button.
- `12px`: primary CTA, detail panels, larger controls.
- `16px`: large cards, CTA blocks, community buttons.
- `24px`: large feature cards or soft hero/product blocks.
- Full radius: dots, circular icon buttons, avatars.

Prefer the canonical scale: `6`, `8`, `12`, `16`, `24`, full. Use `9` only when matching the existing nav utility button exactly.

### Navigation

- Height: `64px` desktop/mobile, `76px` tablet.
- Background: `#F7F7F7`.
- Inner row:
  - desktop: `64px` side inset, `40px` row height.
  - tablet: `32px` side inset.
  - mobile: `16px` side inset.
- Nav links use `MiSans Regular 16px`, active item uses `Demibold 16px`.
- Right action uses a compact red/white CTA or utility pill.
- Keep logo fixed and unmodified; do not use it as decoration.

### Buttons

- Primary CTA:
  - background `#E63A46`
  - text white
  - radius `12` or `16`
  - height `44-48px`
  - horizontal padding around `16-24px`
- Secondary/ghost:
  - neutral or white surface
  - text `#111111` or `#333333`
  - thin border or subtle surface contrast
- Icon/text buttons:
  - gap `6-10px`
  - icon aligns to current text color

### Tags And Chips

- Height: `20-32px`.
- Radius: `6-8px`.
- Text: `11-12px`.
- Selected red chip: red text on `#FEF2F3` or red fill with white text.
- Category chips use neutral surfaces and red only for selected/high-emphasis state.

### Cards

- Default surface: white or `#F7F7F7`.
- Radius: `8`, `12`, or `16`.
- Padding: `16-24px`.
- Card text:
  - title `16-20px Demibold`
  - metadata `11-14px Regular #666666`
  - description `14px Regular`, often `180%`
- Prefer dense card grids and list rows. Do not overinflate empty card space.
- Use small product thumbnail/media regions only when they show a real product/interface state.

### Product Matrix Cards

- Desktop product cards observed at `288 x 409`, vertical layout, `16px` radius, `16px` internal gap.
- Grid uses consistent 16/24 spacing, with compact tags at top.
- Product badges may use secondary accent colors, but these must remain small and not become the page palette.

### Resource List Cards

- Skill/resource list pages use search, chips, pagination, and dense cards.
- Cards use `#F7F7F7` / white layering, red selected tags, and compact metadata.
- Pagination uses small controls; active state uses red or dark fill contrast.

### Detail Pages

- Desktop detail content uses `1440px` page width and `1200px` content container.
- Top breadcrumb band starts after nav at `y=66`, height `48`.
- Header area follows with `~242px`.
- Detail body begins around `y=360`.
- Main article and side meta/TOC use neutral surfaces, thin divisions, and compact tags.
- Code/config blocks use pale neutral backgrounds and monospace-like visual density, but retain MiSans unless the implementation already has a code font token.
- Related cards use the same card/tag grammar as list pages.

## 6. Depth And Elevation

Depth is mostly structural, not shadow-driven.

- Primary depth comes from nested neutral surfaces: page background -> section band -> white card -> tag/control.
- Borders and dividers are preferred over drop shadows.
- Use `#E6E6E6`, `#D9D9D9`, `#EBEBEB`, and `#CFCFCF` for separation.
- Shadows, if used in code, must be subtle and reserved for hover/active affordance.
- Avoid glass blur, heavy cards, dramatic floating panels, and exaggerated z-depth.

## 7. Imagery And Iconography

- Use real product screenshots, UI captures, command previews, code/config previews, or product-like mockups.
- Red 3D/product illustrations appear in hero/banner areas, but must be grounded in actual product or agent/tool semantics.
- Icons are small, functional, and aligned to text color.
- New functional icons should use the project's established icon library; if no local convention exists, use a consistent outline style.
- Do not redraw TranFu logos or use brand symbols as generic icons.

## 8. Motion And Interaction

Static Figma evidence does not define full motion, so keep interaction restrained.

- Hover: small border/surface contrast, slight lift only if already present in code.
- Active: red accent or selected red-tint chip.
- Focus: visible red or dark focus state with sufficient contrast.
- Transitions: short, unobtrusive, `120-200ms`.
- Respect `prefers-reduced-motion`.
- Avoid animated decorative backgrounds.

## 9. Responsive Behavior

### Breakpoint Intent

| Breakpoint | Layout Intent |
| --- | --- |
| `1920` | Full stage with 1440 centered content and 240px side gutters |
| `1440` | Standard desktop baseline; viewport is the 1440 stage with frequent 1200 content containers |
| `1280` | Desktop compact stage; same page grammar, smaller canvas |
| `756` | Tablet single-column sections, 32px horizontal padding, 692px content width |
| `375` | Mobile single-column, 16px horizontal padding, 343px content width |

### Responsive Rules

- Desktop nav and pages keep centered stage logic.
- At tablet width, switch complex horizontal grids to vertical stacks or smaller two-column groups only when content remains legible.
- At mobile width, use one-column layout. Do not preserve desktop multi-column detail sidebars.
- Hide, collapse, or move secondary controls before text overflows.
- Keep CTAs at `44-48px` touch-friendly height.
- Keep labels in chips short enough to avoid wrapping; if they must wrap, let the chip height grow cleanly without shifting adjacent fixed controls.
- Detail pages should place table-of-contents/meta blocks above or below content on mobile.
- Maintain section ordering from the Figma mobile homepage: nav, hero, product, skill, practice, community, footer.

## 10. Implementation Cautions

- Do not use red as a full page background.
- Do not add gradient orbs, decorative bokeh, or unrelated abstract decoration.
- Do not introduce a one-hue palette; TranFu is neutral-first with controlled red.
- Do not use generic stock imagery when product/interface evidence is expected.
- Do not use giant marketing typography inside dense cards, sidebars, or toolbars.
- Do not let button text overflow. Use fixed heights, responsive widths, and wrap only where designed.
- Do not create cards inside cards; use full-width sections and repeated cards only for items.
- Do not replace product screenshots with blank placeholders when real assets exist.
- Do not claim visual QA passed without checking at least one desktop and one mobile viewport.

## 11. Downstream Production Prompt And Agent Prompt Guide

Use this guide when asking another agent to implement or review TranFu website UI.

### Production Prompt Template

```text
Build or update the TranFu website UI for: <target page/section/component>.

Use the TranFu Website Design System:
- Visual theme: restrained, engineering-oriented, product-grounded AI Agent workflow UI.
- Colors: neutral surfaces first (#F7F7F7, #F0F0F0, white); Brand Red #E63A46 only for logo, primary actions, active/focus states, and key emphasis.
- Typography: MiSans for UI; Hammersmith One only for compact English badges. Use 48/40/32/24/20/16/14/12/11/10.5px scale as appropriate; letter spacing 0; paragraph line-height 180%.
- Layout: desktop includes a 1920 outer canvas, a 1440 standard baseline stage, and frequent 1200 content containers; 1280 is compact desktop; tablet 756 uses 32px page padding; mobile 375 uses 16px page padding and one-column section stacking.
- Components: cards are light, dense, border/surface separated, radius 8/12/16; buttons are 44-48px high with radius 12/16; tags are 20-32px high with radius 6/8.
- Depth: minimal shadows; prefer borders, pale surfaces, and subtle layering.
- Responsive: validate desktop and mobile; prevent overlap, overflow, clipped text, and control resizing.
- Media: use real product/interface visuals or UI-like captures; never use generic stock placeholders.

Do not copy unrelated layouts, do not redesign the logo, do not use red as a large decorative background, and do not add gradient blobs/orbs.

Deliver:
- changed files
- design rules applied
- desktop/mobile validation status
- any deviations and reasons
```

### Review Prompt Template

```text
Review this TranFu website UI against the TranFu Website Design System.

Check:
- color roles and red usage
- MiSans/Hammersmith One type hierarchy
- radius and spacing scale
- card/button/tag/list/detail component language
- neutral surface layering and minimal elevation
- desktop/tablet/mobile responsive behavior
- logo and icon treatment
- text overflow, overlap, and clipped content
- use of real product/interface media

Return findings first with severity, rule, location, evidence, fix, and verification. Do not edit files unless explicitly asked.
```

## 12. Transferability Notes

Transferable:

- neutral-first product UI mood
- restrained red accent strategy
- MiSans-based dense information hierarchy
- 1440/1200 desktop staging and 16/32 mobile/tablet padding rhythm
- light cards, thin borders, compact tags, practical metadata rows
- code/config and product-interface evidence as visual material

Non-transferable:

- TranFu logo and wordmark
- exact page copy and proprietary product names where not part of the current TranFu site
- exact Figma-only artwork if not exported as approved assets
- specific screenshots or code snippets unless the user explicitly provides them for implementation
- distinctive page arrangements for non-TranFu brands

## 13. Originality Guardrails

- Preserve the TranFu visual temperament only for TranFu-owned website work.
- Do not reuse TranFu logo, wordmark, exact copy, product screenshots, or page arrangements for non-TranFu brands.
- When adapting the style to a new TranFu page, keep the abstract system: neutral product surfaces, compact red emphasis, dense cards, practical metadata, code/config evidence, and responsive stage logic.
- When producing a new artifact, use new copy, new page structure where appropriate, and approved TranFu assets only.
- A viewer should read the output as part of the TranFu official website system, not as a copied screenshot recreated without purpose.

## 14. visual_dna_system

```json
{
  "visual_dna_system": {
    "evidence_and_confidence": {
      "evidence_sources": [
        "Figma nodes 1439:8108, 1627:3048, 1627:10523, 1651:13642, 1653:15597",
        "Local screenshots under /Users/tranfu/Documents/官网skill/figma-captures/tranfu-1440-default-site",
        "Local screenshots under /Users/tranfu/Documents/官网skill/figma-captures/tranfu-responsive",
        "Token samples from desktop, tablet, mobile, list, product, and detail frames"
      ],
      "confidence_level": "high for static visual system, medium for motion",
      "missing_evidence": [
        "runtime hover and active animation recordings",
        "final production code tokens if separate from Figma"
      ]
    },
    "design_essence": {
      "mood": ["restrained", "technical", "product-grounded", "operational"],
      "energy": "quietly energetic",
      "density": "dense but breathable",
      "trust_signal": "precise neutral surfaces, code/config previews, real interface-like evidence",
      "visual_keywords": ["AI Agent workflow", "resource library", "neutral system", "red focus"]
    },
    "color": {
      "temperature": "neutral-cool with focused warm red",
      "contrast": "moderate surface contrast with sharp accent contrast",
      "background_strategy": "mostly #F7F7F7, #F0F0F0, #F5F5F5, and white",
      "surface_strategy": "layer neutral bands, white cards, and thin gray separators",
      "accent_strategy": "#E63A46 only for logo, primary action, active state, focus, and key emphasis",
      "text_strategy": "#111111 primary, #666666 secondary, #CCCCCC tertiary",
      "state_color_strategy": "red tint #FEF2F3 for selected tags; secondary accents only as small status/category marks",
      "palette_hints": ["#E63A46", "#FEF2F3", "#111111", "#666666", "#F7F7F7", "#F0F0F0", "#FFFFFF"]
    },
    "typography": {
      "personality": "clean product UI with compact technical badges",
      "hierarchy": "48/40/32/24/20/16/14/12/11/10.5px",
      "scale": "large desktop headings collapse to 32px tablet and 20-24px mobile",
      "weight_rhythm": "Regular body, Demibold cards/nav, Semibold headings",
      "line_height": "180% for paragraphs and legal text; Auto for compact UI",
      "density": "compact labels and metadata with readable paragraphs"
    },
    "layout": {
      "grid": "1920 canvas centers a 1440 stage; 1440 is the standard desktop baseline; frequent 1200 content container",
      "breakpoints": {
        "1920": "outer large canvas with centered 1440 stage and about 240px side gutters",
        "1440": "standard desktop baseline; viewport is the full 1440 stage with frequent 1200 content containers",
        "1280": "compact desktop while preserving desktop grammar",
        "756": "tablet single-column sections with 32px padding and about 692px content width",
        "375": "mobile single-column layout with 16px padding and about 343px content width"
      },
      "spacing": "2/3/4/6/8/12 micro, 16/24/32 component, 48/64/76/90+ section",
      "alignment": "strict stage alignment with stable gutters",
      "composition": "stacked product sections, dense cards, practical content blocks",
      "section_rhythm": "explicit modular vertical sections",
      "scan_path": "nav -> hero/banner -> product/resource cards -> CTA -> footer"
    },
    "components": {
      "shape_language": "small-radius technical pills plus larger neutral cards",
      "button_style": "44-48px high, radius 12/16, red primary or neutral secondary",
      "card_style": "white or pale neutral, radius 8/12/16, 16-24px padding, light borders",
      "navigation_style": "neutral 64px desktop/mobile nav, 76px tablet nav, centered inner row",
      "form_style": "search and filters use pale neutral surfaces, compact labels, red active state",
      "data_display_style": "dense metadata rows, code/config blocks, compact tags and pagination"
    },
    "materials": {
      "radius": "6, 8, 12, 16, 24, full",
      "shadow": "minimal; use only for hover/active if needed",
      "border": "thin gray separators",
      "texture": "flat product surfaces",
      "gradient": "avoid generic gradients; use approved product/hero assets only",
      "depth": "surface nesting rather than heavy elevation"
    },
    "imagery": {
      "image_style": "real product screenshots, UI captures, command/config previews",
      "iconography": "small functional outline icons, currentColor behavior",
      "illustration": "red product/agent visuals only when semantically tied to the page",
      "photography": "not a stock-photo-led system",
      "diagram_style": "interface and code-like previews rather than decorative diagrams"
    },
    "motion": {
      "pace": "subtle and short",
      "easing": "standard ease, 120-200ms",
      "transition_style": "surface, border, and active-state feedback",
      "interaction_feedback": "red active/focus, slight surface change, no decorative background animation"
    },
    "transferability_notes": [
      "Transfer the neutral-first product UI mood only within TranFu work.",
      "Do not transfer logos, exact copy, exact screenshots, or distinctive arrangements to other brands."
    ],
    "transferable": [
      "neutral product surfaces",
      "restrained red accent strategy",
      "MiSans dense hierarchy",
      "1440/1200 desktop staging",
      "16/32 mobile/tablet padding",
      "light cards and compact tags"
    ],
    "non_transferable": [
      "TranFu logo and wordmark",
      "exact Figma artwork",
      "exact page copy",
      "specific product screenshots unless approved",
      "distinctive source layouts for non-TranFu brands"
    ],
    "originality_rules": [
      "Use approved TranFu assets for TranFu work only.",
      "Create new copy and appropriate new composition for new pages.",
      "Preserve design principles, not screenshot geometry.",
      "Never make non-TranFu output look like the TranFu official website."
    ],
    "downstream_prompt": "Use the Downstream Production Prompt section in this file as the production handoff."
  }
}
```
