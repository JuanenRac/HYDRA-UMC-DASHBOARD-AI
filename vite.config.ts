// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Vite Bundler Configuration: vite.config.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Same base config as sibling repo HYDRA-UMC-STUDIO's own vite.config.ts
// (same React/Vite stack), plus a `test` block for the Vitest suite under
// tests/. The two services are called through same-origin paths (/api/datalake
// and /api/anomaly) that scripts/serve_static.py proxies to the loopback
// services, because neither service sends CORS headers; the dev server below
// proxies the same two paths so `npm run dev` behaves like the deployment.
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
    proxy: {
      '/api/datalake': {
        target: 'http://127.0.0.1:8095',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/datalake/, ''),
      },
      '/api/anomaly': {
        target: 'http://127.0.0.1:8097',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anomaly/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
