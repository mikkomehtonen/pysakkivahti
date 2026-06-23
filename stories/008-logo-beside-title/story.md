# Add Logo Beside Page Title

## Context

The app's top-of-page header shows only the wordmark "Pysäkkivahti" as an `<h1>`. The project already has a brand mark — `public/favicon.svg` — but it is used only as the browser tab icon. The user wants the brand mark displayed to the left of the title so the header reads `[logo] Pysäkkivahti`, reinforcing brand identity at first glance. The Finnish spelling of the title ("Pysäkkivahti", with `ä`) must be preserved exactly as it is today.

## Out of Scope

- Replacing or redrawing the favicon asset — reuse `public/favicon.svg` as-is.
- Inlining the SVG markup into `app.ts` — an `<img>` reference keeps the code clean and avoids duplicating the 37-line SVG.
- Adding the logo anywhere other than the app header (e.g. not in the browser tab, not in the status bar).
- Apple Touch Icon / PWA manifest icons (listed in product Non-Goals).
- Making the logo interactive (click/link) or animated.

## Implementation approach

The header is built once in `App.renderSkeleton()` (`src/app.ts`, lines ~154–182) as `<header class="app-header">` containing a single `<h1 class="app-title">Pysäkkivahti</h1>`. The header is never re-rendered after the skeleton (only `.location-header`, departures, status, and buttons are updated by `render()`), so the logo only needs to be added in `renderSkeleton()`.

**DOM change** — insert an `<img>` as the first child of the header, before the `<h1>`:

```
<header class="app-header">
  <img class="app-logo" src="/favicon.svg" alt="" />
  <h1 class="app-title">Pysäkkivahti</h1>
</header>
```

- `src="/favicon.svg"`: Vite serves `public/` at the root path in dev and copies it to `dist/` in production (already confirmed by the existing favicon `<link>` in `index.html` and story 003). The same cached file is reused — no new asset, no extra request beyond the already-loaded favicon.
- `alt=""`: the image is decorative. The adjacent `<h1>` already provides the accessible name "Pysäkkivahti", so an empty `alt` is the correct WCAG choice (screen readers announce the heading, not a redundant "Pysäkkivahti logo").
- `class="app-logo"`: a new class for sizing.

**CSS change** (`src/style.css`) — turn `.app-header` into a horizontal flex row and size the logo:

```css
.app-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.app-logo {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}
```

