# UI Implementation

## Context

Pysäkkivahti has no application code — only a feasibility study and a plan. This story creates the full project skeleton and a working mobile-friendly frontend that displays public transport departures. A mock Express server provides sample data so the UI can be developed and tested independently of the Digitransit API. This unblocks all subsequent stories (real API proxy, geolocation, time-based routing) by establishing the project architecture and rendering pipeline.

## Out of Scope

- Real Digitransit API integration (separate story)
- config.json loading on the server (mock data is hardcoded)
- Headsign filtering on the server (mock data is pre-filtered)
- Geolocation-based location detection
- Time-based routing (`beforeHour`/`afterHour` for City Centre)
- PWA manifest or service worker
- Stop search UI
- Production deployment configuration (Cloudflare Tunnel, etc.)

## Implementation Approach

**Project setup**: npm project with Express 5 + Vite 8 + TypeScript. `tsx` runs the server directly without a compile step. Vite dev server proxies `/api/*` to Express on port 3000.

**Mock API design**: Two endpoints whose response shapes match what the real API will serve, so the frontend code won't change when the real API story is implemented:

- `GET /api/locations` → `{ locations: Location[], refreshInterval: number }`
- `GET /api/departures?locationId=<id>` → `LocationDepartures`

TypeScript interfaces defined in `src/types.ts`. The server imports from `./src/types.ts` via tsx (which resolves TS imports natively) — no type duplication:

```
Location        = { id: string, name: string, destination: string }
Departure       = { routeShortName: string, headsign: string, minutesUntilDeparture: number, realtime: boolean }
StopDepartures  = { stopName: string, departures: Departure[] }
LocationDepartures = { locationId: string, stops: StopDepartures[] }
```

**Frontend architecture**: Vanilla TypeScript with no framework. `app.ts` manages state (selected location, departures, loading/error status) and renders DOM elements imperatively. `api.ts` wraps `fetch()` calls. `types.ts` defines shared interfaces.

**Rendering approach**: On state change, affected sections are re-rendered by clearing and rebuilding their container elements. No virtual DOM or templating library — the single-view MVP doesn't warrant one.

**Refresh mechanism**: `setInterval` triggers re-fetch at the `refreshInterval` returned by `/api/locations`. Manual refresh calls the same fetch and resets the timer. Both paths update a `lastUpdated` timestamp displayed as a time-ago string.

**Realtime indicator**: Departures with `realtime: true` receive CSS class `departure--realtime` (bold font weight). Non-realtime departures use regular weight.

**City Centre simplification**: Since time-based routing is deferred, the mock returns only one direction for `city_centre` (→ Koti). Time-based route selection will be added in a later story.

**Express 5 specifics**: Express 5 automatically catches rejected promises in `async` route handlers — no `try/catch` + `next(err)` needed. `res.redirect()` signature is now `res.redirect(status, url)` (status first).

**Geolocation stub**: `src/geolocation.ts` exports a function that always returns `null` (unsupported). The import path exists so the next story can fill it in without structural changes.

## Tasks

### Task 1 - Project Skeleton & Mock API Server

- [npm install completed] + `GET /api/locations`
  - → returns 200 with JSON `{ locations: [{id, name, destination}], refreshInterval: 30 }`
  - → `locations` array has exactly 3 items with ids `home`, `work`, `city_centre`
- [npm install completed] + `GET /api/departures?locationId=home`
  - → returns 200 with JSON matching `LocationDepartures` shape
  - → each `StopDepartures.stopName` is a non-empty string
  - → each `Departure` has `routeShortName`, `headsign`, `minutesUntilDeparture` ≥ 0, and `realtime` boolean
  - → at most 3 departures per stop (matching `departuresCount` from plan)
- [npm install completed] + `GET /api/departures?locationId=nonexistent`
  - → returns 404 with JSON `{ error: string }`
- [npm install completed] + `GET /api/departures` (no locationId query param)
  - → returns 400 with JSON `{ error: string }`
- [`npx tsx server.ts`] + server starts
  - → listens on port 3000 (or `PORT` env variable)
  - → logs startup message to stdout

### Task 2 - Frontend: Types, API Client & Core Rendering

- [app mounts, no prior location selected] + initial render
  - → first location from `/api/locations` is auto-selected
  - → location header displays `"{name} → {destination}"`
  - → `fetchDepartures` called with the first location's `id`
- [departures data received with N departures] + render
  - → exactly N departure rows rendered in the departure container
  - → each row shows `routeShortName`, `headsign`, and `"{minutesUntilDeparture} min"`
  - → rows ordered by `minutesUntilDeparture` ascending
- [departure with `realtime: true`] + render
  - → row element has CSS class `departure--realtime`
- [departure with `realtime: false`] + render
  - → row element does not have CSS class `departure--realtime`
- [user clicks an inactive location button] + click event
  - → location header updates to new location's name and destination
  - → `fetchDepartures` called with new `locationId`
  - → clicked button receives CSS class `location-btn--active`
  - → previously active button loses `location-btn--active`
- [fetch in progress] + render
  - → element with CSS class `loading` is visible in the departure area
- [fetch returns network error] + render
  - → element with CSS class `error` is visible
  - → error text includes a human-readable Finnish message
- [fetch returns empty departures array across all stops] + render
  - → text "Ei lähtöjä" is displayed
- [`/api/locations` fetch fails on initial load] + render
  - → element with CSS class `error` is visible with a Finnish error message
  - → no location buttons rendered (no location data available)
  - → departure area shows error state (not "Ei lähtöjä")

