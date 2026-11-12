// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - A short-term forecast with its range: forecast.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The least-squares line of the series, continued a short way ahead, with the range of a 95 % prediction interval. It is arithmetic over the points of
// DATALAKE, not a model of the machine: it refuses to look further ahead than the window it was given, and a series that is too short or has no spread
// in time gives no forecast instead of a number that looks sure.

import type { DatalakePoint } from '../api/datalakeClient'

/** Fewer points than this and the interval of a line fit is not worth showing. */
export const MIN_FORECAST_POINTS = 5
const MINUTE_MS = 60_000
/** The two-sided 95 % point of the normal distribution; the range is widened by the small-sample factor below because the real point is a little larger for few samples. */
const Z_95 = 1.96

export interface Forecast {
  /** How far ahead of the newest point the value is, in milliseconds. */
  horizonMs: number
  value: number
  low: number
  high: number
  /** The slope of the line, in units of the series per minute. */
  slopePerMinute: number
  /** The number of points the line was fitted to. */
  basedOn: number
}

/** The forecast [horizonMs] after the newest point, or null when there is not enough to say (see the module comment). */
export function forecast(points: DatalakePoint[], horizonMs: number): Forecast | null {
  if (!Number.isFinite(horizonMs) || horizonMs <= 0) return null
  const sorted = points.filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value)).sort((a, b) => a.timestamp - b.timestamp)
  const n = sorted.length
  if (n < MIN_FORECAST_POINTS) return null
  const t0 = sorted[0].timestamp
  const span = sorted[n - 1].timestamp - t0
  // never further ahead than the data reaches back: beyond that the line is a guess
  if (span <= 0 || horizonMs > span) return null

  const xs = sorted.map((p) => (p.timestamp - t0) / MINUTE_MS)
  const ys = sorted.map((p) => p.value)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i += 1) {
    sxx += (xs[i] - meanX) ** 2
    sxy += (xs[i] - meanX) * (ys[i] - meanY)
  }
  if (sxx <= 0) return null
  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  let residuals = 0
  for (let i = 0; i < n; i += 1) residuals += (ys[i] - (intercept + slope * xs[i])) ** 2
  const standardError = Math.sqrt(residuals / (n - 2))

  const x = xs[n - 1] + horizonMs / MINUTE_MS
  const value = intercept + slope * x
  const widen = Math.sqrt(n / (n - 2))
  const half = Z_95 * widen * standardError * Math.sqrt(1 + 1 / n + (x - meanX) ** 2 / sxx)
  if (![value, half, slope].every(Number.isFinite)) return null
  return { horizonMs, value, low: value - half, high: value + half, slopePerMinute: slope, basedOn: n }
}
