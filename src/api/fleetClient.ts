// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Client of GET /fleet of HYDRA-UMC-ANOMALY-DETECTOR: fleetClient.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Reads, only reads, the last anomaly score and the drift of every series the detector follows. The answer is validated field by field;
// a row that is not what the detector documents is left out and counted, never shown half. The function never throws: every failure is
// an outcome the card turns into a sentence in the language of the reader.

import { authHeaders } from '../lib/session'
import { fetchWithTimeout, FetchTimeoutError } from './fetchWithTimeout'
import { joinServiceUrl } from './joinServiceUrl'

export interface FleetRow {
  sourceId: string
  kind: string
  field: string
  windowsScored: number
  lastScore: number | null
  lastTimestamp: number | null
  anomalous: boolean | null
  threshold: number | null
  driftRatio: number | null
  drifted: boolean
  driftSustained: boolean
  driftSince: number | null
  proposalsSent: number
}

export interface FleetView {
  rows: FleetRow[]
  /** Rows the answer carried that could not be read. */
  skipped: number
  driftRatioLimit: number | null
  maintenanceMode: 'off' | 'propose' | null
}

export type FleetOutcome =
  | { state: 'ok'; view: FleetView }
  | { state: 'failed'; reason: 'off' | 'auth' | 'timeout' | 'unreachable' | 'http' | 'invalid'; status?: number }

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function row(value: unknown): FleetRow | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  if (typeof r.sourceId !== 'string' || typeof r.kind !== 'string' || typeof r.field !== 'string') return null
  const windows = finiteOrNull(r.windowsScored)
  if (windows === null || windows < 0) return null
  if (r.anomalous !== null && r.anomalous !== undefined && typeof r.anomalous !== 'boolean') return null
  return {
    sourceId: r.sourceId,
    kind: r.kind,
    field: r.field,
    windowsScored: windows,
    lastScore: finiteOrNull(r.lastScore),
    lastTimestamp: finiteOrNull(r.lastTimestamp),
    anomalous: typeof r.anomalous === 'boolean' ? r.anomalous : null,
    threshold: finiteOrNull(r.threshold),
    driftRatio: finiteOrNull(r.driftRatio),
    drifted: r.drifted === true,
    driftSustained: r.driftSustained === true,
    driftSince: finiteOrNull(r.driftSince),
    proposalsSent: Math.max(0, finiteOrNull(r.proposalsSent) ?? 0),
  }
}

export function validateFleetView(value: unknown): FleetView | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (!Array.isArray(body.series)) return null
  const rows: FleetRow[] = []
  let skipped = 0
  for (const item of body.series) {
    const parsed = row(item)
    if (parsed) rows.push(parsed)
    else skipped += 1
  }
  const mode = body.maintenanceMode
  return {
    rows,
    skipped,
    driftRatioLimit: finiteOrNull(body.driftRatioLimit),
    maintenanceMode: mode === 'off' || mode === 'propose' ? mode : null,
  }
}

/** Real GET /fleet. 404 means the detector has the fleet view switched off. */
export async function fetchFleet(baseUrl: string, timeoutMs = 5000): Promise<FleetOutcome> {
  let url: string
  try {
    const target = joinServiceUrl(baseUrl, '/fleet')
    if ((target.protocol !== 'http:' && target.protocol !== 'https:') || target.username || target.password) return { state: 'failed', reason: 'invalid' }
    url = target.toString()
  } catch {
    return { state: 'failed', reason: 'invalid' }
  }
  let response: Response
  try {
    response = await fetchWithTimeout(url, { headers: authHeaders(baseUrl) }, timeoutMs)
  } catch (err) {
    return { state: 'failed', reason: err instanceof FetchTimeoutError ? 'timeout' : 'unreachable' }
  }
  if (response.status === 404) return { state: 'failed', reason: 'off', status: 404 }
  if (response.status === 401 || response.status === 403) return { state: 'failed', reason: 'auth', status: response.status }
  if (!response.ok) return { state: 'failed', reason: 'http', status: response.status }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { state: 'failed', reason: 'invalid' }
  }
  const view = validateFleetView(body)
  return view ? { state: 'ok', view } : { state: 'failed', reason: 'invalid' }
}
