// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Vite Bundler Configuration: vite.config.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Same base config as sibling repo HYDRA-UMC-STUDIO's own vite.config.ts
// (same stack, React/Vite - see SONNET/5.PLAN_EJECUCION_32_PROYECTOS_NUEVOS.txt),
// plus a `test` block for the real Vitest suite under tests/ (see
// src/api/*.ts's own real HTTP clients and src/lib/summary.ts for what
// it covers). Real backend calls go straight to HYDRA-UMC-DATALAKE /
// HYDRA-UMC-ANOMALY-DETECTOR by their own configured base URLs (see
// App.tsx) rather than through a dev-time '/api' proxy - both already
// send real CORS-friendly JSON responses, so no proxy is needed the way
// STUDIO's own same-origin '/api' + '/ws' rules are.
//
// `defineConfig` comes from 'vitest/config' (not plain 'vite') so the
// `test` block below type-checks - it re-exports Vite's own
// `defineConfig` merged with Vitest's config shape, not a separate one.

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
  // esbuild's own tsconfig auto-discovery doesn't reach files under
  // tests/ (tsconfig.app.json's own "include" is scoped to "src") -
  // without this, esbuild's TS-stripping step for tests/*.tsx falls back
  // to the classic JSX transform (`React.createElement` calls with no
  // implicit import) instead of the automatic one @vitejs/plugin-react
  // otherwise applies, producing a real "React is not defined" at test
  // run time under Vitest specifically (which still goes through
  // esbuild for this). `npm run build`'s own `vite build` prints a
  // real, harmless warning that Vite 8's own oxc transformer takes over
  // from this `esbuild.jsx` setting for the production build path -
  // confirmed by inspecting the real dist/ output that oxc's default is
  // already the same automatic runtime, so no separate oxc option is
  // needed here.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
