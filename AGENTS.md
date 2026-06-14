# Pysäkkivahti — Agent Notes

## Project Status

Early-stage MVP. Only a feasibility study and plan exist — no application code yet. See `plan.md` for the full design.

## Tech Stack (planned)

- **Server**: Node.js + TypeScript + Express, run via `tsx` (no compile step in dev)
- **Frontend**: Vite + TypeScript, vanilla HTML/CSS/JS (no framework)
- **API**: Digitransit Routing API (Waltti region), proxied through Express to avoid CORS
- **Config**: `config.json` on server, `.env` for API key

## Environment

- `PYSAKKIVAHTI_API_KEY` (or `.env` variable) — required for Digitransit API, set as `digitransit-subscription-key` header
- API endpoint: `https://api.digitransit.fi/routing/v2/waltti/gtfs/v1` (GraphQL)

## Key Architecture Decisions

- Frontend does not call Digitransit directly — all API calls go through the Express server proxy
- Direction filtering by headsign substring match (not fuzzy), done server-side
- Geolocation with manual fallback; HTTPS required for browser geolocation
- City Centre location has time-based routing (`beforeHour`/`afterHour`) instead of a single destination
- `feasibility-study/` is reference material, not part of the app
