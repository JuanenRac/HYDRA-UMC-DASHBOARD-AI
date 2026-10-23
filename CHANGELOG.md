# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- The manifest declares the health route of the service (the page it serves), so the service registry, the ecosystem status of the server and the watchdog know where to probe it.
- **Content-Security-Policy.** `scripts/serve_static.py` sends one with every answer: scripts only from the page itself (no inline scripts, no plugins), no framing, connections only to its own origin. `--connect-src ORIGIN` (repeatable) adds the origins a build with `VITE_DATALAKE_URL`/`VITE_ANOMALY_URL` calls, `--csp off` (or `HYDRA_DASHBOARD_CSP=off`) sends none, and any other `--csp` value is used as the complete policy. Tested.
- **ESLint.** `npm run lint` (which CI already called when present) runs ESLint 9 with the recommended rules, typescript-eslint and the React hooks rules; the two deliberate control-character patterns carry a reasoned exception, the tests may use `any`.
- Building no longer changes the version; raising it is the explicit `bump` command (`python tools/hydra_project_tool.py bump`). The build scripts only report the version they built, and CI fails if a build script runs a bump.
- The banner follows the animated style of the ecosystem banners, with the name, the kind and the technologies of the project.
- Added `tools/hydra_project_tool.py`: the same `validate`, `test`, `version`, `status` and `bump` commands in every repository. The checks run with `HYDRA_UMC_CI=1` and fail if the version changes; only `bump` changes it.

## [0.1.6]

- Maturity is functional: nothing here has been verified on real hardware yet.
- The READMEs say, in the eight languages, what is planned and what has only been tested against fakes, emulators or fixtures, and carry a short safety and security status note.

## [0.1.5] - A cancelled request is not sent

- **Requests:** `fetchWithTimeout` ignored a caller `AbortSignal` that was already cancelled when the call started (the abort event never fires again), so the request still went out and only stopped at the timeout. It now cancels at once without sending anything.
- 70 new tests (140 in all): hostile or broken answers from DATALAKE and the anomaly detector (non-array, HTML pages, bad points, JSON `null` errors), service address handling, narrative gate limits and control characters, and trend-summary edge cases.

## [0.1.4]

- Build version synchronized with `hydra-umc.project.json` and the repository-native version source.
- The licence is written as GPL-3.0-or-later in every header and in the package metadata.

## [0.1.3] - The deployed dashboard can reach its services, and the type check checks

- **Deployment:** the panels called DATALAKE and the anomaly detector on other ports, which neither service allows from a browser (no CORS headers), and `localhost` meant the visitor's own computer. The static server now forwards `/api/datalake/*` and `/api/anomaly/*` to the two loopback services (GET and POST only, bounded sizes, 502 when a service is down; `--datalake` and `--anomaly` choose the upstreams), the app calls those same-origin paths by default, and the Vite dev server proxies the same two paths. A base URL with a path is now joined correctly.
- **Type check:** `npm run typecheck` ran `tsc` on a project with no files and always passed. It now checks the app and the Vite config, the four constructors that the strict settings rejected are fixed, and Vitest moved to 4.x so its types match Vite 8; `npm run build` runs the same check first.
- **Build scripts:** `build.sh`/`build.bat` called `npm install-scripts approve --all`, which older npm versions do not have, and aborted after the version had already been bumped; they now use `npm ci`.
- **Narrative gate:** the "AI"/"Statistical fallback" label is decided by the code path, never by what a provider claims; a failing provider is logged instead of being hidden; and the source, kind and field names must be plain identifiers before they can reach a future language-model prompt.
- **Trend direction:** it is now the slope of the fitted line over the whole series with a noise-aware threshold, so one spike at the end or noise around zero no longer reads as rising or falling.
- **Anomaly check:** it defaults to the vibration kind, and both panels validate the window size and the minutes before sending.
- **Docs:** the base-URL comment no longer claims a rebuild is not needed, the page title has no stale version, the README, manifest and test counts (70 Vitest and 11 unittest tests) are current.

