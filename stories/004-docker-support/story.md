# Docker Support for Pysäkkivahti MVP

## Context

The app currently runs only as a local Node.js process. Adding Docker support lets users deploy Pysäkkivahti with a single `docker build` + `docker run`, without installing Node.js, npm, or managing `.env` files manually. This is the standard deployment path for the MVP.

## Out of Scope

- Docker Compose or any orchestrator
- nginx or other reverse proxies
- Database or persistence layer
- CI/CD pipeline integration
- Health check endpoints
- Multi-architecture builds (arm64, etc.)
- Renaming `PYSAKKIVAHTI_API_KEY` to `DIGITRANSIT_API_KEY` (separate concern if desired)
- Non-root user in container (can be added later; "keep it simple" per requirements)

## Implementation approach

**Multi-stage Dockerfile with esbuild bundling (packages=external):**

Stage 1 (`build`): Uses `node:24-alpine` (matches the project's local Node v24.16.0 and current Active LTS). Installs all dependencies, builds the Vite frontend (`npx vite build` → `dist/`), then bundles the Express server into a single ESM file using esbuild. esbuild is already a devDependency (`esbuild@^0.28.1`).

The esbuild command:
```
npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --target=es2022 --outfile=dist-server/server.js
```

The `--packages=external` flag is required because `dotenv` uses CJS `require('fs')` internally, which fails in a fully-bundled ESM output (verified by testing — full bundle throws "Dynamic require of 'fs' is not supported"). With `--packages=external`, npm packages (express, dotenv) remain as external imports resolved from `node_modules` at runtime, while all local `.ts` code is bundled inline. This resolves the `.ts` extension imports that Node's native TS support does not handle.

The output is a 13.8 KB bundle containing all local code (config.ts, digitransit.ts, geo.ts, src/types.ts) with `import` statements for express and dotenv.

Stage 2 (`production`): Uses `node:24-alpine`. Copies `package.json` and `package-lock.json` (needed for `npm ci` and for the `"type": "module"` declaration that makes Node.js load `server.js` as ESM), installs production-only dependencies (`npm ci --omit=dev` — yields ~3.9 MB of node_modules), then copies the bundled `server.js`, the Vite-built `dist/` directory, and `config.json`. Sets `NODE_ENV=production` so `express.static('dist')` is activated.

**Why esbuild bundling over tsx in production:**
- tsx is a dev tool; including it in production requires full node_modules (~hundreds of MB)
- The bundled server.js + production-only node_modules (~3.9 MB) is much smaller
- esbuild is already a project devDependency — no new dependency
- The bundle correctly handles `.ts` extension imports (which Node's `--experimental-strip-types` does not)

**Runtime behavior verified against existing code:**
- `dotenv/config` is imported from node_modules; reads `.env` from cwd but since `.dockerignore` excludes `.env`, it silently does nothing. Env vars come from `docker run -e`.
- `config.json` is loaded via `readFileSync(resolve('config.json'))` at startup — must be in the working directory
- `express.static('dist')` serves the built frontend — `dist/` must be in the working directory
- The `import.meta.url === pathToFileURL(process.argv[1]).href` check at the bottom of `server.ts` works correctly in the bundled file (esbuild supports `import.meta.url` on the node platform; `pathToFileURL` resolves relative paths to absolute URLs)
- `fetch` used in `digitransit.ts` is a global in Node 24 — no polyfill needed
- Verified end-to-end: `node server.js` starts, `/api/locations` returns JSON, `/` serves frontend HTML (HTTP 200)

**`.dockerignore`:** Excludes `.env`, `.git`, `node_modules`, `dist`, `feasibility-study/`, `docs/`, `stories/`, `.opencode/`, `tests/`, and other build-irrelevant paths to keep the build context small and prevent secrets from leaking into the image.

## Tasks

### Task 1 - Add .dockerignore file

- `.dockerignore` file exists in project root and contains `.env`
  - → `docker build` context does not include `.env` file (verified by reading file content)
- `.dockerignore` excludes `node_modules`, `.git`, `dist`
  - → build context is smaller and avoids stale or large directories
- `.dockerignore` excludes `feasibility-study/`, `docs/`, `stories/`, `.opencode/`, `tests/`
  - → build context does not include reference material or test files

### Task 2 - Add multi-stage Dockerfile

- `Dockerfile` exists in project root with two stages (`build` and `production`)
  - → `docker build -t pysakkivahti .` succeeds without errors
- Stage 1 (`build`) installs all deps and produces two build artifacts
  - → `dist/` directory contains Vite-built frontend (index.html, JS, CSS, favicon.svg)
  - → `dist-server/server.js` exists and is a 13.8 KB ESM bundle with `--packages=external`
- Stage 2 (`production`) is based on `node:24-alpine` and installs production-only deps via `npm ci --omit=dev`
  - → production node_modules contains only express, dotenv, and their transitive deps (~3.9 MB)
  - → production image does not contain `.env` file
- Stage 2 copies `server.js`, `dist/`, and `config.json` into the image
  - → all runtime files are present in the working directory
- `ENV NODE_ENV=production` is set in the production stage
  - → `express.static('dist')` middleware is active, serving frontend files
- `EXPOSE 3000` is declared
  - → container port 3000 is documented
- `CMD ["node", "server.js"]` starts the Express server
  - → server starts and logs "Pysäkkivahti server running on port 3000"
- Container responds to HTTP requests
  - → `docker run -p 3000:3000 -e PYSAKKIVAHTI_API_KEY=test pysakkivahti` → `curl http://localhost:3000/api/locations` returns JSON locations
  - → `curl http://localhost:3000/` returns the frontend HTML (HTTP 200)

### Task 3 - Add Docker instructions to README.md

- README.md has a "Docker" section after the "Production Build" section
  - → build command `docker build -t pysakkivahti .` is documented
  - → run command `docker run -d --name pysakkivahti -p 3000:3000 -e PYSAKKIVAHTI_API_KEY=xxx pysakkivahti` is documented
- README.md notes that `config.json` can be mounted as a volume for customization without rebuilding
  - → user sees example: `-v ./config.json:/app/config.json`

## Technical Context

- `esbuild@^0.28.1` — already a devDependency; used for server bundling in Stage 1. No new dependency.
- `node:24-alpine` — Node.js 24 LTS Alpine image; matches the project's local Node v24.16.0. Small footprint (~50 MB base). Node 24 provides global `fetch` and full ESM support.
- `express@^5.2.1` — pure ESM package, remains external via `--packages=external`, resolved from node_modules at runtime.
- `dotenv@^17.4.2` — CJS package, remains external via `--packages=external`. Cannot be fully bundled because it uses `require('fs')` which fails in ESM output. Silently no-ops when `.env` file is absent (which is the case in the Docker image).
- esbuild `--platform=node` automatically marks Node built-in modules (`fs`, `path`, `url`) as external — no special configuration needed.
- esbuild supports `import.meta.url` in ESM format on the node platform — the startup guard in `server.ts` line 227 works correctly in the bundled output.
- Production `node_modules` (from `npm ci --omit=dev`) is approximately 3.9 MB — express, dotenv, and their transitive deps only.

## Notes

- The existing code reads the API key from `PYSAKKIVAHTI_API_KEY` (not `DIGITRANSIT_API_KEY`). The Docker `run` command uses `-e PYSAKKIVAHTI_API_KEY=xxx` to match the actual code. If the env var name should change, that requires a separate code change to `server.ts`, `.env.example`, and `server.test.ts` — outside this story's scope.
- `config.json` is baked into the image at build time. To customize stops/locations without rebuilding, mount it as a volume: `docker run -v ./config.json:/app/config.json ...`.
- The esbuild bundle does not include `config.json` because it is read dynamically via `readFileSync(resolve('config.json'))` at runtime — esbuild cannot statically analyze this path, so the file is not bundled and must be copied separately.
- The full esbuild bundle (without `--packages=external`) does NOT work: `dotenv` internally uses CJS `require('fs')`, which throws "Dynamic require of 'fs' is not supported" in ESM output. This was verified by testing.
