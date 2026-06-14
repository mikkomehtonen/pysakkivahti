# Pysäkkivahti

Pysäkkivahti is a mobile-friendly web app that shows upcoming public transport departures from your nearest stop, filtered by direction. Designed for daily commuters in the Waltti (Tampere) region who want to see "when's my next bus/tram home" at a glance.

## Features

- **UI Implementation** — Mobile-friendly frontend with location selector, departure display, auto-refresh, and mock API backend ([story](stories/001-ui-implementation/story.md))

## Non-Goals

- Real Digitransit API integration (future story)
- Geolocation-based location detection (future story)
- Time-based routing for City Centre (future story)
- PWA / offline support / service worker
- Stop search UI
- Multi-stop routing or walking distance calculation
- Desktop-first layout (mobile-first design)

## Known Limitations

- Uses mock data; no real departure information yet
- Manual location selection only; no GPS detection
- City Centre location shows only one direction (no time-based switching)
- No offline support; requires network connection
