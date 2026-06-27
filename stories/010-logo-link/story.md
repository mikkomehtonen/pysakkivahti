# Make the Header Logo a Configurable Link

## Context

Story 008 added the brand mark (`public/favicon.svg`) as a decorative `<img class="app-logo">` to the left of the "Pysäkkivahti" title in the app header. The logo is currently non-interactive. The user wants the logo image to be a hyperlink whose target is read from a `LOGO_LINK_URL` environment variable, so operators can point the logo at an external brand/homepage URL. When the env var is not set, the logo stays a plain (non-interactive) image — the current behavior is preserved exactly.

## Out of Scope

- Making the title text (`<h1>`) a link — only the logo image becomes a link.
- Opening the link in a new tab — the link opens in the same tab (plain `<a href>`, no `target` attribute).
- Validating or restricting the URL scheme of `LOGO_LINK_URL` — the value is operator-controlled via env var, not user input, so no `javascript:`/`http:` scheme filtering is required.
- Adding a dedicated `/api/config` endpoint — `logoLinkUrl` is piggybacked onto the existing `/api/locations` response, following the `refreshInterval` precedent.
- Changing the favicon asset, the logo size, or the header flex layout established in story 008.
- Making the logo link conditional on anything other than the presence of a non-empty `LOGO_LINK_URL`.

## Implementation approach

**Architecture decision — runtime env var via the server, not build-time Vite injection.** The codebase has no build-time env injection (no `VITE_*` vars, no `import.meta.env` usage). All server-side config (`PYSAKKIVAHTI_API_KEY`, `PORT`) is read at runtime via `process.env` in `server.ts`, and the frontend learns server config only through `/api/*` endpoints (proxy pattern, per AGENTS.md). `LOGO_LINK_URL` follows this exact pattern: the server reads `process.env.LOGO_LINK_URL` at request time and exposes it to the frontend via the `/api/locations` response.

**Why `/api/locations` and not a new endpoint.** `LocationsResponse` already bundles a global app setting (`refreshInterval`) alongside locations — a precedent for piggybacking global config on that endpoint. `/api/locations` is also the first endpoint the app fetches on mount (`App.mount()` → `fetchLocations()`), so the logo URL is available immediately after the initial load with no extra request.

**Type change** (`src/types.ts`) — add an optional field to `LocationsResponse`:

```ts
export interface LocationsResponse {
  locations: Location[];
  refreshInterval: number;
  logoLinkUrl?: string;
}
```

Optional (not required) so existing test mocks that don't include `logoLinkUrl` still typecheck without modification.

**Server change** (`server.ts`) — `buildLocationsResponse()` reads and trims the env var, including `logoLinkUrl` in the response only when the trimmed value is non-empty:

```ts
export function buildLocationsResponse(): LocationsResponse {
  const hour = new Date().getHours();
  const logoLinkUrl = process.env.LOGO_LINK_URL?.trim();
  return {
    locations: config.locations.map((location) => {
      const route = selectRoute(location, hour);
      return {
        id: location.id,
        name: location.name,
        destination: resolveDestination(location, route),
      };
    }),
    refreshInterval: config.refreshInterval,
    ...(logoLinkUrl ? { logoLinkUrl } : {}),
  };
}
```

- `process.env.LOGO_LINK_URL?.trim()` — optional chaining handles `undefined` (env var unset); `.trim()` handles whitespace-only values. Both yield a falsy string, so the spread `...(logoLinkUrl ? { logoLinkUrl } : {})` omits the field.
- The field is read at call time (inside the route handler), not at module load, so `vi.stubEnv('LOGO_LINK_URL', ...)` in tests takes effect.

**API validation change** (`src/api.ts`) — `fetchLocations()` must validate the new field if present:

```ts
if (
  !Array.isArray(data.locations) ||
  typeof data.refreshInterval !== 'number' ||
  (data.logoLinkUrl !== undefined && typeof data.logoLinkUrl !== 'string')
) {
  throw new Error('Sijaintien hakeminen epäonnistui: virheellinen vastaus');
}
```

**Frontend state** (`src/app.ts`) — add `logoLinkUrl: string` to `AppState`, initialized to `''` in the constructor. After `fetchLocations()` resolves in both `mount()` and `reloadLocations()`, store the value:

```ts
this.state.logoLinkUrl = locationsResponse.logoLinkUrl ?? '';
```

