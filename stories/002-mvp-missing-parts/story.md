# MVP Missing Parts: Real API, Geolocation, and Time-Based Routing

## Context

Story 001 built the full UI with mock data. The three features listed as non-goals in product.md remain unimplemented: real Digitransit API integration, geolocation-based location detection, and time-based routing for City Centre. Together these complete the MVP defined in plan.md. Without them, the app shows static fake data, requires manual location selection, and cannot switch City Centre direction based on time of day.

## Out of Scope

- PWA manifest or service worker
- Stop search UI
- Multi-stop routing (A→B→C)
- Walking distance to stop
- Server-side caching of Digitransit responses
- Offline support
- Fuzzy headsign matching (plan.md explicitly uses substring match)

## Implementation Approach

**Config-driven server**: A `config.json` file at project root replaces all hardcoded mock data. The server loads it at startup and uses it for every endpoint response. `tsconfig.json` already has `resolveJsonModule: true`, but the server will read the file via `fs.readFileSync` at startup so that config changes require a restart (no hot-reload ambiguity).

**Two type hierarchies**: Config types (`ConfigLocation`, `ConfigStop`, `ConfigRoute`, `Coordinates`) are server-only and live in a new `config.ts` module. The existing shared types in `src/types.ts` remain unchanged for the frontend API contract, with one addition: `LocationDepartures` gains a `destination` field so the frontend can update the header when time-based routing changes the destination on auto-refresh.

**Digitransit API client**: A new `digitransit.ts` module exports a single function `fetchStopDepartures(stopId, apiKey)` that POSTs a GraphQL query to `https://api.digitransit.fi/routing/v2/waltti/gtfs/v1`. Each stop is queried independently (1-3 stops per location, not worth batching). The module is mockable with `vi.mock` in server tests. Uses Node's built-in `fetch` (Node 24).

**Headsign filtering**: After fetching `numberOfDepartures: 15` from Digitransit, the server filters departures whose `headsign` contains any string in the stop's `filterHeadsigns` array (case-insensitive substring match). If `filterHeadsigns` is empty or absent, all departures pass through. After filtering, take the first `departuresCount` (from config, default 3) matching departures per stop. Departures with `secondsUntilDeparture <= 0` (already left) are excluded before counting.

**Time-based routing**: A location with `routes` (instead of `stops`) is a time-routed location like City Centre. The server iterates `routes` in config order and selects the first where:
- `beforeHour` is defined and current hour (0-23) < `beforeHour`, OR
- `afterHour` is defined and current hour >= `afterHour`

If no route matches (config gap), the first route is used as fallback. The selected route's `stops` are used for the Digitransit query, and the route's `destination` becomes the location's resolved destination.

**Geolocation**: Browser `navigator.geolocation.getCurrentPosition` provides user coordinates. These are sent to a new `GET /api/locations/nearest?lat=X&lon=Y` endpoint. The server matches against each config location's `coordinates` + `radius` using a flat-Earth approximation (sufficient for 200-300m radii):
```
dLat = (userLat - locLat) * 111_000
dLon = (userLon - locLon) * 111_000 * cos(locLat * π / 180)
distance = sqrt(dLat² + dLon²)
```
The closest location within its radius wins. If none match, returns 404. The frontend falls back to the first location. The `detectLocation()` function signature changes from `detectLocation(locations: Location[])` to `detectLocation()` — it no longer needs the locations array since the server handles matching.

**Frontend destination sync**: `LocationDepartures` gains a `destination` field. When departures are loaded, the frontend updates `selectedLocation.destination` from the response, so the header stays in sync with time-based routing changes during auto-refresh.

**Production mode**: `server.ts` adds `express.static('dist')` when `NODE_ENV=production`, serving the Vite-built frontend.

**Error handling for API**: If `PYSAKKIVAHTI_API_KEY` is missing, `/api/departures` returns 503 with Finnish error. If Digitransit returns a network or server error, `/api/departures` returns 502 with Finnish error. Individual stop query failures result in that stop appearing with an empty departures array (partial data rather than total failure).

