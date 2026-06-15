# Fix "Päivitetty 0s sitten" Stuck at Zero

## Context

The status bar shows "Päivitetty Xs sitten" (Updated Xs ago) to indicate how long ago departure data was last fetched. The `formatTimeAgo()` function in `app.ts` is correct — it computes the elapsed time between `Date.now()` and the stored `lastUpdated` Date. However, `renderStatus()` (which calls `formatTimeAgo`) is only called during `render()`, which runs after data loads, location switches, and the 30-second auto-refresh. Between those events the displayed relative time is frozen at whatever it was when `render()` last executed. Since `loadDepartures` sets `lastUpdated = new Date()` immediately before rendering, the elapsed time is typically 0–1 seconds — so the text permanently reads "Päivitetty 0s sitten" until the next full data refresh.

## Out of Scope

- Changing the data refresh interval (stays at `refreshInterval` seconds)
- Modifying the `formatTimeAgo` function's output format or thresholds
- Server-side changes
- New CSS styling

## Implementation Approach

Add a dedicated 1-second interval (`timeAgoTimer`) that updates only the `.last-updated` span's `textContent` without a full re-render. This avoids the overhead of rebuilding the entire DOM on every tick.

**Timer lifecycle**:
- Start the timer on `mount()` — it runs continuously; if `lastUpdated` is null the tick is a no-op.
- Clear the timer in `destroy()` alongside the existing data-refresh timer.
- Do NOT restart the timer on data refresh or location switch — it just keeps ticking independently.

**Tick handler** (`updateTimeAgo()`):
- Query the container for `.last-updated`.
- If the element exists and `this.state.lastUpdated` is non-null, set `textContent` to `"Päivitetty {formatTimeAgo(this.state.lastUpdated)}"`.
- No DOM mutation if the element is missing or `lastUpdated` is null.

**Existing `renderStatus()` remains unchanged** — it still sets the initial value on full renders, and the 1-second timer takes over between renders.

**Test strategy**: Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` to advance wall-clock time and assert that the `.last-updated` text updates accordingly.

## Tasks

### Task 1 — Add timeAgoTimer to App class

- [App mounted, lastUpdated set] + 1 second elapses
  - → `.last-updated` textContent changes from `"Päivitetty 0s sitten"` to `"Päivitetty 1s sitten"`
- [App mounted, lastUpdated set] + 90 seconds elapse
  - → `.last-updated` textContent reads `"Päivitetty 1min sitten"`
- [App mounted, lastUpdated set] + 3700 seconds elapse
  - → `.last-updated` textContent reads `"Päivitetty 1h sitten"`
- [App mounted, lastUpdated null (no data yet)] + 1 second elapses
  - → `.last-updated` textContent remains empty (no crash, no stale text)
- [App destroyed] + time advances
  - → no interval callback fires (timer cleared)
  - → no "Cannot read properties of null" error

### Task 2 — Update existing test and add new relative-time test

- [existing test "displays last updated timestamp after successful fetch"] + test still passes
  - → `.last-updated` textContent is `"Päivitetty 0s sitten"` immediately after mount (no regression)
- [App mounted with fake timers, system time at 0] + `vi.advanceTimersByTimeAsync(5000)`
  - → `.last-updated` textContent reads `"Päivitetty 5s sitten"`
- [App mounted with fake timers, system time at 0] + `vi.advanceTimersByTimeAsync(120_000)`
  - → `.last-updated` textContent reads `"Päivitetty 2min sitten"`

### Task 3 — Verify typecheck and lint pass

- [all changes complete] + `npm run typecheck`
  - → exits with code 0
- [all changes complete] + `npm run lint`
  - → exits with code 0
- [all changes complete] + `npm test`
  - → exits with code 0

## Technical Context

- **vitest fake timers**: `vi.useFakeTimers()` mocks `setInterval`/`clearInterval` and `Date.now()`. `vi.advanceTimersByTimeAsync(ms)` advances both the timer queue and (with `vi.setSystemTime`) the system clock. The existing test on line 431 of `app.test.ts` already uses this pattern.
- **No new dependencies**: The fix uses only `setInterval` and existing `formatTimeAgo`.

## Notes

- The 1-second interval is chosen because `formatTimeAgo` uses second-level granularity for the first 60 seconds. A longer interval (e.g., 5s) would leave the display stale at "0s" for up to 5 seconds after a refresh, which would still feel broken.
- The tick handler does a lightweight DOM query + text update. This is negligible performance cost compared to a full `render()` which rebuilds all child elements.
- The `.last-updated` span is created in `renderStatus()` which is called from `render()`. Between full renders the span persists in the DOM — the timer only updates its `textContent`.
- Finnish UI strings remain unchanged.
