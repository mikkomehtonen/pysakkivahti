# Fix npm Audit Vulnerabilities

## Context

`npm install` reports 2 low-severity vulnerabilities. Both are in `@eslint/plugin-kit <0.3.4`, which is a transitive dependency of `eslint@9.23.0` (currently installed). The vulnerability is GHSA-xffm-g5w8-qvg7 — a Regular Expression Denial of Service (ReDoS) in `ConfigCommentParser`. This is a dev-only dependency (ESLint) so it does not affect production, but the warning should be eliminated to keep the audit clean.

## Out of Scope

- Upgrading to eslint 10.x (major version bump, unnecessary for this fix)
- Changes to any runtime or production dependencies
- Changes to ESLint configuration or rules

## Implementation approach

The current `package.json` specifies `"eslint": "^9.23.0"`, which resolves to `eslint@9.23.0` in the lockfile. That version depends on `@eslint/plugin-kit@^0.2.8`, which resolves to the vulnerable `0.2.8`.

**Fix strategy:** Bump the eslint minimum in `package.json` to `^9.32.0` — the first 9.x release whose `@eslint/plugin-kit` dependency (`^0.3.4`) guarantees a patched resolution. Then run `npm install` to regenerate the lockfile with `eslint@9.39.4` (latest 9.x) and `@eslint/plugin-kit@0.4.1`.

Why bump the semver range instead of just updating the lockfile? A bare `npm install` without a lockfile (e.g., CI with `--no-package-lock`, or a fresh clone) would re-resolve from the `package.json` range. With `^9.23.0`, npm could still pick a vulnerable version. With `^9.32.0`, any resolution is safe.

Version justification:
- `eslint@9.32.0` — first 9.x to depend on `@eslint/plugin-kit@^0.3.4` (patched)
- `eslint@9.39.4` — latest 9.x (will be what npm actually resolves to)
- `@eslint/plugin-kit@0.4.1` — current latest, well above the 0.3.4 floor
- `typescript-eslint@8.61.0` — peer-dep accepts `eslint: ^9.0.0`, fully compatible

## Tasks

### Task 1 - Update eslint version and resolve vulnerabilities

- eslint version in package.json is `^9.23.0` + `npm install` run
  - → `npm audit` reports 0 vulnerabilities
  - → `package.json` devDependencies contains `"eslint": "^9.32.0"`
  - → installed eslint version is >= 9.32.0
  - → installed @eslint/plugin-kit version is >= 0.3.4

### Task 2 - Verify existing tooling still works

- `npm run lint` executed
  - → exits with code 0 (no new errors or configuration incompatibilities)
- `npm run typecheck` executed
  - → exits with code 0
- `npm test` executed
  - → all tests pass

## Notes

- This is a dev-only dependency change; no production code or behavior is affected.
- `npm audit fix` alone (without the package.json range bump) would fix the lockfile but leave the range open to vulnerable resolutions on fresh installs.
