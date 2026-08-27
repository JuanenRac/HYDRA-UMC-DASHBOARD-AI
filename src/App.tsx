// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Root Component: App.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Real v0: two panels, both real HTTP clients against real running
// HYDRA-UMC-DATALAKE / HYDRA-UMC-ANOMALY-DETECTOR instances (see
// src/api/*.ts) - no mock data path. Base URLs are configurable via Vite
// env vars (VITE_DATALAKE_URL / VITE_ANOMALY_URL) so this doesn't need a
// rebuild to point at a different deployment; both default to the two
// services' own documented default ports for local development.
//
// What this deliberately does NOT do yet (see mejoras_futuras.txt): an
// LLM-generated natural-language summary, or overlaying anomaly markers
// on top of HYDRA-UMC-STUDIO's own 3D/telemetry views - both real,
// bigger pieces of future work this v0 doesn't pretend to already cover.

import { TrendSummaryPanel } from './components/TrendSummaryPanel'
import { AnomalyCheckPanel } from './components/AnomalyCheckPanel'

const DATALAKE_BASE_URL = import.meta.env.VITE_DATALAKE_URL ?? 'http://localhost:8095'
const ANOMALY_BASE_URL = import.meta.env.VITE_ANOMALY_URL ?? 'http://localhost:8097'

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
        <TrendSummaryPanel datalakeBaseUrl={DATALAKE_BASE_URL} />
        <AnomalyCheckPanel datalakeBaseUrl={DATALAKE_BASE_URL} anomalyBaseUrl={ANOMALY_BASE_URL} />
      </div>
    </main>
  )
}

export default App
