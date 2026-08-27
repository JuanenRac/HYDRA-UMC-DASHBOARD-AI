# Changelog

All notable work on **HYDRA-UMC-DASHBOARD-AI** is summarized here, newest
first. Full session-by-session detail (including dates) lives in a private,
unpublished internal log - this file is public, so it intentionally omits
calendar dates.

## Versioning scheme

`package.json`'s `version` field bumps automatically on every real
production build (`npm run build` - see `scripts/bump-version.mjs`, wired
as the first step of the `build` script, copied from sibling repo
HYDRA-UMC-STUDIO). It follows a simple base-10 "odometer" rule rather than
semantic-versioning judgment calls:

- `patch` +1 on every build
- when `patch` would exceed 9, it resets to 0 and `minor` +1 instead (e.g. `0.0.9` -> `0.1.0`, never `0.0.10`)
- the same carry cascades into `major` if `minor` would exceed 9

This file itself is *not* auto-generated per build; it's updated by hand
when a change is actually worth summarizing for a human.

---

## [0.0.2] - Real Trend Summary and Anomaly Check panels

- **`src/api/datalakeClient.ts`** - real HTTP client (browser `fetch`, no new dependency) for a real, running HYDRA-UMC-DATALAKE instance's `GET /query`. Throws `DatalakeApiError` on any real failure (network, non-2xx, malformed JSON) rather than returning a silently-empty array.
- **`src/api/anomalyClient.ts`** - real HTTP client for a real, running HYDRA-UMC-ANOMALY-DETECTOR instance's `GET /stats` and `POST /detect`. Deliberately does NOT manage that service's shared, in-memory-fitted baseline (a dashboard mutating shared detector state would be a real coupling smell) - checks `/stats` first and surfaces a real "not fitted yet" state distinctly from a generic error via `AnomalyApiError.status`.
- **`src/lib/summary.ts`** - this project's own honest scope for its README's "Smart Summaries" claim: real min/max/average/latest/direction statistics computed from real DATALAKE history, sorted correctly regardless of the order `/query` returned points in - not an LLM-generated summary (that's real, separate future work, see `mejoras_futuras.txt`).
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
