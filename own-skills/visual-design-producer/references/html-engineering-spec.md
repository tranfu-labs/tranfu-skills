# HTML Engineering Spec

Produce HTML artifacts in `visual-design-producer` according to this spec. It covers structural correctness, runtime-safe patterns, and medium-specific engineering rules. It works alongside the anti-slop quality gate — that reference guards visual and content quality; this one guards how the HTML itself is built.

## Self-Contained Output

- Default to a single self-contained HTML file. Inline CSS and JS unless a project explicitly uses multiple files.
- Use descriptive filenames like `Landing Page.html` or `Onboarding Prototype.html`, not `output.html`.
- Reference no local-only assets. Use clearly marked placeholders or externally hosted, license-free assets only.

## React + Babel (for inline JSX prototypes)

When writing React prototypes with inline JSX, use pinned versions with integrity hashes. Never use unpinned versions (for example `react@18`) or omit the integrity attributes.

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
```

Avoid `type="module"` on script imports — it can break in-browser transpilation.

## Naming And Scope Rules

- Never declare a generic `const styles = { ... }` in shared scope. If two components each define an object named `styles`, the second clobbers the first and rendering breaks silently. Give each object a unique name based on the component, for example `const heroStyles = { ... }`, or use inline styles.
- Each `<script type="text/babel">` block has its own transpiled scope. Components are NOT shared between blocks automatically. To share, export them to `window` at the end of each block:

```js
Object.assign(window, { Hero, FeatureCard, Footer });
```

## Fixed-Size Content (decks, posters, video)

Slide decks, posters, and other fixed-canvas content must self-scale to any viewport. Pattern: a fixed-size canvas (default 1920×1080, 16:9) inside a full-viewport stage that letterboxes on black using `transform: scale()`. Put prev/next controls OUTSIDE the scaled element so they stay usable on small screens.

Slide labels are 1-indexed to match what users say. "slide 5" means the 5th slide, label `05`, never array position `[4]`. Humans do not speak zero-indexed. Tag slide roots with `data-screen-label` like "01 Title", "02 Agenda".

## Type And Tap-Target Sizing

- 1920×1080 deck slides: text never smaller than 24px, ideally much larger.
- Print documents: minimum 12pt body.
- Mobile mockup hit targets: never smaller than 44px.

## Persistence

For decks and other position-bearing content, persist the current position (slide index, playback time) to `localStorage` on every change and re-read it on load. Users refresh freely during iterative design; losing their place is a common and avoidable failure.

## Safe DOM Patterns

- Never call `element.scrollIntoView()` — it can hijack the host scroll container and break the surrounding page. Use `element.scrollTop`, `window.scrollTo`, or set a container's `scrollTop` directly.
- Never add a "title screen" wrapper to prototypes unless explicitly asked. Center the prototype in the viewport with reasonable margins instead.

## Color

Use colors from the Visual DNA or the provided brand context first. If those are too restrictive, define additional harmonious colors in `oklch()` that match the existing palette. Do not invent clashing colors from scratch.

## Speaker Notes (decks only)

Add speaker notes only when the user explicitly asks. Format:

```html
<script type="application/json" id="speaker-notes">
["Slide 0 notes", "Slide 1 notes"]
</script>
```

If the deck is embedded in a host shell that renders speaker notes (for example a preview pane that reads the `#speaker-notes` block), call `window.postMessage({ slideIndexChanged: N })` on init and on every slide change so the host can sync. In a standalone HTML file there is no parent listener, so this call is a no-op — the notes block is still valid data that any future renderer can read.

## Pre-Delivery Structural Self-Check

There is no automated verifier in this environment, so run this checklist before delivering:

- All HTML tags are closed and balanced; no stray `<` or unescaped entities in visible text.
- Every `<script src>` URL is reachable; React, ReactDOM, and Babel are pinned with integrity hashes.
- No duplicate global `const` or `function` names across script blocks.
- No `scrollIntoView` calls.
- The file opens and renders without console errors in a quick local check.
- Fixed-size content scales down on a narrow viewport without clipping the controls.
