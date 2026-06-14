# Impeccable UI Redesign

## Context

Pysäkkivahti's UI is functionally complete but visually plain — a single generic system-font stack, monotonous spacing, flat typographic hierarchy, and a flagged AI-slop anti-pattern (side-tab border on the GPS button). Running `npx impeccable detect src/` reports 1 anti-pattern: `side-tab` at `style.css:127` (`border-left: 4px solid #4caf50` on `.location-btn--gps`). Impeccable provides the design vocabulary, skill commands, and deterministic anti-pattern detection to guide a principled redesign that makes the app look modern and attractive without falling into AI-generated visual clichés.

## Out of Scope

- Server-side code changes (`server.ts`, `config.ts`, `digitransit.ts`, `geo.ts`)
- API client or geolocation logic changes (`api.ts`, `geolocation.ts`)
- Data type changes (`types.ts`)
- New features (PWA, dark mode, stop search, notifications)
- Changes to Finnish user-facing text strings
- JavaScript framework introduction (remains vanilla TS)
- Docker or deployment configuration changes

## Implementation Approach

**Impeccable setup**: Install `impeccable@2.3.2` as a devDependency (already present). Run `npx impeccable skills install` to make design commands available to the AI harness. Create `PRODUCT.md` at the project root capturing the strategic context (audience: Tampere-area daily commuters glancing at their phone; register: product; voice: calm, factual, Finnish; brand hue: `oklch(57.4% 0.234 260.5)` derived from favicon `#0A6BFF`; anti-references: purple gradients, glassmorphism, cream/beige backgrounds, AI color palette). Create `DESIGN.md` via `/impeccable document --seed` capturing the visual system (six sections: Overview, Colors, Typography, Elevation, Components, Do's and Don'ts).

**Register — Product**: This is a tool app, not a marketing surface. Per Impeccable's register system: fluent density, semantic states, repeatable components. Design serves the task of reading departures quickly.

