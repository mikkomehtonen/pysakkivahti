# Reload Departures on Page Visibility Change

## Context

When a mobile user locks their screen or backgrounds the browser, the page's JavaScript execution is paused/throttled and any in-flight `fetch` fails or is abandoned. The app's last render then shows the error "Lähtöjen hakeminen epäonnistui", and it stays there when the user unlocks the screen and returns — because nothing triggers a new load. The app should detect when the page becomes visible again (screen unlocked / app brought to the foreground) and reload the departures so the user sees fresh data instead of a stale error.

## Out of Scope

- BFCache restoration via the `pageshow` event (`event.persisted === true`). That covers navigation back/forward, not the reported screen-lock / app-switch scenario, which is handled by the Page Visibility API on mobile browsers.
- Service worker / offline support (already a Non-Goal in `docs/product.md`).
- Staleness-based throttling (e.g. "only reload if older than N seconds"). The request is to always reload on return; this is the simplest correct behavior and avoids showing stale data.
- `window` `focus`/`blur` events. The Visibility API is the correct primitive and already covers backgrounding/foregrounding.

## Implementation approach

Use the Page Visibility API (`document.visibilitychange` + `document.visibilityState`), which is part of the DOM lib already included in `tsconfig.json` (`"lib": ["ES2022", "DOM"]`). No new dependencies.

- Add a private arrow-function field `onVisibilityChange` on the `App` class so the same bound reference is used for both `addEventListener` and `removeEventListener`:
  ```ts
  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.refresh();
    }
  };
  ```
  Rule: act **only** on the `visible` transition; ignore `hidden` (going background must not trigger a load).
- Register it in `mount()` alongside the existing `timeAgoTimer` setup: `document.addEventListener('visibilitychange', this.onVisibilityChange);`
- Remove it in `destroy()`: `document.removeEventListener('visibilitychange', this.onVisibilityChange);`
- Reuse the existing `refresh()` method — it already does the right thing for every state:
  - `selectedLocation` set → `loadDepartures(selectedLocation.id)` (reloads departures).
  - `selectedLocation` null and no locations loaded → `reloadLocations()` (recovers even if the initial locations fetch had failed).
- `loadDepartures()` clears `state.error`, sets `state.loading`, fetches, and calls `resetTimer()` on success — so a visibility-triggered reload both replaces the stale error and resets the auto-refresh interval to a full `refreshInterval` from now.
- The existing `requestId` guard in `loadDepartures()` makes concurrent loads safe: if a throttled `setInterval` catch-up callback fires near-simultaneously with the visibility handler, only the latest response is applied (the older one is dropped via `requestId !== this.requestId`). No stale data, no double-render of old data.
- `visibilitychange` does **not** fire on initial page load, so registering the listener in `mount()` does not cause a duplicate fetch at startup.

## Tasks

### Task 1 - Reload departures when the page becomes visible

- app mounted with a selected location + `visibilitychange` dispatched while `document.visibilityState === 'visible'`
  - → `globalThis.fetch` called again with `/api/departures?locationId=<selected id>`
- app mounted with a selected location + `visibilitychange` dispatched while `document.visibilityState === 'hidden'`
  - → `globalThis.fetch` call count unchanged (no reload when going hidden)
- app mounted, then `app.destroy()` called + `visibilitychange` dispatched while `document.visibilityState === 'visible'`
  - → `globalThis.fetch` call count unchanged (listener was removed)

### Task 2 - Replace stale error with fresh data on return

- app mounted, departures fetch rejects so `.error` shows "Lähtöjen hakeminen epäonnistui" + `visibilitychange` dispatched while `document.visibilityState === 'visible'`, with the departures fetch now resolving successfully
  - → `.error` element no longer present in the container
  - → `.departure-row` elements rendered from the successful response

### Task 3 - Reset auto-refresh timer after a visibility reload

- app mounted with fake timers (`refreshInterval: 30`) + `visibilitychange` dispatched while `document.visibilityState === 'visible'` (triggers a reload) + advance fake timers by 29 seconds
  - → `globalThis.fetch` call count unchanged since the visibility reload (timer did not fire early)
- ... + advance fake timers by 1 more second (30 seconds total)
  - → `globalThis.fetch` call count increases by exactly 1 (timer fired only after a full interval, proving it was reset by the visibility reload)

## Technical Context

- **happy-dom 20.10.3** (already a devDependency): `document.visibilityState` is a prototype getter that returns `'visible'` whenever the document has a `defaultView` (i.e. always `'visible'` in the test environment). It is not a plain writable property, so tests must override it with `vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden' | 'visible')`. This is auto-restored by the existing `afterEach(() => vi.restoreAllMocks())` in `tests/app.test.ts` — no manual cleanup needed. Verified working against the installed version.
- Dispatch the event with `document.dispatchEvent(new Event('visibilitychange'))`. The handler reads `document.visibilityState` at dispatch time, so the mocked value is observed correctly.
- `fetch` is invoked synchronously inside `loadDepartures()` before the first `await` (the call chain `loadDepartures` → `apiFetchDepartures` → `apiFetch` → `fetch(url)` runs synchronously up to the first `await`). Therefore the `globalThis.fetch` mock call count increments synchronously when the event is dispatched; assertions on call counts need no promise flushing. Assertions on rendered DOM (Task 2) do require `await flushPromises()` (the existing helper) so the resolved response is applied and `render()` runs.
- No new packages are introduced; nothing to install.

## Notes

- No new user-facing strings are added — the reload reuses the existing render paths, so the Finnish UI ("Ladataan...", "Ei lähtöjä", error messages) is unchanged.
- The listener is added in `mount()` and removed in `destroy()`, matching the lifecycle of the existing `timer` and `timeAgoTimer`. Keep `destroy()` idempotent (removing a never-added listener is a no-op).
- BFCache (`pageshow` with `persisted: true`) is intentionally out of scope; see Out of Scope.
