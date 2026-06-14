# Pysäkkivahti

Pysäkkivahti is a mobile-first web app for checking nearby public transport departures. It shows the next departures for configured locations (Home, Work, City Centre) with realtime indicators and auto-refresh.

This repository contains the MVP implementation: an Express server with a mock API and a vanilla TypeScript frontend built with Vite. The real Digitransit API integration, geolocation, and time-based routing are planned for future stories.

## Tech Stack

- **Server**: Node.js + TypeScript + Express 5, run with `tsx`
- **Frontend**: Vite + vanilla TypeScript + HTML/CSS
- **Testing**: Vitest + happy-dom
- **Linting**: ESLint + typescript-eslint

## Project Structure

```
pysakkivahti/
├── server.ts              # Express server with mock API
├── index.html             # Vite HTML entry point
├── src/
│   ├── main.ts            # Frontend entry point
│   ├── app.ts             # App state, rendering, and events
│   ├── api.ts             # API client
│   ├── geolocation.ts     # Geolocation stub (returns null)
│   ├── types.ts           # Shared TypeScript interfaces
│   └── style.css          # Mobile-first styles
├── tests/
│   ├── app.test.ts        # Frontend tests
│   └── server.test.ts     # API tests
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite + dev proxy + vitest config
└── eslint.config.mjs      # ESLint flat config
```

## Prerequisites

- Node.js (version matching the installed `@types/node` peer range)
- `npm`
- Digitransit API key for later stories (not needed for the mock API)

## Installation

```bash
npm install
```

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

Copy `.env.example` to `.env` and add your Digitransit API key for the upcoming real API integration:

```bash
cp .env.example .env
```

```env
PYSAKKIVAHTI_API_KEY=your-key-here
```

The mock API story does not use the key yet.

## Mock API

The server exposes two endpoints used by the frontend:

- `GET /api/locations` — returns configured locations and refresh interval
- `GET /api/departures?locationId=<id>` — returns departures for the selected location

These shapes match the planned real Digitransit proxy so the frontend code will not change when the real API is wired in.

## License

ISC
