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
import { RulGate } from './components/RulGate'
import { useEffect, useMemo } from 'react'
import { FleetPanel } from './components/FleetPanel'
import { createCognitiveProvider } from './api/cognitiveClient'
import { NO_PROVIDER_CONFIGURED } from './lib/aiProvider'
import { readAiFeatures, type AiFeatures } from './lib/aiConfig'
import { isEmbedRequested, postHeight } from './lib/embed'
import { browserLang } from './lib/i18n'
import { defaultEndpoints } from './lib/endpoints'
import { readRulConfig, type RulConfig } from './lib/rulConfig'

// Served by HYDRA-UMC-SERVER (under /dashboard-ai) the page reads through that server's relay with the session of STUDIO; served on its
// own it reads through the proxy of the static server. VITE_DATALAKE_URL / VITE_ANOMALY_URL replace either.
const ENDPOINTS = defaultEndpoints(typeof window === 'undefined' ? '/' : window.location.pathname)
const DATALAKE_BASE_URL = import.meta.env.VITE_DATALAKE_URL ?? ENDPOINTS.datalake
const ANOMALY_BASE_URL = import.meta.env.VITE_ANOMALY_URL ?? ENDPOINTS.anomaly

// The remaining-useful-life card needs the build to allow it (VITE_RUL_ENABLED=true; see lib/rulConfig.ts) and the running server to have
// it open (GET /api/rul/config; see components/RulGate.tsx). Either one missing, or a server that does not answer: no card.
const RUL_CONFIG = readRulConfig(import.meta.env, ANOMALY_BASE_URL)

// The language-model sentence and the Fleet card are off unless the build switches them on (see lib/aiConfig.ts).
const AI_FEATURES = readAiFeatures(import.meta.env, ENDPOINTS.behindServer)

interface AppProps {
  /** Overrides the build-time configuration of the card (tests). */
  rul?: RulConfig
  /** Overrides the build-time switches of the language model and of the Fleet card (tests). */
  ai?: AiFeatures
  /** Overrides the query string that asks for the embedded mode (tests). */
  search?: string
}

function App({ rul = RUL_CONFIG, ai = AI_FEATURES, search }: AppProps = {}) {
  const embedded = isEmbedRequested(search ?? (typeof window === 'undefined' ? '' : window.location.search))
  const provider = useMemo(
    () => (ai.cognitiveEnabled ? createCognitiveProvider(ai.cognitiveUrl, browserLang(), ai.cognitiveTimeoutMs) : NO_PROVIDER_CONFIGURED),
    [ai.cognitiveEnabled, ai.cognitiveUrl, ai.cognitiveTimeoutMs],
  )

  // Embedded in STUDIO: tell the frame how tall the page is, so it can follow (only to this page's own origin)
  useEffect(() => {
    if (!embedded || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => postHeight(document.documentElement.scrollHeight))
    observer.observe(document.body)
    postHeight(document.documentElement.scrollHeight)
    return () => observer.disconnect()
  }, [embedded])

  return (
    <main className={embedded ? 'app-shell app-embedded' : 'app-shell'}>
      {!embedded && <h1>HYDRA-UMC-DASHBOARD-AI</h1>}
      {!embedded && (
        <p className="app-role">
          AI-powered analytical extension for the HYDRA-UMC-STUDIO web dashboard - real trend
          statistics and anomaly checks over HYDRA-UMC-DATALAKE ({DATALAKE_BASE_URL}) and
          HYDRA-UMC-ANOMALY-DETECTOR ({ANOMALY_BASE_URL}).
        </p>
      )}

      <div className="panels">
        <ErrorBoundary panelName="Trend Summary">
          <TrendSummaryPanel datalakeBaseUrl={DATALAKE_BASE_URL} provider={provider} />
        </ErrorBoundary>
        <ErrorBoundary panelName="Anomaly Check">
          <AnomalyCheckPanel datalakeBaseUrl={DATALAKE_BASE_URL} anomalyBaseUrl={ANOMALY_BASE_URL} />
        </ErrorBoundary>
        {ai.fleetEnabled && (
          <ErrorBoundary panelName="Fleet">
            <FleetPanel anomalyBaseUrl={ANOMALY_BASE_URL} refreshMs={ai.fleetRefreshMs} />
          </ErrorBoundary>
        )}
        <RulGate build={rul} datalakeBaseUrl={DATALAKE_BASE_URL} />
      </div>
    </main>
  )
}

export default App
