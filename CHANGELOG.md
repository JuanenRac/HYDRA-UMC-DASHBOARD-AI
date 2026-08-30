# Changelog

All notable public work on **HYDRA-UMC-DASHBOARD-AI** is summarized here,
newest first. This changelog intentionally omits calendar dates and internal
work-session detail.

## Versioning scheme

`package.json`'s `version` field bumps via `bump_manifest_version.py`
(bare invocation - this repo is a "single owner" of its own version, no
separate `--sync` step), run by `build.bat`/`build.sh` BEFORE `npm run
build` itself - `npm run build` (`vite build`) is deliberately
compilation-only, same convention as sibling repo HYDRA-UMC-STUDIO.
`scripts/bump-version.mjs` is a legacy native-only helper kept for
reference; nothing in this repo's real build path calls it. It follows a
simple base-10 "odometer" rule rather than semantic-versioning judgment
calls:

- `patch` +1 on every build
- when `patch` would exceed 9, it resets to 0 and `minor` +1 instead (e.g. `0.0.9` -> `0.1.0`, never `0.0.10`)
- the same carry cascades into `major` if `minor` would exceed 9

This file itself is *not* auto-generated per build; it's updated by hand
when a change is actually worth summarizing for a human.

---

## [Unreleased]

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
