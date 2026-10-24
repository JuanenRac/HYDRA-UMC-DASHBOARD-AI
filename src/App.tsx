// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Root Component: App.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Real v0: two panels, both real HTTP clients against real running
// HYDRA-UMC-DATALAKE / HYDRA-UMC-ANOMALY-DETECTOR instances (see
// src/api/*.ts) - no mock data path. The base URLs default to the same-origin
// paths /api/datalake and /api/anomaly, which scripts/serve_static.py (and the
// Vite dev server) proxy to the two loopback services, because neither service
// sends CORS headers. VITE_DATALAKE_URL / VITE_ANOMALY_URL replace them, but
// Vite inlines them at BUILD time, so changing them needs a rebuild.
//
// What this deliberately does NOT do yet: an LLM-generated natural-language
// summary, or overlaying anomaly markers
// on top of HYDRA-UMC-STUDIO's own 3D/telemetry views - both real,
// bigger pieces of future work this v0 doesn't pretend to already cover.

import { TrendSummaryPanel } from './components/TrendSummaryPanel'
import { AnomalyCheckPanel } from './components/AnomalyCheckPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { defaultEndpoints } from './lib/endpoints'

// Served by HYDRA-UMC-SERVER (under /dashboard-ai) the page reads through that server's relay with the session of STUDIO; served on its
// own it reads through the proxy of the static server. VITE_DATALAKE_URL / VITE_ANOMALY_URL replace either.
const ENDPOINTS = defaultEndpoints(typeof window === 'undefined' ? '/' : window.location.pathname)
const DATALAKE_BASE_URL = import.meta.env.VITE_DATALAKE_URL ?? ENDPOINTS.datalake
const ANOMALY_BASE_URL = import.meta.env.VITE_ANOMALY_URL ?? ENDPOINTS.anomaly

function App() {
  return (
    <main className="app-shell">
      <h1>HYDRA-UMC-DASHBOARD-AI</h1>
      <p className="app-role">
        AI-powered analytical extension for the HYDRA-UMC-STUDIO web dashboard - real trend
        statistics and anomaly checks over HYDRA-UMC-DATALAKE ({DATALAKE_BASE_URL}) and
        HYDRA-UMC-ANOMALY-DETECTOR ({ANOMALY_BASE_URL}).
      </p>

      <div className="panels">
        <ErrorBoundary panelName="Trend Summary">
          <TrendSummaryPanel datalakeBaseUrl={DATALAKE_BASE_URL} />
        </ErrorBoundary>
        <ErrorBoundary panelName="Anomaly Check">
          <AnomalyCheckPanel datalakeBaseUrl={DATALAKE_BASE_URL} anomalyBaseUrl={ANOMALY_BASE_URL} />
        </ErrorBoundary>
      </div>
    </main>
  )
}

export default App
