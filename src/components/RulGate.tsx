// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Gate of the remaining useful life card: RulGate.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The card needs two yeses: the build allows it (VITE_RUL_ENABLED=true) and the running server has it open (GET /api/rul/config).
// A build that does not allow it renders nothing and never asks the server. While the server has not answered, and for every
// answer but a clear "open" (closed, no route, refused session, error, timeout, nonsense), nothing is rendered either.

import { useEffect, useState } from 'react'
import { applyServerLimits, fetchRulServerConfig, RUL_SERVER_CONFIG_PATH, type RulServerOutcome } from '../api/rulServerConfigClient'
import type { RulConfig } from '../lib/rulConfig'
import { ErrorBoundary } from './ErrorBoundary'
import { RulPanel } from './RulPanel'

interface Props {
  /** The configuration of the build. */
  build: RulConfig
  datalakeBaseUrl: string
  /** Where the server's setting is read (a path of this page's own origin). */
  serverConfigUrl?: string
}

export function RulGate({ build, datalakeBaseUrl, serverConfigUrl = RUL_SERVER_CONFIG_PATH }: Props) {
  const allowed = build.enabled
  const [outcome, setOutcome] = useState<RulServerOutcome | null>(null)

  useEffect(() => {
    if (!allowed) return undefined
    let live = true
    void fetchRulServerConfig(serverConfigUrl).then((result) => {
      if (live) setOutcome(result)
    })
    return () => {
      live = false
    }
  }, [allowed, serverConfigUrl])

  if (!allowed || outcome === null || outcome.state !== 'open') return null
  return (
    <ErrorBoundary panelName="Remaining useful life">
      <RulPanel datalakeBaseUrl={datalakeBaseUrl} config={applyServerLimits(build, outcome.config)} />
    </ErrorBoundary>
  )
}
