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
  /** I28: the timestamp of the real observation that produced [min] - a
   * min/max/latest number with no link back to which sample it came from
   * cannot be checked against DATALAKE's own history or investigated
   * further. Ties (an equal value repeated in the series) keep the
   * earliest occurrence, since that pass walks the series in ascending
   * timestamp order and only replaces the running extreme on a strict
   * `<`/`>` improvement. */
  minTimestamp: number
  max: number
  /** I28: see [minTimestamp] - the same real link for [max]. */
  maxTimestamp: number
  average: number
  latest: number
  /** I28: the timestamp of the observation [latest] came from - not
   * necessarily "now"; it is DATALAKE's own most recent sample in the
   * queried window. */
  latestTimestamp: number
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

  // Single ascending pass so min/max stay linked to the real observation
  // that produced them (I28), instead of Math.min/Math.max over a bare
  // value array that this module used to discard the timestamp from.
  let min = sorted[0].value
  let minTimestamp = sorted[0].timestamp
  let max = sorted[0].value
  let maxTimestamp = sorted[0].timestamp
  let sum = 0
  for (const p of sorted) {
    sum += p.value
    if (p.value < min) {
      min = p.value
      minTimestamp = p.timestamp
    }
    if (p.value > max) {
      max = p.value
      maxTimestamp = p.timestamp
    }
  }
  const average = sum / sorted.length
  const first = sorted[0].value
  const latestPoint = sorted[sorted.length - 1]
  const latest = latestPoint.value
  const latestTimestamp = latestPoint.timestamp

  const delta = latest - first
  // A tiny relative threshold (0.5% of the average magnitude, floored at
  // a small absolute epsilon) keeps floating-point noise on an otherwise
  // flat signal from reporting a misleading "up"/"down".
  const threshold = Math.max(Math.abs(average) * 0.005, 1e-9)
  const direction: TrendSummary['direction'] = delta > threshold ? 'up' : delta < -threshold ? 'down' : 'flat'

  return {
    count: sorted.length,
    min,
    minTimestamp,
    max,
    maxTimestamp,
    average,
    latest,
    latestTimestamp,
    direction,
  }
}