**Frontend DOM change** (`src/app.ts`) — the logo is built once in `renderSkeleton()` (lines ~165–168) as a plain `<img>`, before `fetchLocations()` resolves. A new method `applyLogoLink()` is called after the locations response is processed (in `mount()` and `reloadLocations()`). It wraps the existing `img.app-logo` in an `<a>` only when `logoLinkUrl` is non-empty after trimming:

```ts
private applyLogoLink(): void {
  const header = this.container.querySelector('.app-header');
  if (!header) return;
  const logo = header.querySelector('img.app-logo');
  if (!logo) return;
  const url = this.state.logoLinkUrl.trim();
  if (!url) return;
  const parent = logo.parentElement;
  if (parent instanceof HTMLAnchorElement && parent.classList.contains('app-logo-link')) {
    parent.href = url;
    return;
  }
  const link = document.createElement('a');
  link.className = 'app-logo-link';
  link.href = url;
  link.setAttribute('aria-label', 'Pysäkkivahti');
  logo.replaceWith(link);
  link.appendChild(logo);
}
```

- `logo.replaceWith(link)` then `link.appendChild(logo)` moves the existing img into the new `<a>` without recreating it.
- The method is idempotent: if the img is already inside an `app-logo-link` anchor, it only updates the `href`.
- No `target` attribute → the link opens in the same tab (per user decision).
- `aria-label="Pysäkkivahti"` gives the link an accessible name. The img keeps `alt=""` (decorative); without the `aria-label`, a link containing only an `alt=""` image would have no accessible name, which is a WCAG issue. The label matches the brand name used by the adjacent `<h1>`.
- When `logoLinkUrl` is empty/absent, `applyLogoLink()` returns early — the img stays a direct child of the header (current behavior, no regression).

**CSS change** (`src/style.css`) — add a rule for the link wrapper so it doesn't break the flex layout or introduce an under-image baseline gap:

```css
.app-logo-link {
  display: inline-flex;
  flex-shrink: 0;
  text-decoration: none;
}

.app-logo-link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- `display: inline-flex` — the `<a>` becomes a flex container for the img, eliminating the inline-baseline gap that would otherwise appear under the image. In the parent `.app-header` (already `display: flex`), the `<a>` is a flex item regardless of its own `display`.
- `flex-shrink: 0` — prevents the link from being squished on narrow viewports, matching the existing `.app-logo { flex-shrink: 0 }`.
- `text-decoration: none` — defensive; an `<a>` wrapping only an img shows no visible underline, but this guarantees it across browsers.
- `:focus-visible` outline — matches the existing focus-ring pattern on `.refresh-btn` and `.location-btn` (2px solid accent, 2px offset), providing keyboard accessibility.

**`.env.example`** — add `LOGO_LINK_URL=` on a new line to document the env var. No value (the operator fills in their URL); when left empty/unset, the logo is not a link.

**Docker** — no Dockerfile changes. `.env` is in `.dockerignore`; `LOGO_LINK_URL` is passed at runtime via `docker run -e LOGO_LINK_URL=...` or a container orchestration env setting, exactly like `PYSAKKIVAHTI_API_KEY`.

## Tasks

### Task 1 — Expose LOGO_LINK_URL through the /api/locations response

- [`LOGO_LINK_URL` env set to `https://example.com`] + GET `/api/locations`
  - → response body contains `logoLinkUrl` equal to `https://example.com`
- [`LOGO_LINK_URL` env unset] + GET `/api/locations`
  - → response body does not contain a `logoLinkUrl` field (or it is `undefined`)
- [`LOGO_LINK_URL` env set to `"  "` (whitespace only)] + GET `/api/locations`
  - → response body does not contain a `logoLinkUrl` field (trimmed to empty, omitted)
- [`LOGO_LINK_URL` env set to `"  https://example.com  "` (surrounding whitespace)] + GET `/api/locations`
  - → response body contains `logoLinkUrl` equal to `https://example.com` (trimmed)

### Task 2 — Wrap the logo image in a link when logoLinkUrl is provided

- [locations response includes `logoLinkUrl: 'https://example.com'`] + App mounted
  - → `header.app-header` contains an `<a>` with class `app-logo-link`
  - → the `<a>` `href` attribute is `https://example.com`
  - → the `<a>` has `aria-label` equal to `Pysäkkivahti`
  - → the `<a>` has no `target` attribute (same-tab navigation)
  - → `img.app-logo` is a child of the `<a>` (the img is inside the link, not a direct child of the header)
  - → `img.app-logo` still has `src="/favicon.svg"` and `alt=""` (unchanged)
