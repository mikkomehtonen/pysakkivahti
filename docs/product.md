# Pysäkkivahti

Pysäkkivahti is a mobile-friendly web app that shows upcoming public transport departures from your nearest stop, filtered by direction. Designed for daily commuters in the Waltti (Tampere) region who want to see "when's my next bus/tram home" at a glance.

## Features

- **UI Implementation** — Mobile-friendly frontend with location selector, departure display, auto-refresh, and mock API backend ([story](stories/001-ui-implementation/story.md))
- **Real API, Geolocation & Time-Based Routing** — config.json-driven server with Digitransit API proxy, headsign filtering, GPS-based location detection, and time-dependent City Centre routing ([story](stories/002-mvp-missing-parts/story.md))
- **Favicon** — SVG favicon served via Vite public directory and linked in index.html ([story](stories/003-favicon/story.md))
- **Docker Support** — Multi-stage Dockerfile with esbuild-bundled server and Vite-built frontend; small production image with no node_modules ([story](stories/004-docker-support/story.md))
- **Impeccable UI Redesign** — Modern, attractive visual redesign guided by Impeccable design skills: distinctive typography, intentional color palette from brand blue, spacing rhythm, anti-pattern removal, and proper interaction states ([story](stories/005-impeccable-ui-redesign/story.md))
- **Fix Relative Time Display** — "Päivitetty 0s sitten" was stuck at zero because the relative time was only recomputed on full re-renders; a 1-second tick timer now updates the "Päivitetty" text between data refreshes ([story](stories/006-fix-relative-time/story.md))
- **Fix npm Audit Vulnerabilities** — Resolve 2 low-severity ReDoS vulnerabilities in @eslint/plugin-kit by bumping eslint minimum to ^9.32.0 and regenerating the lockfile ([story](stories/007-fix-npm-audit/story.md))
- **Logo Beside Title** — Display the favicon brand mark to the left of the "Pysäkkivahti" app title via a flexbox header layout ([story](stories/008-logo-beside-title/story.md))
- **Reload on Visibility Change** — Reload departures when the page becomes visible again (screen unlock / app foreground) via the Page Visibility API, so users no longer see a stale "Lähtöjen hakeminen epäonnistui" error after returning to the app ([story](stories/009-reload-on-visibility/story.md))

## Non-Goals

- PWA / offline support / service worker
- Stop search UI
- Multi-stop routing or walking distance calculation
- Desktop-first layout (mobile-first design)

## Known Limitations

- config.json contains placeholder stop IDs for work and city centre morning route — users must replace with real GTFS IDs
- Requires a valid Digitransit API key (`PYSAKKIVAHTI_API_KEY` in `.env`) to fetch departures
- No offline support; requires network connection
- Geolocation requires HTTPS in production (works on localhost in development)