## Tasks

### Task 1 - Config Model, Digitransit API Proxy, Filtering, and Time-Based Routing

- [server started with valid config.json] + `GET /api/locations`
  - → returns 200 with `locations` array built from config (each has `id`, `name`, `destination`)
  - → `refreshInterval` matches config value
  - → city_centre destination is resolved from current-hour route selection
- [server started, PYSAKKIVAHTI_API_KEY set] + `GET /api/departures?locationId=home`
  - → returns 200 with `LocationDepartures` including `destination` field
  - → each stop's departures are fetched from Digitransit GraphQL API
  - → departures with headsign containing a `filterHeadsigns` entry (case-insensitive substring) are included
  - → departures whose headsign matches no `filterHeadsigns` entry are excluded
  - → at most `departuresCount` departures per stop after filtering
  - → departures with `secondsUntilDeparture <= 0` are excluded
  - → `minutesUntilDeparture` = `Math.round(secondsUntilDeparture / 60)`
- [location with `filterHeadsigns: []` or absent] + `GET /api/departures?locationId=<id>`
  - → all departures pass through (no filtering)
- [server started, PYSAKKIVAHTI_API_KEY not set] + `GET /api/departures?locationId=home`
  - → returns 503 with JSON `{ error: string }` containing Finnish message
- [Digitransit API returns network error] + `GET /api/departures?locationId=home`
  - → returns 502 with JSON `{ error: string }` containing Finnish message
- [Digitransit API returns error for one stop out of two] + `GET /api/departures?locationId=<id>`
  - → returns 200 with partial data: failed stop has empty departures, successful stop has data
- [current hour < 12, city_centre has route with `beforeHour: 12`] + `GET /api/locations`
  - → city_centre destination = that route's `destination` (e.g. "Työ")
- [current hour >= 12, city_centre has route with `afterHour: 12`] + `GET /api/locations`
  - → city_centre destination = that route's `destination` (e.g. "Koti")
- [current hour >= 12] + `GET /api/departures?locationId=city_centre`
  - → `destination` field in response matches the afterHour route's destination
  - → stops from the afterHour route are queried
- [no route matches current hour] + `GET /api/departures?locationId=city_centre`
  - → first route in config is used as fallback
- [config.json missing] + server startup
  - → server exits with error message to stderr
- [config.json contains invalid JSON] + server startup
  - → server exits with error message to stderr
- [NODE_ENV=production] + `GET /` (root URL)
  - → serves files from `dist/` directory

### Task 2 - Geolocation Detection and Frontend Integration

- [user at coordinates within home radius] + `GET /api/locations/nearest?lat=61.49&lon=23.76`
  - → returns 200 with `{ id: "home", name: "Koti", destination: "Keskusta" }`
- [user at coordinates outside all radii] + `GET /api/locations/nearest?lat=60.0&lon=20.0`
  - → returns 404 with JSON `{ error: string }`
- [user equidistant from home and work, but only home within radius] + `GET /api/locations/nearest`
  - → returns home (closest within its radius)
- [missing lat or lon query param] + `GET /api/locations/nearest`
  - → returns 400 with JSON `{ error: string }`
- [browser grants geolocation] + `detectLocation()` called
  - → calls `navigator.geolocation.getCurrentPosition`
  - → sends coordinates to `/api/locations/nearest`
  - → returns matched `Location` object
- [`navigator.geolocation` not available (e.g. test environment)] + `detectLocation()` called
  - → returns `null` without calling any API or throwing
- [browser denies geolocation permission] + `detectLocation()` called
  - → returns `null` (no error thrown)
- [geolocation succeeds but `/api/locations/nearest` returns 404] + `detectLocation()` called
  - → returns `null`
- [GPS-detected location selected] + render
  - → active location button has CSS class `location-btn--gps`
