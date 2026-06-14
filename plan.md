# Pysäkkivahti - MVP Plan

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Mobile      │      │  Express Server  │      │  Digitransit API │
│  Browser     │─────>│  (Node.js/TS)    │─────>│  (Waltti region) │
│              │<─────│                  │<─────│                  │
└─────────────┘      │  config.json     │      └──────────────────┘
                     │  .env (API key)  │
                     └──────────────────┘
```

The Express server serves static frontend files and proxies API requests to Digitransit, solving CORS cleanly.

## Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| Runtime | Node.js + TypeScript | Your preference |
| Server | Express + tsx | tsx runs TS directly, no compile step in dev |
| Frontend | Vite + TypeScript | Fast dev server, HMR, zero-config TS |
| Config | JSON file on server | Simple, human-editable |
| API key | `.env` (dotenv) | Keeps secret out of git |

## Project Structure

```
pysakkivahti/
├── package.json
├── tsconfig.json            # root config (server)
├── tsconfig.server.json     # server-specific
├── vite.config.ts           # frontend build + API proxy
├── server.ts                # Express server (TS)
├── config.json              # stop/location config
├── .env                     # API_KEY=...
├── .gitignore
├── src/                     # frontend (Vite entry)
│   ├── main.ts
│   ├── app.ts
│   ├── api.ts               # API client
│   ├── geolocation.ts       # location detection
│   ├── types.ts             # shared types
│   └── style.css
├── index.html               # Vite HTML entry
├── dist/                    # built frontend (gitignored)
└── feasibility-study/       # existing
```

## Dev/Production Workflow

**Development** (concurrent):
- `npx tsx server.ts` — Express API on port 3000
- `npx vite` — Frontend dev server on port 5173, proxies `/api/*` to `:3000`

**Production**:
- `npx vite build` — builds frontend to `dist/`
- `npx tsx server.ts` — Express serves `dist/` as static + API

Vite config handles the proxy:
```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: { '/api': 'http://localhost:3000' }
  }
})
```

Express serves built files in production:
```ts
// server.ts
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}
```

## MVP Feature List

1. Geolocation-based location detection (Home / Work / City Centre)
2. Manual location fallback (buttons if GPS unavailable)
3. Direction-filtered departures (next 3, minutes until departure)
4. Auto-refresh every 30 seconds
5. Real-time indicator (if departure has realtime data)
6. Mobile-friendly layout

## Configuration Model

```json
{
  "refreshInterval": 30,
  "departuresCount": 3,
  "locations": [
    {
      "id": "home",
      "name": "Koti",
      "destination": "Keskusta",
      "coordinates": { "lat": 61.49, "lon": 23.76 },
      "radius": 200,
      "stops": [
        {
          "id": "tampere:0851",
          "name": "Särkänniemi B",
          "filterHeadsigns": ["Keskustori"]
        }
      ]
    },
    {
      "id": "work",
      "name": "Työ",
      "destination": "Keskusta",
      "coordinates": { "lat": 61.45, "lon": 23.86 },
      "radius": 200,
      "stops": [
        {
          "id": "tampere:XXXX",
          "name": "Work Stop",
          "filterHeadsigns": ["Keskustori"]
        }
      ]
    },
    {
      "id": "city_centre",
      "name": "Keskusta",
      "coordinates": { "lat": 61.498, "lon": 23.772 },
      "radius": 300,
      "routes": [
        {
          "destination": "Työ",
          "beforeHour": 12,
          "stops": [
            { "id": "tampere:YYYY", "name": "Keskustori P", "filterHeadsigns": ["..."] }
          ]
        },
        {
          "destination": "Koti",
          "afterHour": 12,
          "stops": [
            { "id": "tampere:ZZZZ", "name": "Keskustori E", "filterHeadsigns": ["Lentävänniemi"] }
          ]
        }
      ]
    }
  ]
}
```

- `filterHeadsigns`: list of strings - a departure is included if its headsign contains any of these strings (case-insensitive substring match)
- City Centre uses `routes` with time conditions (`beforeHour`/`afterHour`) instead of a single destination
- `radius` in meters for geolocation matching

## API Integration Approach

**Server-side proxy** (`GET /api/departures?stopIds=...&count=3`):

1. Receives stop IDs from frontend
2. Sends GraphQL query to `https://api.digitransit.fi/routing/v2/waltti/gtfs/v1`
3. Adds `digitransit-subscription-key` from `.env`
4. Returns parsed departure data to frontend

**GraphQL query** (per stop, based on feasibility study):

```graphql
{
  stop(id: "tampere:0851") {
    name
    stoptimesWithoutPatterns(numberOfDepartures: 15) {
      scheduledDeparture
      realtimeDeparture
      realtime
      serviceDay
      headsign
      trip {
        route {
          shortName
          mode
        }
      }
    }
  }
}
```

We fetch 15 and filter down to 3 relevant ones (after headsign filtering).

**Direction filtering logic**:
- For each departure, check if `headsign` contains any string in the stop's `filterHeadsigns`
- If `filterHeadsigns` is empty/missing, include all departures (no filter)
- Take first N matching departures

## UI Wireframe

```
┌─────────────────────────────┐
│  Pysäkkivahti               │
│                             │
│  Koti  →  Keskusta          │
│                             │
│  1  Keskustori     3 min    │
│  1  Keskustori    12 min    │
│  1  Keskustori    21 min    │
│                             │
│  Päivitetty 30s sitten  [R] │
│                             │
│  [Koti]  [Työ]  [Keskusta]  │
└─────────────────────────────┘
```

- Top: app name
- Context line: current location → destination
- Departure list: route number, headsign, minutes until departure
- Footer: last update timestamp + manual refresh button
- Bottom: manual location selector (fallback, highlighted when GPS is used)
- Real-time departures shown in bold; scheduled-only in regular weight
- Large, tap-friendly text for mobile readability

## Development Plan

| Phase | Description | Key Tasks |
|---|---|---|
| **1. Skeleton** | Project setup | `npm init`, install express/dotenv/tsx/vite/typescript, tsconfig, vite.config.ts with proxy, .gitignore, .env, index.html entry point |
| **2. API proxy** | Backend in TS | server.ts with `/api/departures` proxy route, types for API response, test with hardcoded stop |
| **3. Static UI** | Frontend in TS | src/main.ts + app.ts + api.ts + style.css, fetch + render departures, auto-refresh, manual location buttons |
| **4. Config + filtering** | Configurable stops | Load config.json, multi-stop per location, headsign filtering on server |
| **5. Geolocation** | Auto-detect | Browser Geolocation API in src/geolocation.ts, match against config, fallback to manual |
| **6. Time-based routing** | City Centre | `beforeHour`/`afterHour` route selection, correct destination per time |
| **7. Polish** | Mobile-ready | Responsive CSS, error/loading states, real-time indicator, PWA manifest, prod build test |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| HTTPS required for geolocation | Geolocation won't work on plain HTTP | Use Cloudflare Tunnel or serve via localhost; add manual fallback |
| GPS inaccuracy indoors | Wrong location detected | Generous radius (200-300m), manual override buttons |
| Digitransit API changes | Breaks departure fetching | Pin to API v2, wrap API calls in a module for easy updates |
| Stop ID discovery | User must find GTFS IDs manually | Document how to find stop IDs; future: add stop search feature |
| Rate limiting | Too many refreshes | 30s interval is conservative; add server-side short cache if needed |

## Simplifications

- No offline support (add service worker later if needed)
- No stop search UI (configure stop IDs manually in config.json)
- No multi-stop routing (one stop per direction)
- No walking distance to stop (assumes stop is at the configured location)
- Simple string matching for headsign filtering (not fuzzy)
