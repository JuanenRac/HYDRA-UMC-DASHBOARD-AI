// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Fleet card: FleetPanel.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// A table of every series the anomaly detector follows: its last score, how far the recent scores have drifted from the healthy
// reference and the state that follows (normal, anomalous, drifting, sustained drift). It only reads GET /fleet of the detector; a
// sustained drift may have made the detector PROPOSE a maintenance order, and the card says how many proposals went out, but
// deciding on them is somebody else's screen. The App mounts it only when the build switches it on (VITE_FLEET_ENABLED=true).

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFleet, type FleetOutcome, type FleetRow } from '../api/fleetClient'
import { at, type AiKey } from '../lib/aiTexts'
import { browserLang, type Lang } from '../lib/i18n'

interface Props {
  anomalyBaseUrl: string
  /** Milliseconds between refreshes; 0 for manual only. */
  refreshMs: number
  /** Fixed language; the browser's by default. */
  lang?: Lang
}

export type FleetState = 'sustained' | 'drifted' | 'anomalous' | 'normal' | 'nodata'

export function fleetState(row: FleetRow): FleetState {
  if (row.lastScore === null) return 'nodata'
  if (row.driftSustained) return 'sustained'
  if (row.drifted) return 'drifted'
  if (row.anomalous === true) return 'anomalous'
  return 'normal'
}

const STATE_RANK: Record<FleetState, number> = { sustained: 0, drifted: 1, anomalous: 2, normal: 3, nodata: 4 }
const STATE_KEY: Record<FleetState, AiKey> = {
  sustained: 'stateSustained', drifted: 'stateDrifted', anomalous: 'stateAnomalous', normal: 'stateNormal', nodata: 'stateNoData',
}

/** The worst first, then by name, so the series that need a look are at the top. */
export function sortFleet(rows: FleetRow[]): FleetRow[] {
  return [...rows].sort((a, b) => STATE_RANK[fleetState(a)] - STATE_RANK[fleetState(b)] || `${a.sourceId}/${a.kind}/${a.field}`.localeCompare(`${b.sourceId}/${b.kind}/${b.field}`))
}

function failureText(lang: Lang, outcome: Extract<FleetOutcome, { state: 'failed' }>): string {
  switch (outcome.reason) {
    case 'off': return at(lang, 'fleetErrOff')
    case 'auth': return at(lang, 'fleetErrAuth')
    case 'timeout': return at(lang, 'fleetErrTimeout')
    case 'unreachable': return at(lang, 'fleetErrUnreachable')
    case 'http': return at(lang, 'fleetErrHttp', { status: outcome.status ?? '' })
    default: return at(lang, 'fleetErrInvalid')
  }
}

export function FleetPanel({ anomalyBaseUrl, refreshMs, lang }: Props) {
  const language = lang ?? browserLang()
  const [outcome, setOutcome] = useState<FleetOutcome | null>(null)
  const [loading, setLoading] = useState(false)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++latest.current
    setLoading(true)
    const result = await fetchFleet(anomalyBaseUrl)
    if (ticket !== latest.current) return // a newer request is in flight
    setOutcome(result)
    setLoading(false)
  }, [anomalyBaseUrl])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the card asks the detector once when it appears
    void load()
    if (refreshMs <= 0) return undefined
    const timer = setInterval(() => void load(), refreshMs)
    return () => {
      clearInterval(timer)
      latest.current += 1
    }
  }, [load, refreshMs])

  const view = outcome?.state === 'ok' ? outcome.view : null

  return (
    <section className="panel" aria-labelledby="fleet-heading" data-testid="fleet-panel">
      <h2 id="fleet-heading">{at(language, 'fleetTitle')}</h2>
      <p className="panel-subtitle">{at(language, 'fleetSubtitle')}</p>
      <button type="button" onClick={() => void load()} disabled={loading}>
        {loading ? at(language, 'fleetLoading') : at(language, 'fleetRefresh')}
      </button>

      {outcome?.state === 'failed' && (
        <p role="alert" className="panel-error" data-testid="fleet-error">{failureText(language, outcome)}</p>
      )}

      {view && view.rows.length === 0 && <p data-testid="fleet-empty">{at(language, 'fleetEmpty')}</p>}

      {view && view.rows.length > 0 && (
        <table className="fleet-table" data-testid="fleet-table">
          <thead>
            <tr>
              <th scope="col">{at(language, 'colSeries')}</th>
              <th scope="col">{at(language, 'colScore')}</th>
              <th scope="col">{at(language, 'colDrift')}</th>
              <th scope="col">{at(language, 'colState')}</th>
              <th scope="col">{at(language, 'colUpdated')}</th>
            </tr>
          </thead>
          <tbody>
            {sortFleet(view.rows).map((row) => {
              const state = fleetState(row)
              return (
                <tr key={`${row.sourceId}/${row.kind}/${row.field}`} data-state={state}>
                  <th scope="row">{row.sourceId}/{row.kind}/{row.field}</th>
                  <td>{row.lastScore === null ? '-' : row.lastScore.toFixed(2)}</td>
                  <td>{row.driftRatio === null ? '-' : `${row.driftRatio.toFixed(2)}x`}</td>
                  <td>
                    <span className={`fleet-state fleet-state-${state}`}>{at(language, STATE_KEY[state])}</span>
                    {row.proposalsSent > 0 && <span className="summary-observed-at"> {at(language, 'proposalSent', { n: row.proposalsSent })}</span>}
                  </td>
                  <td>{row.lastTimestamp === null ? '-' : new Date(row.lastTimestamp).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {view && view.skipped > 0 && <p className="panel-subtitle">{at(language, 'skippedRows', { n: view.skipped })}</p>}
      {view && view.driftRatioLimit !== null && <p className="panel-subtitle">{at(language, 'driftLimit', { ratio: view.driftRatioLimit })}</p>}
      {view && view.maintenanceMode === 'propose' && <p className="panel-subtitle">{at(language, 'proposeNote')}</p>}
    </section>
  )
}
