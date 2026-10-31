// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Reading of a remaining-useful-life estimate: rul.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================

import type { DatalakePoint } from '../api/datalakeClient'
import type { RulEstimate, RulPoint } from '../api/rulClient'

export type RulLevel = 'none' | 'ok' | 'warning' | 'critical'

/** Score samples of the data lake (milliseconds) as the points of the detector (seconds), oldest first, newest `max` kept. */
export function toRulPoints(samples: readonly DatalakePoint[], max: number): RulPoint[] {
  return [...samples]
    .filter((s) => Number.isFinite(s.timestamp) && Number.isFinite(s.value))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-Math.max(0, max))
    .map((s) => ({ t: s.timestamp / 1000, score: s.value }))
}

/**
 * How urgent the estimate is. The earliest plausible day (the steepest trend of the range) decides, so a warning is never
 * hidden by a lucky median. A state without a rising trend raises nothing.
 */
export function rulLevel(estimate: RulEstimate, warnDays: number, criticalDays: number): RulLevel {
  if (estimate.status === 'limit_reached') return 'critical'
  if (estimate.status === 'insufficient_data') return 'none'
  const earliest = estimate.daysLow ?? estimate.daysToLimit
  if (earliest === null) return estimate.status === 'not_rising' ? 'ok' : 'none'
  if (earliest <= criticalDays) return 'critical'
  if (earliest <= warnDays) return 'warning'
  return 'ok'
}

export function formatDays(days: number): string {
  return days < 10 ? days.toFixed(1) : String(Math.round(days))
}
