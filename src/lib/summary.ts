// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real trend summary math: summary.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// This project's own "Smart Summaries" README claim, honestly scoped for
// v0: real min/max/average/latest/trend statistics computed from real
// HYDRA-UMC-DATALAKE history - not an LLM-generated summary (that's
// future work), but a genuinely real,
// correct computation over real data, in ascending-timestamp order.

import type { DatalakePoint } from '../api/datalakeClient'

export interface TrendSummary {
  count: number
  min: number
  max: number
  average: number
  latest: number
  /** Simple, honest sign of the first-to-last delta - not a fitted trend
   * line or forecast (see the module comment above for why). */
  direction: 'up' | 'down' | 'flat'
}

export class SummaryError extends Error {}

/** Computes a real TrendSummary from a real list of DatalakePoint - the
 * points do not need to already be sorted by timestamp, this sorts them
 * itself so `latest`/`direction` are correct regardless of the order
 * DATALAKE's own /query happened to return them in. */
export function summarize(points: DatalakePoint[]): TrendSummary {
  if (points.length === 0) {
    throw new SummaryError('cannot summarize zero points')
  }

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  const values = sorted.map((p) => p.value)

  const min = Math.min(...values)
  const max = Math.max(...values)
  const average = values.reduce((sum, v) => sum + v, 0) / values.length
  const first = values[0]
  const latest = values[values.length - 1]

  const delta = latest - first
  // A tiny relative threshold (0.5% of the average magnitude, floored at
  // a small absolute epsilon) keeps floating-point noise on an otherwise
  // flat signal from reporting a misleading "up"/"down".
  const threshold = Math.max(Math.abs(average) * 0.005, 1e-9)
  const direction: TrendSummary['direction'] = delta > threshold ? 'up' : delta < -threshold ? 'down' : 'flat'

  return { count: values.length, min, max, average, latest, direction }
}