- `display: flex` + `align-items: center` places the logo and title on one baseline-centered row, matching the existing flex patterns (`.departure-row`, `.status-bar`, `.location-buttons`).
- `gap: var(--space-3)` (12px) uses the existing 4px spacing scale token, consistent with the design system.
- `flex-shrink: 0` on the logo prevents it from being squished on narrow viewports; the title retains `text-wrap: balance` and can wrap if ever needed (it won't here: "Pysäkkivahti" at 2rem + 40px logo + 12px gap ≈ 270px, well within the 480px `#app` max-width).
- The existing `margin-bottom: var(--space-4)` on `.app-header` is preserved (no regression to header spacing).
- The favicon SVG has a square `viewBox="416 158 708 708"` with `preserveAspectRatio="xMidYMid meet"`, so equal `width`/`height` renders it undistorted.

**Logo size is an explicit assumption**: `2.5rem` (40px) is chosen to be slightly larger than the 2rem (32px) title font-size, giving the brand mark presence in the lockup. It is a visual choice; the implementer may fine-tune the value, but 2.5rem is the specified default and the tests assert only on the structural/CSS properties (flex layout, square sizing, `flex-shrink`), not on the exact rem value.

**No server changes** — the favicon is already served in both dev (Vite) and production (`express.static('dist')`).

## Tasks

### Task 1 — Add the logo image to the header in renderSkeleton()

- [App mounted] + inspect the `header.app-header`
  - → contains an `<img>` with class `app-logo`
  - → the img `src` attribute is `/favicon.svg`
  - → the img `alt` attribute is `""` (empty string, decorative)
- [App mounted] + inspect the order of the header's children
  - → `.app-logo` is the first child of the header
  - → `.app-title` is the second child of the header (logo renders to the left of the title)
- [App mounted] + read `.app-title` textContent
  - → equals `Pysäkkivahti` (Finnish spelling with `ä` preserved, no regression)

### Task 2 — Style the header as a horizontal flex row and size the logo

- [style.css] + read the `.app-header` rule
  - → contains `display: flex`
  - → contains `align-items: center`
  - → contains a `gap` declaration using a `var(--space-*)` token
  - → still contains `margin-bottom` (header spacing unchanged)
- [style.css] + read the `.app-logo` rule
  - → the `.app-logo` rule exists
  - → declares equal `width` and `height` (square, matching the favicon's square aspect ratio)
  - → declares `flex-shrink: 0`

### Task 3 — Add automated tests for the logo and header layout

- [new test "renders the logo to the left of the app title" in the `App` describe block] + run `npm test`
  - → passes: `header` contains `img.app-logo` with `src="/favicon.svg"` and `alt=""`
  - → passes: `.app-logo` precedes `.app-title` in DOM order (assert via child index comparison)
  - → passes: `.app-title` textContent is `Pysäkkivahti`
- [new CSS test in the `style.css` describe block] + run `npm test`
  - → passes: `.app-header` rule contains `display: flex` and `align-items: center`
  - → passes: `.app-header` rule contains a `gap` using a `var(--space-*)` token and still contains `margin-bottom`
  - → passes: a `.app-logo` rule exists with equal `width` and `height` and `flex-shrink: 0`
- [existing test "wraps the app title in a header element and content in a main element"] + run `npm test`
  - → still passes (header still contains `.app-title`; adding the img sibling does not break it)

### Task 4 — Verify typecheck, lint, and the full test suite

- [all changes complete] + `npm run typecheck`
  - → exits with code 0
- [all changes complete] + `npm run lint`
  - → exits with code 0
- [all changes complete] + `npm test`
  - → exits with code 0, including the `impeccable detect src/` anti-pattern test (the added `<img>` + flex layout introduces no gradients, purple/cyan colors, hover transforms, or icon-tile-stacked-above-heading patterns)

## Technical Context

- **No new dependencies.** The change is pure DOM (`document.createElement('img')`) and CSS. `package.json` is unchanged.
- **Favicon path**: `public/favicon.svg` is served at `/favicon.svg` in dev (Vite `public/` convention) and production (`express.static('dist')` after `vite build` copies `public/` into `dist/`). Confirmed by the existing `<link rel="icon" href="/favicon.svg">` in `index.html` (story 003).
- **Favicon geometry**: `viewBox="416 158 708 708"` is square (708×708) with `preserveAspectRatio="xMidYMid meet"`, so equal CSS `width`/`height` displays it without distortion.
- **Test environment**: `vitest` runs in `happy-dom`. An `<img>` created via `document.createElement('img')` with `src` set will not actually fetch over the network in happy-dom, so tests assert on the `src`/`alt` attributes and DOM order, not on image load events. This matches the existing test style (manual `globalThis.fetch` mocks, structural DOM assertions).
- **Anti-pattern detector**: `tests/app.test.ts` runs `npx --no-install impeccable detect src/` and asserts exit code 0. The detector flags icon-tiles stacked *above* headings, hero eyebrow chips, purple/cyan palettes, gradient text, and `img:hover { transform }`. The logo is placed *beside* (not above) the title, has no background/border/svg-child tile shape, uses no new colors, and has no hover transform — so none of these trigger.

## Notes

- The `<h1>` text remains `Pysäkkivahti` (with `ä`). Do not "fix" the spelling to an ASCII form.
- `alt=""` is intentional: the logo is decorative and the `<h1>` provides the accessible name. Do not add `alt="Pysäkkivahti"` — that would be announced redundantly alongside the heading by screen readers.
- The logo size (2.5rem) is an explicit visual assumption; see Implementation approach. Tests must not hard-assert on `2.5rem` so the value can be tuned without breaking tests.
- All user-facing strings remain in Finnish; no new UI text is introduced by this change.
