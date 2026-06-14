# Add Favicon

## Context

The app has no favicon. A `favicon.svg` file already exists in the project root but is not referenced by `index.html` or placed in a Vite asset directory. Browsers display a generic placeholder instead of the app icon.

## Out of Scope

- Multiple favicon formats (e.g. `.ico`, `.png`) — SVG is sufficient for all modern browsers
- Apple Touch Icon or manifest icons — covered by a future PWA story (listed in Non-Goals)
- Dynamic favicons or browser tab title changes

## Implementation approach

Vite treats the `public/` directory as a static asset root: files placed there are copied verbatim to `dist/` on build and served at the path root (`/`). This is the standard Vite convention and requires no configuration changes.

1. Create `public/` directory (it does not exist yet)
2. Move `favicon.svg` from the project root to `public/favicon.svg`
3. Add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` inside `<head>` of `index.html`

The `type="image/svg+xml"` attribute is recommended for SVG favicons so browsers that support it can use the file directly. Browsers that do not support SVG favicons will show no icon — this is an acceptable edge case.

No server-side changes are needed:
- **Dev mode**: Vite dev server serves `public/` files at the root path by default
- **Production**: `express.static('dist')` already serves everything in `dist/`, including the copied favicon

## Tasks

### Task 1 — Move favicon to public/ and link it in index.html

- `public/` directory does not exist + create it
  - → `public/` directory exists
  - → `public/favicon.svg` exists with identical content to the original root `favicon.svg`
  - → root-level `favicon.svg` no longer exists
- `index.html` has no favicon link + add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` inside `<head>`
  - → `index.html` contains a `<link>` element with `rel="icon"`, `href="/favicon.svg"`, and `type="image/svg+xml"`
  - → the `<link>` appears before the `<title>` element (standard convention for head elements)
- automated test: `public/favicon.svg` file exists and has non-zero size
  - → test passes
- automated test: `index.html` contains the favicon link with correct attributes
  - → test passes via regex assertion on `readFileSync` output
- automated test: root-level `favicon.svg` no longer exists
  - → test passes via `existsSync` check

## Notes

- The existing `favicon.svg` is an SVG XML document (confirmed via `file` command, 2083 bytes)
- All existing tests must continue to pass (no breaking changes to `index.html` structure)
- The `index.html` test in `tests/app.test.ts` already asserts on the viewport meta tag via `readFileSync` — add the favicon assertion to the same `describe('index.html')` block
