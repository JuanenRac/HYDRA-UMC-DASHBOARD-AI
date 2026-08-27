// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real HTTP client for HYDRA-UMC-ANOMALY-DETECTOR: anomalyClient.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Talks to a real, running HYDRA-UMC-ANOMALY-DETECTOR instance. That
// service is a stateless scorer over ONE shared, in-memory-fitted
// baseline (see its own src/hydra_umc_anomaly_detector/api.py) - fitting
// that baseline is a deliberately separate operational concern this
// dashboard does not manage (mutating shared detector state from a
// read-oriented dashboard would be a real coupling smell). What this
// client offers is real, honest, read-only use of what's already fitted:
// check /stats, and score a window if it is.

export class AnomalyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AnomalyApiError'
  }
}

export interface DetectorStats {
  fitted: boolean
}

export interface DetectVerdict {
  score: number
  anomalous: boolean
  worstBinFreqHz: number
}

async function readJsonOrThrow(response: Response, context: string): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch (err) {
    throw new AnomalyApiError(`${context}: response was not valid JSON`, response.status, err)
  }
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`
    throw new AnomalyApiError(`${context}: ${message}`, response.status)
  }
  return body
}

/** Real GET /stats - reports whether the shared detector has a baseline
 * fitted at all. A dashboard panel should check this BEFORE offering to
 * score a window, so "not fitted yet" reads as real operational state,
 * not a generic error. */
export async function fetchDetectorStats(baseUrl: string): Promise<DetectorStats> {
  let response: Response
  try {
    response = await fetch(new URL('/stats', baseUrl).toString())
  } catch (err) {
    throw new AnomalyApiError(`could not reach HYDRA-UMC-ANOMALY-DETECTOR at ${baseUrl}`, undefined, err)
  }
  return (await readJsonOrThrow(response, 'GET /stats')) as DetectorStats
}

/** Real POST /detect against a single real window of numeric samples.
 * Surfaces the real 409 ("detector not fitted yet") the API itself
 * returns as a distinguishable AnomalyApiError.status, so a caller can
 * show that specific real state instead of a generic failure message. */
export async function detectAnomaly(baseUrl: string, window: number[]): Promise<DetectVerdict> {
  if (window.length === 0) {
    throw new AnomalyApiError('cannot score an empty window')
  }

  let response: Response
  try {
    response = await fetch(new URL('/detect', baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ window }),
    })
  } catch (err) {
    throw new AnomalyApiError(`could not reach HYDRA-UMC-ANOMALY-DETECTOR at ${baseUrl}`, undefined, err)
  }

  return (await readJsonOrThrow(response, 'POST /detect')) as DetectVerdict
}