**Typography** (guided by `/impeccable typeset`):
- Replace the single generic system-font stack with a distinctive display + body font pairing.
- Display font: one Google Font loaded via `<link rel="preconnect">` + `<link href="...&display=swap">` in `index.html`, used for the app title and location header. Must not be Inter, Geist, Space Grotesk, or Instrument Serif (Impeccable's "overused font" anti-pattern). Must support Finnish diacritics (ä, ö, å).
- Body font: system font stack for all other text (performance, offline resilience, zero additional network payload).
- Modular type scale with ≥1.25 ratio between steps. Minimum 4 distinct sizes: display → title → body → caption.
- Body text ≥ 16px (1rem). Line-height 1.5–1.7 for body, 1.1–1.2 for display headings.
- Line length capped at 75ch on text containers.

**Color** (guided by `/impeccable colorize`):
- Brand hue: `oklch(57.4% 0.234 260.5)` — derived from favicon `#0A6BFF` (transit blue). Define as `--color-accent` CSS custom property.
- Neutrals tinted toward brand hue at low chroma (0.005–0.01) via `oklch()` for subconscious cohesion.
- Primary action (active location button, route number badge): full accent.
- Route number badges: colored background using accent or a transit-category tint (limited 2–3 hue system, not rainbow).
- Realtime indicator: subtle green accent (e.g., small dot or text-decoration) — not the side-tab border.
- Error state: warm red meeting WCAG AA contrast.
- Background: not cream/beige. Use a cool-tinted neutral derived from the brand hue.
- All `oklch()` values preceded by `rgb()` fallback for browsers without OKLCH support (Safari < 15.4, etc.).

**Spacing** (guided by `/impeccable layout`):
- Consistent 4px-based spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48px, expressed as CSS custom properties (`--space-*`).
- Tight grouping within departure rows (8px vertical gap), generous separation between sections (24–32px).
- Card containers with 16–24px padding.
- No monotonous repetition of the same spacing value.

**Anti-pattern removal**:
- Remove `.location-btn--gps` `border-left: 4px solid #4caf50` — the flagged `side-tab` pattern.
- Replace with a small inline `.gps-indicator` element (e.g., a Unicode pin character or CSS pseudo-element dot) inside the button text.
- No glassmorphism, gradient text, purple/violet/cyan primary, cream/beige backgrounds, extreme border-radius (>16px on cards), bounce/elastic easing.

**Interaction states**:
- Hover: subtle background shift on buttons.
- Focus: visible `:focus-visible` outline/ring meeting WCAG 2.4.7.
- Active: pressed state for buttons.
- Transitions: `ease-out` 150–200ms for state changes. `@media (prefers-reduced-motion: reduce)` block sets `transition-duration: 0s`.

**HTML structure updates in `app.ts`**:
- In `renderSkeleton()`, wrap `h1.app-title` in a `<header>` element with class `app-header`.
- In `renderSkeleton()`, wrap `.location-header`, `.departures-container`, `.status-bar`, and `.location-buttons` in a `<main>` element.
- Add `.gps-indicator` inline element inside GPS-detected buttons (the button text becomes: `<span class="gps-indicator"></span>{name}`).
- Preserve all existing CSS class names that tests depend on (`.location-btn--gps`, `.location-btn--active`, `.departure-row`, `.departure--realtime`, `.route-number`, `.departure-headsign`, `.departure-time`, `.loading`, `.error`, `.empty`, `.refresh-btn`, `.last-updated`, `.location-buttons`, `.departures-container`, `.status-bar`, `.location-header`, `.app-title`).

**Test updates**:
- The `style.css` describe block in `app.test.ts` asserts specific CSS rules. Update regexes to match the new CSS structure (e.g., if `.route-number` font-size changes from `1.25rem`, update the assertion). Preserve accessibility-critical assertions: `min-height: 44px` on `.location-btn`, `max-width: 100vw` and `overflow-x: hidden` on `body`.
- Add a test verifying `.gps-indicator` element exists in GPS-detected buttons.
- Add a test verifying `npx impeccable detect src/` exits with code 0.

## Tasks

### Task 1 — Install Impeccable & Create Design Context

- [impeccable installed] + `npx impeccable skills install` from project root
  - → `.opencode/skills/` directory contains impeccable skill files (or equivalent harness directory)
- [PRODUCT.md created at project root] + read file
  - → contains "Audience" field referencing Tampere commuters
  - → contains "Register" field set to "product"
  - → contains "Voice" field (calm, factual, Finnish)
  - → contains "Brand hue" field with `oklch(57.4% 0.234 260.5)` or equivalent derived from `#0A6BFF`
  - → contains "Anti-references" field listing at least: purple gradients, glassmorphism, cream/beige backgrounds
- [DESIGN.md created at project root] + read file
  - → contains section `## 01 Overview`
  - → contains section `## 02 Colors`
  - → contains section `## 03 Typography`
  - → contains section `## 04 Elevation`
  - → contains section `## 05 Components`
  - → contains section `## 06 Do's and Don'ts`

### Task 2 — Redesign Typography & Color in style.css and index.html

- [index.html updated with Google Font preconnect + font link] + parse HTML
  - → `<link rel="preconnect" href="https://fonts.googleapis.com">` present
  - → `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` present
  - → `<link href="https://fonts.googleapis.com/css2?family=...&display=swap">` present
  - → font link tags appear before `<title>` element
  - → chosen font family name is NOT Inter, Geist, Space Grotesk, or Instrument Serif
- [style.css rewritten] + parse CSS rules
  - → `:root` block defines `--color-accent` custom property with `oklch()` value
  - → `:root` block defines at least 4 `--space-*` custom properties following 4px scale
  - → `.app-title` and `.location-header` use the Google Font display face (not the system stack)
  - → body `font-size` is ≥ `1rem`
  - → type scale has at least 4 distinct `font-size` values with ≥1.25 ratio between consecutive steps
  - → `.location-btn` rule specifies `min-height: 44px`
  - → `body` rule specifies `max-width: 100vw` and `overflow-x: hidden`
  - → `.location-btn--gps` rule does NOT contain `border-left` property
  - → no CSS rule uses `border-radius` value > `16px` on card/container selectors
  - → no CSS rule uses `background-clip: text` with a gradient (gradient-text anti-pattern)
  - → no color value in purple/violet/cyan range (`oklch(* 0.1+ 270-330)` or hex `#7c3aed`/`#8b5cf6`/`#06b6d4`) is used as primary
  - → `body` background is NOT a warm cream/beige (`#f5f5f5`, `#faf5ee`, or similar hex with lightness > 90% and warm hue)
- [style.css rewritten] + check interaction states
  - → `.location-btn:focus-visible` rule exists with `outline` or `box-shadow` property
  - → `.refresh-btn:focus-visible` rule exists with `outline` or `box-shadow` property
  - → at least one button selector has `:hover` pseudo-class rule
  - → at least one button selector has `:active` pseudo-class rule
  - → `.location-btn` or `.refresh-btn` has `transition` property with duration ≤ 200ms
  - → no `transition-timing-function` value contains `bounce` or `elastic`
  - → `@media (prefers-reduced-motion: reduce)` block exists and sets `transition-duration: 0s` or equivalent
- [style.css rewritten] + check color contrast (verified by `npx impeccable detect` which includes the `low-contrast-text` quality rule)
  - → `npx impeccable detect src/` does not report `low-contrast-text`

### Task 3 — Update app.ts HTML Structure for Redesigned Elements

- [app.ts updated] + app mounts with default mock data
  - → container contains a `<header>` element (wrapping app title)
  - → container contains a `<main>` element (wrapping location header, departures, status, buttons)
  - → `.app-title` element is a descendant of the `<header>` element
  - → `.departures-container` is a descendant of the `<main>` element
  - → `.location-header` is a descendant of the `<main>` element
- [app.ts updated, GPS location detected] + render GPS button
  - → GPS-detected button contains a child element with class `gps-indicator`
  - → `.gps-indicator` element is an `HTMLElement` (not a CSS border)
  - → GPS-detected button still has CSS class `location-btn--gps`
  - → non-GPS buttons do NOT contain any `.gps-indicator` element
- [app.ts updated] + click different location button
  - → `.location-btn--gps` class is removed from all buttons (existing behavior preserved)
  - → `.gps-indicator` elements are removed from all buttons
- [app.ts updated] + all existing App tests still pass
  - → `npm test` exits with code 0

### Task 4 — Verify Anti-Pattern Free & All Tests Pass

- [all changes complete] + `npx impeccable detect src/`
  - → exits with code 0
  - → reports 0 anti-patterns
- [all changes complete] + `npm test`
  - → exits with code 0
  - → `style.css` describe block assertions pass (updated to match new CSS values)
- [all changes complete] + `npm run typecheck`
  - → exits with code 0
- [all changes complete] + `npm run lint`
  - → exits with code 0

## Technical Context

- **impeccable@2.3.2**: Design skills and anti-pattern detection for AI coding agents. CLI provides `npx impeccable detect <path>` for deterministic anti-pattern scanning (41 rules). Exit code 0 = clean, exit code 2 = anti-patterns found. Skill commands (`/impeccable init`, `/impeccable polish`, `/impeccable typeset`, `/impeccable colorize`, etc.) run inside the AI harness. Requires Node ≥ 18.
- **OKLCH color space**: Perceptually uniform color model used by Impeccable's colorize approach. Supported in Chrome 111+, Firefox 113+, Safari 15.4+. Fallback pattern: declare `rgb()` value first, then `oklch()` on next line — older browsers ignore the `oklch()` declaration.
- **Google Fonts `display=swap`**: Prevents FOIT while loading. Preconnect hints (`fonts.googleapis.com`, `fonts.gstatic.com`) speed up initial DNS + TLS. Load only 1 display font with 2 weights (400 + 700) to keep payload under 30KB.
- **`/impeccable document --seed`**: Creates a scaffold DESIGN.md marked with a `SEED` comment. After implementing the redesign, re-run without `--seed` to capture the actual visual system.

## Notes

- All user-facing Finnish text remains unchanged — this story only changes visual styling and HTML structure.
- The favicon (`public/favicon.svg`) uses blue (`#0A6BFF`) as the brand color — this is the natural starting hue for the color palette, converted to `oklch(57.4% 0.234 260.5)` (computed from sRGB via OKLab matrix).
- The existing test file reads `src/style.css` via `readFileSync` and asserts CSS rules by regex. The assertion for `.route-number` `font-size: 1.25rem` may need updating if the new design uses a different size. Accessibility-critical assertions (`min-height: 44px`, `max-width: 100vw`, `overflow-x: hidden`) must be preserved regardless of design changes.
- The `.location-btn--gps` CSS class must remain (tests assert its presence/absence), but its styling changes from `border-left` to a different visual treatment. The `.gps-indicator` DOM element is the new mechanism for the GPS visual indicator.
- PRODUCT.md and DESIGN.md are new files at the project root. PRODUCT.md is strategic (audience, voice, anti-references); DESIGN.md is visual (colors, typography, components). Both are read by Impeccable commands on every invocation.