## [0.1.2] - Static server hardening, Portuguese README

- **Directory listings are off:** the static file server (`scripts/serve_static.py`, used to serve the built SPA on the CM5) is the stdlib `SimpleHTTPRequestHandler`, which lists a directory that has no `index.html` file by file; the built `assets/` folder was browsable. A directory without an index is now a 404 (the files in it are still served).
- **Hardening headers and an idle timeout:** every response now carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` (nothing in the ecosystem frames this page), and a client that connects and sends nothing is dropped after 15 seconds instead of holding a handler thread forever.
- **Tests:** the static server's tests grow from 4 to 8 (no listing, the hardening headers, path traversal never serves a file outside the root, the dropped idle connection); the Vitest suite is 62.
- **Docs:** the README test counts were out of date (59 Vitest and 4 pytest) and are corrected, and a README in Portuguese (`README_por.md`) joins the other translations.

## [0.1.1] - Dedicated AnomalyCheckPanel test suite

- Added a real render/interaction Vitest suite for `AnomalyCheckPanel`,
  covering the "not fitted yet" operational state, a scored verdict from
  a fitted detector, and the "not enough samples" error - following the
  same real-`node:http`-server, unmocked-fetch pattern already used by
  `TrendSummaryPanel.test.tsx`.

## [0.1.0] - Per-panel render-failure isolation, request timeouts, and content validation

- **Per-panel render-failure isolation:** neither panel had an error
  boundary before this - a render-time exception in one (a malformed
  DATALAKE/ANOMALY-DETECTOR response reaching a component that didn't
  expect its exact shape, for instance) would unmount the entire app,
  since React discards everything above the nearest error boundary on an
  uncaught render error, and there wasn't one. `App.tsx` now wraps each
  panel in its own `ErrorBoundary` (new `components/ErrorBoundary.tsx`),
  so a crash stays contained to that panel's own fallback card while the
  other keeps working. 3 new tests prove the isolation directly (one
  panel throwing, the sibling still rendering normally).
- **Real request timeouts on both HTTP clients:** `datalakeClient.ts` and `anomalyClient.ts` used to
  call `fetch()` directly with no `AbortController` and no timeout at all - a slow or hung DATALAKE/
  ANOMALY-DETECTOR instance (network partition, an overloaded process that accepted the connection but
  never writes a response) left a panel waiting indefinitely. Both now route every request through a
  new shared `fetchWithTimeout()` (5-second default), reported back as a clear, distinguishable
  timeout error instead of a request that simply never resolves.
- **External-content contract validation:** Datalake points and anomaly
  verdicts are now structurally validated at the HTTP client boundary before
  panels calculate with or render them. Malformed numeric values no longer
  reach `toFixed()`, and service-provided identifiers reject control
  characters and excessive length.
- **Provider narrative hardening:** provider narratives reject unsafe control
  and bidirectional-format characters, are trimmed before display, and retain
  the existing safe statistical fallback on every invalid provider response.
- **Public safety contract:** added [`docs/SECURITY.md`](docs/SECURITY.md),
  including deployment boundaries, failure behaviour, and test coverage.

---

## [0.0.9]

- Build version synchronized with `hydra-umc.project.json` and the repository-native version source.

## [0.0.8]

- **`summarize()` links min/max/latest back to the real observation
  they came from.** `TrendSummary` previously reported bare
  min/max/average/latest numbers with no way to check them against
  DATALAKE's own history - a min/max value nobody could trace back to
  when it happened. Added `minTimestamp`/`maxTimestamp`/`latestTimestamp`,
  computed in a single ascending pass over the real, sorted series (ties
  keep the earliest occurrence). `TrendSummaryPanel` now shows a real
  local timestamp under each of Min/Max/Latest. 4 new tests (53/53
  passing).

## [0.0.7] - Fixed a real silent-truncation bug in `queryDatalake`

- Found on code review: DATALAKE's own `GET /query`
  returns points oldest-first, capped at a `limit` that defaults to 1000.
  Both `TrendSummaryPanel` and `AnomalyCheckPanel` query a wide time
  range and treat the tail of the result as "the most recent samples" -
  but a source producing more real samples than that limit within the
  requested range would have been silently truncated to its OLDEST
  samples, not its newest, so "latest"/"most recent window" could
  actually be stale data instead of what the panel claimed it was.
  `queryDatalake` now requests a much larger default limit when a caller
  does not specify one, and fails with a clear `DatalakeApiError` instead
  of silently returning a truncated window whenever the response hits
  exactly the requested limit.

## [0.0.6] - Real static-serving on the CM5 (own port, no Node runtime needed once built)

- **`scripts/serve_static.py`** (new) - real gap found checking the ecosystem against actual CM5 hardware: this project builds a real,
  deployable static SPA (`npm run build` -> `dist/`), but nothing on the
  CM5 ever served it. Deliberately plain stdlib `http.server`, not a
  second Node runtime on the CM5 just to serve pre-built static files.
  No SPA client-side routing exists in this app (checked against
  `src/App.tsx`/`package.json` before writing this, not assumed), so
  this is a plain static file server, not a SPA-fallback-to-index.html
  server - a request for a path with no matching file is a real 404.
- **`scripts/test_serve_static.py`** (new) - real end-to-end tests
  (stdlib `unittest`, not pytest, so this otherwise-pure-JS/TS repo gets
  no new toolchain requirement) against a real `ThreadingHTTPServer`.
- **`systemd/hydra-umc-dashboard-ai.service`** (new) - unit for
  `HYDRA-UMC-OS/provisioning/install_dashboard_ai.sh` (new, that repo).
  Own port (8115)/service, deliberately NOT folded into
  `HYDRA-UMC-SERVER`'s own `public/` the way `HYDRA-UMC-STUDIO` is - this
  dashboard already talks straight to `HYDRA-UMC-DATALAKE`/
  `HYDRA-UMC-ANOMALY-DETECTOR` by their own configured base URLs (see
  `vite.config.ts`'s own comment), so it never needed `SERVER`'s own
  backend, and two independent SPAs sharing one origin risks route/asset
  collisions. Verified end-to-end: a real `npm run build` output served
  by `serve_static.py` returns the real `index.html` and a real hashed
  asset file.

## [0.0.5] - Real AI-provider gate: input/output schema validation and honest fallback

- **`src/lib/aiProvider.ts`** (new) - the real, honest v0 contract an eventual LLM-based "Smart Summary" narrative will have to satisfy. `validateNarrativeRequest()` schema-checks what would be sent to a provider; `validateNarrativeResponse()` schema-checks whatever a provider returns - catching the real "unstructured output" failure mode (a missing/empty/non-string narrative, an absurdly long one, an unrecognized `generatedBy` tag) before it ever reaches the UI. `NO_PROVIDER_CONFIGURED` is the real default provider for v0: no LLM backend exists yet, so it builds its narrative directly from the already-real statistics in `summary.ts`, honestly labeled `statistical-fallback` rather than passed off as AI-generated. `safeGenerateNarrative()` is the real safe entry point: validates the request, calls a provider, validates its response, and falls back to the same real statistical narrative for every real failure mode - a thrown error, or a provider returning malformed/unstructured output - rather than ever showing a broken or empty panel.
- **`TrendSummaryPanel.tsx`** - now calls `safeGenerateNarrative()` after computing a real summary and renders the result (labeled "AI" or "Statistical fallback") alongside the existing stats grid.
- 24 new tests (`aiProvider.test.ts`'s full request/response validation matrix including the real unstructured-output rejection cases, plus a new real end-to-end panel assertion) - 39 total, all passing. Verified live via a real `npm run build`/`vitest run` pass (0.0.4 -> 0.0.5) and the existing real HTTP-server-backed component test now also asserting the real fallback narrative renders.

## [0.0.4]

- Build version synchronized across `hydra-umc.project.json`, `package.json` and the native package lock.

## [0.0.2] - Real Trend Summary and Anomaly Check panels

- **`src/api/datalakeClient.ts`** - real HTTP client (browser `fetch`, no new dependency) for a real, running HYDRA-UMC-DATALAKE instance's `GET /query`. Throws `DatalakeApiError` on any real failure (network, non-2xx, malformed JSON) rather than returning a silently-empty array.
- **`src/api/anomalyClient.ts`** - real HTTP client for a real, running HYDRA-UMC-ANOMALY-DETECTOR instance's `GET /stats` and `POST /detect`. Deliberately does NOT manage that service's shared, in-memory-fitted baseline (a dashboard mutating shared detector state would be a real coupling smell) - checks `/stats` first and surfaces a real "not fitted yet" state distinctly from a generic error via `AnomalyApiError.status`.
- **`src/lib/summary.ts`** - this project's own honest scope for its README's "Smart Summaries" claim: real min/max/average/latest/direction statistics computed from real DATALAKE history, sorted correctly regardless of the order `/query` returned points in - not an LLM-generated summary (that remains separate future work).
- **`src/components/TrendSummaryPanel.tsx`** and **`AnomalyCheckPanel.tsx`** - two real, working panels wired into `App.tsx`, both configurable via `VITE_DATALAKE_URL`/`VITE_ANOMALY_URL` (defaulting to each service's own documented local-dev port, 8095/8097).
- **16 new tests** (`tests/*.test.ts(x)`) - real HTTP round-trips against real `node:http` servers standing in for both siblings' real contracts (not mocked `fetch`), plus real `@testing-library/react` + `user-event` component tests driving a real click through to a real rendered summary.
- **Real bug found and fixed during this pass**: Vitest's own `.tsx` transform for files under `tests/` (outside `tsconfig.app.json`'s `"include": ["src"]`) fell back to the classic JSX runtime, producing a real `ReferenceError: React is not defined` the moment a component test tried to render anything - fixed with an explicit `esbuild: { jsx: 'automatic' }` in `vite.config.ts`.
- **Real cross-service integration verified end-to-end**: a real HYDRA-UMC-DATALAKE and a real HYDRA-UMC-ANOMALY-DETECTOR were started, seeded/fitted with real data, and queried directly with `curl` to confirm both services' real JSON response shapes match this project's own TypeScript types exactly (`DatalakePoint`, `DetectVerdict`) - the concrete proof this project actually "speaks" correctly with both real siblings, not just against test doubles.
- **`build.sh`/`build.bat`** - now run the real test suite (`npm test`) as a required step before compiling; `build.sh` no longer auto-closes its window on completion.
- The hardcoded `APP_VERSION = '1.0.0'` placeholder in the old `App.tsx` (contradicting this ecosystem's real `0.0.x` odometer scheme) is gone - the header no longer claims a version number it doesn't track.

## [0.0.0] - Initial scaffolding

- **React 19 + Vite + TypeScript app** (`src/main.tsx`, `src/App.tsx`,
  `src/index.css`) - reuses HYDRA-UMC-STUDIO's own stack rather than
  introducing a new one, so this can eventually be embedded as a panel
  inside STUDIO itself.
- **`vite.config.ts`** - trimmed-down copy of STUDIO's own config (no
  Tailwind, no API proxy yet - this project has no backend calls of its
  own so far).
- **`scripts/bump-version.mjs`** - identical odometer-style bump script to
  STUDIO's, wired into `npm run build`.
- **`dev.sh` / `dev.bat`** - install dependencies, start the Vite dev
  server on port `5174`.
- **`build.sh` / `build.bat`** - install dependencies, then
  `npm run build` (bump version -> `tsc --noEmit` -> `vite build`).
- The real analytics features described in the README (Smart Summaries,
  Trend Prediction, Anomaly Highlighting, Optimization Tips) are the next
  milestone - they need HYDRA-UMC-DATALAKE and HYDRA-UMC-ANOMALY-DETECTOR
  to exist and expose real data first. This is tracked in the project roadmap.
