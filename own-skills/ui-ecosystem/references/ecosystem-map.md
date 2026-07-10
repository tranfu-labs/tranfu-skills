# UI Ecosystem Map

Use this reference only after the project's frontend direction is known. Prefer current official docs before relying on remembered API details.

## Stack To Ecosystem Hints

| Selected stack or need | First places to inspect | Common adopt / activate candidates | Notes |
|---|---|---|---|
| React / Next.js + Tailwind | `package.json`, Tailwind config, `app/` or `pages/`, component directories | shadcn/ui, Radix UI, lucide-react, Framer Motion, TanStack Table, React Hook Form, Zod | shadcn is pattern/source integration, not a runtime UI kit; verify local component ownership before adding. |
| React without Tailwind | existing CSS modules, styled-components, Emotion, MUI, Mantine, Chakra, Ant Design | current project UI kit first, then matching component primitives | Do not mix multiple full UI kits unless the project already does so. |
| Vue / Nuxt | `nuxt.config`, `vite.config`, `src/components`, package manifest | Naive UI, Element Plus, Vuetify, Headless UI Vue, VueUse, Motion for Vue | Prefer one UI kit and its theme system. |
| Svelte / SvelteKit | `svelte.config`, package manifest, route/components dirs | Skeleton, Melt UI, bits-ui, shadcn-svelte, lucide-svelte | Check SSR compatibility and styling assumptions. |
| Astro content/marketing site | `astro.config`, content collections, integration list | Astro integrations, Tailwind, Starlight for docs, icon integrations | Marketing pages need real assets and responsive first viewport checks. |
| Charts / analytics | data model, chart types, interaction needs | Recharts, ECharts, Nivo, Visx, Tremor, Chart.js | Choose based on interaction complexity and existing framework. |
| Data tables | sorting/filtering/pagination/virtualization needs | TanStack Table, AG Grid, MUI Data Grid, Ant Table | AG Grid/MUI Pro may have license/commercial constraints. |
| Forms | validation, field complexity, schema source | React Hook Form, Formik, Zod, Yup, VeeValidate, Vest | Match validation to existing schema and API patterns. |
| Motion / interactions | existing animation package, performance constraints | Framer Motion, Motion One, GSAP for specialized animation | Avoid adding motion just for decoration. |
| Icons | existing icon dependency or design system | lucide, Heroicons, Phosphor, Remix Icons, Tabler Icons | Use icons in tool buttons before custom SVGs. |
| Visual QA | local dev server and browser tooling | browser/chrome skills, Playwright screenshots, accessibility checks | For UI work, verify desktop and mobile viewports. |
| Reference UI patterns | page type and target audience | similar-project-reference, official examples, design galleries, mature OSS apps | Absorb patterns; do not copy code without license review. |

## MCP / Plugin / Skill Discovery Queries

Use these as starting points for `tool_search` or equivalent discovery:

- frontend design system component generation
- browser visual inspection screenshot
- Figma design asset MCP
- shadcn UI docs components
- React Tailwind design polish skill
- Vue component library docs
- Playwright browser control
- accessibility web design guidelines
- similar project reference UI patterns

## Decision Shortcuts

- If the project already has a design system, activate and extend it before adding a new one.
- If the page is operational software such as CRM, SaaS, admin, analytics, or internal tools, prefer quiet dense components, predictable navigation, and strong tables/forms over marketing-style cards.
- If the page is a brand, venue, product, portfolio, or landing page, require visual assets and first-viewport brand signal.
- If adding a dependency would outlive one screen, record why it is adopted and what exit condition would remove it.
- If a candidate is only useful as inspiration, mark it `absorb`, not `adopt`.