### Task 3 - Auto-refresh, Status & Mobile Styling

- [app initialized, refreshInterval = 30] + 30 seconds elapse (via `vi.useFakeTimers`)
  - → `fetchDepartures` is called for the current `locationId`
- [user clicks refresh button] + click event
  - → `fetchDepartures` called for current `locationId`
  - → auto-refresh timer resets (next auto-refresh is `refreshInterval` seconds from click)
- [after successful fetch completes] + render
  - → "Päivitetty" text displayed with time-ago value (e.g., "Päivitetty 0s sitten")
- [error state displayed, then auto-refresh succeeds] + timer fires + fetch succeeds
  - → error message replaced by departure rows
- [`index.html` loaded] + check `<head>`
  - → `<meta name="viewport" content="width=device-width, initial-scale=1">` present
- [loading indicator rendered] + check accessibility
  - → loading element has `aria-label="Ladataan"` or equivalent accessible label
- [location button rendered] + check CSS
  - → `.location-btn` rule specifies `min-height: 44px`
- [departure row rendered] + check CSS
  - → route number uses `font-size ≥ 1.25rem`
- [`body` element] + check CSS
  - → `max-width: 100vw` and `overflow-x: hidden` to prevent horizontal scroll

## Bootstrap

```bash
mkdir -p src
npm init -y
npm install express@5.2.1 dotenv@17.4.2
npm install -D typescript@6.0.3 tsx@4.22.4 vite@8.0.16 esbuild@0.28.1 @types/express@5.0.6 @types/node@25.9.3 vitest@4.1.8 happy-dom@20.10.3
```

After installing dependencies, create the following files:

| File | Purpose |
|---|---|
| `tsconfig.json` | TypeScript config (DOM + ES2022 target, strict mode) |
| `vite.config.ts` | Frontend build + `/api` proxy to `localhost:3000` + vitest config |
| `server.ts` | Express 5 server with mock `/api/locations` and `/api/departures` |
| `index.html` | Vite HTML entry with viewport meta tag |
| `src/main.ts` | Entry point: imports CSS, creates App, mounts |
| `src/app.ts` | App class: state management, DOM rendering, event handling |
| `src/api.ts` | `fetchLocations()` and `fetchDepartures(locationId)` wrappers |
| `src/types.ts` | Shared TypeScript interfaces |
| `src/geolocation.ts` | Stub: exports `detectLocation()` returning `null` |
| `src/style.css` | Mobile-first responsive styles |
| `.gitignore` | `node_modules/`, `dist/`, `.env` |
| `.env.example` | `PYSAKKIVAHTI_API_KEY=your-key-here` |

Verify setup:

```bash
npx tsx server.ts &
sleep 2
curl http://localhost:3000/api/locations
curl "http://localhost:3000/api/departures?locationId=home"
kill %1
npx vite --host  # verify dev server starts
```

## Technical Context

- **express@5.2.1**: Does not ship built-in types; requires `@types/express@5.0.6`. Automatically catches rejected promises in `async` handlers. `res.redirect(status, url)` — status comes first (differs from Express 4).
- **dotenv@17.4.2**: CommonJS module. Usage: `import 'dotenv/config'` at the top of `server.ts` to load `.env` into `process.env`.
- **tsx@4.22.4**: Runs TypeScript directly, reads `tsconfig.json` for path aliases. No compilation step.
- **vite@8.0.16**: ESM-only. `esbuild` is a peer dependency (not bundled) — must install `esbuild@0.28.1` separately. Proxy config: `server.proxy: { '/api': 'http://localhost:3000' }`.
- **esbuild@0.28.1**: Required peer dependency of Vite 8 for JS/TS transformation.
- **typescript@6.0.3**: Latest stable. Supports `strict: true` and all modern TS features.
- **vitest@4.1.8**: Peer-dep on `vite ^6.0.0 || ^7.0.0 || ^8.0.0` (compatible). Configure in `vite.config.ts` with `test: { environment: 'happy-dom' }` and `/// <reference types="vitest" />` directive at top.
- **happy-dom@20.10.3**: Lightweight DOM for Node.js tests. Supports basic CSS computation, `getComputedStyle`, and `querySelector`.
- **@types/express@5.0.6**: No peer dependencies. Provides types for Express 5 `Request`, `Response`, `NextFunction`, etc.
- **@types/node@25.9.3**: Satisfies vitest peer dep `>=24.0.0` and Vite peer dep `>=22.12.0`.

## Notes

- All user-facing text is in Finnish (target audience is Tampere commuters).
- Mock `minutesUntilDeparture` values are static (e.g., 3, 12, 21). When value is 0, display "0 min" (not "Nyt"). The real API will calculate these from `serviceDay + realtimeDeparture` vs. current time.
- `refreshInterval` (30s) is hardcoded in the mock server. The real API story will read it from `config.json`.
- The `src/geolocation.ts` stub returns `null` so that `app.ts` can import it and fall through to manual selection. The geolocation story will replace the stub.
- City Centre mock data returns only the "→ Koti" direction. Time-based routing will select the correct direction based on `beforeHour`/`afterHour` in a future story.
- Tap-target accessibility (min-height 44px) and 320px viewport rendering are enforced via CSS rules, verified by checking stylesheet content rather than runtime layout.
- The `vite.config.ts` needs the `/// <reference types="vitest" />` triple-slash directive for TypeScript to recognize the `test` property in `defineConfig`.