- [user manually clicks a different location button] + click event
  - → `location-btn--gps` class removed from previously GPS-detected button
  - → newly selected button gets `location-btn--active` only (not `--gps`)
- [auto-refresh returns updated destination] + departures loaded
  - → `selectedLocation.destination` updated from `LocationDepartures.destination`
  - → location header text updates to reflect new destination

## Technical Context

- **Node 24.16.0**: Built-in `fetch` available globally. No `node-fetch` or `undici` needed.
- **Digitransit API**: `POST https://api.digitransit.fi/routing/v2/waltti/gtfs/v1`, header `digitransit-subscription-key: <API_KEY>`, JSON body `{ query: "..." }`. Returns 401 without valid key. The GraphQL query per stop is:
  ```graphql
  {
    stop(id: "tampere:XXXX") {
      name
      stoptimesWithoutPatterns(numberOfDepartures: 15) {
        scheduledDeparture
        realtimeDeparture
        realtime
        serviceDay
        headsign
        trip { route { shortName mode } }
      }
    }
  }
  ```
- **Express 5**: Async route handlers auto-catch rejected promises. `res.redirect(status, url)` has status first.
- **dotenv**: Already imported via `import 'dotenv/config'` in server.ts. `process.env.PYSAKKIVAHTI_API_KEY` available after import.
- **tsconfig `resolveJsonModule: true`**: Enabled, but server will use `fs.readFileSync` for config.json to control loading timing and add validation.
- **No new npm dependencies**: All features use existing packages (express, dotenv) or built-in APIs (fetch, fs, navigator.geolocation).
- **Vitest mocking**: `vi.mock('./config.ts')` in server tests to provide test config without needing a real `config.json`. `vi.mock('./digitransit.ts')` to avoid real Digitransit API calls. `vi.fn()` for `navigator.geolocation` in frontend tests. Since config is loaded at module level (via `loadConfig()` called in `server.ts` top-level code), `vi.mock` hoisting ensures the mock is in place before the import executes.
- **Haversine not needed**: Flat-Earth distance approximation is accurate to <1% for 200-300m radii at latitude 61.5°.

## Notes

- All user-facing strings remain in Finnish. New error messages: "API-avain puuttuu" (503), "Lähtöjen haku epäonnistui" (502), "Sijaintia ei löytynyt" (nearest 404), "Puuttuvat koordinaattiparametrit" (nearest 400).
- config.json is committed to git (not gitignored) — it contains no secrets, only stop IDs and coordinates. Users customize it for their commute.
- The `destination` field added to `LocationDepartures` is a minor API contract change. The existing `api.ts` validation must be updated to check `typeof data.destination === 'string'`. All existing test mock data for departures must include a `destination` field (e.g. `destination: "Keskusta"` for home/work) or the new validation will reject them.
- `detectLocation()` must check `typeof navigator !== 'undefined' && navigator.geolocation` before attempting `getCurrentPosition`. happy-dom does not provide `navigator.geolocation`, so existing frontend tests that mock `globalThis.fetch` continue to work without modification — `detectLocation()` returns `null` before any fetch call is made.
- City Centre's `destination` is time-dependent, so the `/api/locations` response may differ between calls made at different hours. This is by design.
- At exactly the boundary hour (e.g., 12:00:00), `afterHour: 12` matches (>= is inclusive), `beforeHour: 12` does not (< is exclusive). This ensures no gap.
- The GPS indicator (`location-btn--gps`) is purely visual — a subtle green left border or dot, distinct from the solid dark background of `location-btn--active`. When both classes apply (GPS detected + active), both styles show.
- config.json uses placeholder stop IDs (`tampere:0001`, `tampere:0002`) for work and city centre morning route. The home stop `tampere:0851` and city centre evening stop `tampere:0855` are from the feasibility study / plan.md. Users must replace placeholders with real IDs from the Tampere GTFS feed.
