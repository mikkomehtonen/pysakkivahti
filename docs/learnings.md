# Learnings

## config.ts has a module-level side effect; tests must mock it before importing server code
**Date**: 2026-06-14
**Area**: testing
**What happened**: `config.ts` calls `loadConfig()` at module scope, which reads `config.json` and may call `process.exit(1)`. Any test that imports `server.ts` (or any helper that imports it) will trigger this at import time unless `config.ts` is mocked with `vi.mock('../config.ts', () => ({ config: ... }))` before the import.
**Takeaway**: Always place `vi.mock('../config.ts')` at the top of server-side test files, above any import of `server.ts` or helpers that import `server.ts`. For dynamic imports, reset the module cache and set `NODE_ENV` before importing when testing environment-dependent behavior.

## Digitransit GraphQL responses are wrapped in `{ data: ... }`
**Date**: 2026-06-14
**Area**: architecture
**What happened**: The first implementation of `digitransit.ts` treated the API response as `{ stop: ... }` directly, but Digitransit returns `{ data: { stop: ... }, errors?: [...] }`. This would have silently produced empty departures in production while mocked tests passed.
**Takeaway**: Always extract the `data` field from GraphQL responses and check for `errors` before returning. Keep the public `fetchStopDepartures` contract returning the inner `StopResponse` so callers don't need to know about the envelope.

## Acceptance reviewer enforces a 90% AC coverage threshold
**Date**: 2026-06-14
**Area**: testing
**What happened**: The acceptance reviewer failed the first pass because Task 1 had only 10 of 13 ACs covered (missing tests for missing/invalid `config.json`, no-route fallback, and absent `filterHeadsigns`).
**Takeaway**: After implementing a story, map each AC to a test name and file. If an AC is hard to test with the current fixture (e.g., geolocation equidistant scenario), document it as non-blocking but still look for a feasible fixture or test approach.

## `vi.mock` factories cannot reference module-scope variables
**Date**: 2026-06-14
**Area**: testing
**What happened**: Attempting to extract a `mockConfig(locations)` helper and pass it to `vi.mock('../config.ts', mockConfig([...]))` failed because `vi.mock` is hoisted and the helper function is not initialized at the time the factory runs.
**Takeaway**: For per-file mock config differences, keep the `vi.mock` factory inline in the test file. To reduce duplication, consider consolidating related server tests into one file with a single comprehensive mock config instead of sharing a factory helper.

## Consolidating server tests reduces duplicated `vi.mock` boilerplate
**Date**: 2026-06-14
**Area**: testing
**What happened**: Separate `server.test.ts`, `server.filter.test.ts`, and `server.routing.test.ts` each repeated the `vi.mock('../config.ts', ...)` boilerplate. Consolidating them into `server.test.ts` with one comprehensive config satisfied the reviewer and simplified maintenance.
**Takeaway**: When multiple test files share the same modules that need mocking but differ only in config data, prefer a single test file with a combined fixture over many small files with duplicated `vi.mock` calls.

## `npx impeccable detect` exits 0 with no output when clean
**Date**: 2026-06-14
**Area**: testing
**What happened**: The first test for the Impeccable anti-pattern check asserted that the CLI output contained `0 anti-patterns`. In practice, the CLI prints nothing when no anti-patterns are found and exits with code 0.
**Takeaway**: When verifying `npx impeccable detect <path>` in a test, assert on the exit code (0) rather than the stdout content. Use `npx --no-install` to avoid network calls in CI.

## OKLCH fallbacks must use `@supports`, not duplicate custom property declarations
**Date**: 2026-06-14
**Area**: styling
**What happened**: The initial redesign defined each color custom property twice (`--color-accent: #hex; --color-accent: oklch(...);`) and repeated `property: hex; property: var(--token);` in individual rules. Because CSS custom properties accept any token stream, the oklch declaration always overrides the hex, and a failed `var()` substitution yields the property's initial value — not the previous cascade layer — so the hex fallbacks are dead code.
**Takeaway**: Gate oklch tokens inside `@supports (color: oklch(0 0 0))` with hex defaults outside, then use `var(--token)` directly in rules. Never rely on duplicate declarations as a fallback mechanism.