- [locations response does not include `logoLinkUrl`] + App mounted
  - → `header.app-header` does not contain an `<a>` element (no `.app-logo-link`)
  - → `img.app-logo` is a direct child of `header.app-header` (current behavior preserved)
- [locations response includes `logoLinkUrl: ''` (empty string)] + App mounted
  - → `header.app-header` does not contain an `<a>` element (empty string treated as no link)
- [existing test "renders the logo to the left of the app title"] + run `npm test`
  - → still passes (default mock has no `logoLinkUrl`; img is a direct child of the header at index 0, title at index 1)

### Task 3 — Style the logo link wrapper and add a focus ring

- [style.css] + read the `.app-logo-link` rule
  - → the rule exists
  - → contains `display: inline-flex`
  - → contains `flex-shrink: 0`
  - → contains `text-decoration: none`
- [style.css] + read the `.app-logo-link:focus-visible` rule
  - → the rule exists and contains an `outline` declaration

### Task 4 — Document the env var and verify tooling

- [`.env.example`] + read file contents
  - → contains a line `LOGO_LINK_URL=`
- [all changes complete] + `npm run typecheck`
  - → exits with code 0
- [all changes complete] + `npm run lint`
  - → exits with code 0
- [all changes complete] + `npm test`
  - → exits with code 0, including the `impeccable detect src/` anti-pattern test (the `<a>` wrapper adds no gradients, purple/cyan colors, hover transforms, or icon-tile-stacked-above-heading patterns)

## Technical Context

- **No new dependencies.** The change is pure DOM (`document.createElement('a')`, `replaceWith`, `appendChild`), CSS, and an env-var read. `package.json` is unchanged.
- **Env-var reading pattern.** `server.ts` already reads `process.env.PYSAKKIVAHTI_API_KEY` (line 149) and `process.env.PORT` (line 16) at runtime. `LOGO_LINK_URL` follows the same pattern. `dotenv/config` is imported at the top of `server.ts` (line 1), so `.env` values are loaded into `process.env` before any request handler runs.
- **`LocationsResponse` precedent.** The type already carries `refreshInterval` (a global setting unrelated to any single location), bundled into `/api/locations`. `logoLinkUrl` is another global setting, so it belongs on the same response.
- **Test environment.** `vitest` runs in `happy-dom`. `document.createElement('a')`, `Element.replaceWith()`, and `Node.appendChild()` are all supported in happy-dom. The existing `App` tests mock `globalThis.fetch` manually with `vi.fn()` and assert on DOM structure — the new tests follow the same pattern. Server tests use `vi.stubEnv('LOGO_LINK_URL', ...)` (same pattern as the existing `vi.stubEnv('PYSAKKIVAHTI_API_KEY', ...)` in `tests/server.test.ts` line 151).
- **Anti-pattern detector.** `tests/app.test.ts` runs `npx --no-install impeccable detect src/` and asserts exit code 0. The detector flags icon-tiles stacked above headings, hero eyebrow chips, purple/cyan palettes, gradient text, and `img:hover { transform }`. The `<a>` wrapper uses no new colors, no hover transform, no tile shape, and the logo remains beside (not above) the title — none of these trigger.
- **Existing logo test compatibility.** The test "renders the logo to the left of the app title" (`tests/app.test.ts` lines 162–186) uses `defaultLocations` which has no `logoLinkUrl` field. With no `logoLinkUrl`, `applyLogoLink()` returns early and the img remains a direct child of the header — so `logoIndex === 0` and `titleIndex === 1` still hold. No modification to that test is needed.

## Notes

- The link opens in the **same tab** (no `target="_blank"`), per the user's explicit choice. Do not add `target` or `rel` attributes.
- `aria-label="Pysäkkivahti"` on the `<a>` is intentional for accessibility: a link containing only an `alt=""` image has no accessible name otherwise. The img itself keeps `alt=""` (decorative) — do not change the img's `alt` to a non-empty value.
- `LOGO_LINK_URL` is operator-controlled (env var), not user input, so no URL-scheme validation is performed. If the operator sets `LOGO_LINK_URL=javascript:alert(1)`, that is their configuration choice, not an attack vector.
- When `/api/locations` fails (network error), `logoLinkUrl` is never set in state and the logo remains a plain img. This is acceptable: the app shows an error state when locations fail to load, and the logo link is a secondary feature.
- All user-facing strings remain in Finnish; no new UI text is introduced (the `aria-label` value "Pysäkkivahti" is the existing brand name, not new text).
- The `.app-logo` CSS rule (size, `flex-shrink: 0`) is unchanged; the new `.app-logo-link` rule only styles the wrapper `<a>`.
