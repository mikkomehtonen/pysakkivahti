# Pysäkkivahti

Pysäkkivahti is a mobile-first web app for checking nearby public transport departures in the Tampere region. It shows the next departures for configured locations (Koti, Työ, Keskusta) with realtime indicators, GPS-based location detection, and auto-refresh.

The Express server proxies the Digitransit API, applies headsign filtering and time-based routing from `config.json`, and serves the vanilla TypeScript frontend.

## Tech Stack

- **Server**: Node.js + TypeScript + Express 5, run with `tsx`
- **Frontend**: Vite + vanilla TypeScript + HTML/CSS
- **Testing**: Vitest + happy-dom
- **Linting**: ESLint + typescript-eslint
- **API**: [Digitransit](https://digitransit.fi/) GraphQL API via server-side proxy

## Project Structure

```
pysakkivahti/
├── config.json             # Runtime config: locations, stops, routes
├── config.ts               # Config loader with validation
├── digitransit.ts          # Digitransit GraphQL API client
├── geo.ts                  # Coordinate validation and flat-earth distance
├── server.ts               # Express server: API routes, filtering, routing
├── index.html              # Vite HTML entry point
├── src/
│   ├── main.ts             # Frontend entry point
│   ├── app.ts              # App state, rendering, and events
│   ├── api.ts              # API client with response validation
│   ├── geolocation.ts      # Browser geolocation + nearest-location lookup
│   ├── types.ts            # Shared TypeScript interfaces and type guards
│   └── style.css           # Mobile-first styles
├── tests/
│   ├── helpers.ts          # Test utilities (withServer, factories)
│   ├── app.test.ts         # Frontend tests
│   ├── config.test.ts      # Config loading failure tests
│   ├── digitransit.test.ts # Digitransit client unit tests
│   ├── geolocation.test.ts # Geolocation unit tests
│   ├── server.test.ts      # Server API tests (locations, departures, filtering, routing)
│   └── server.production.test.ts  # Production static serving test
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite + dev proxy + vitest config
└── eslint.config.mjs       # ESLint flat config
```

## Prerequisites

- Node.js (version matching the installed `@types/node` peer range)
- `npm`
- A Digitransit API key (set via `PYSAKKIVAHTI_API_KEY`)

## Installation

```bash
npm install
```

## Configuration

Edit `config.json` to define locations, stops, and routes. The server validates the config at startup and exits with an error if it is missing or invalid.

Each location has:
- `id`, `name` — identifier and Finnish display name
- `destination` — default destination label (overridden by time-based routes)
- `coordinates` + `radius` — for GPS nearest-location detection
- `stops` — list of Digitransit stop IDs with optional `filterHeadsigns` (case-insensitive substring matching)
- `routes` — time-based routing: each route has `destination`, `beforeHour`/`afterHour` for time selection, and its own `stops`

Changes to `config.json` require a server restart.

## Development

Run the Express server on port 3000 (or set `PORT`):

```bash
npm run server
```

In another terminal, run the Vite dev server on port 5173 with `/api` proxied to Express:

```bash
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

## Testing

```bash
npm test
```

Runs all Vitest tests in the `happy-dom` environment.

## Type Checking and Linting

```bash
npm run typecheck
npm run lint
```

## Production Build

Build the frontend to `dist/`:

```bash
npx vite build
```

Start the server in production mode (it will serve `dist/` as static files):

```bash
NODE_ENV=production npm run server
```

## Environment Variables

Copy `.env.example` to `.env` and add your Digitransit API key:

```bash
cp .env.example .env
```

```env
PYSAKKIVAHTI_API_KEY=your-key-here
```

The departures endpoint returns 503 if the API key is missing.

## API Endpoints

- `GET /api/locations` — returns configured locations, their time-based destinations, and the refresh interval
- `GET /api/locations/nearest?lat=<lat>&lon=<lon>` — returns the nearest location within its radius, or 404 if none match
- `GET /api/departures?locationId=<id>` — returns departures from the Digitransit API for the given location, with headsign filtering and time-based stop selection; partial data is returned if some stops fail

## License

ISC
