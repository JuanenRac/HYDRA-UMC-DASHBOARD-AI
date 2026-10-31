// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Configuration of the remaining-useful-life card: rulConfig.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The card is OFF unless the build says VITE_RUL_ENABLED=true (exactly that): with it off the page shows no card and never
// asks the detector for an estimate. Every other value is optional and falls back to the default below when it is missing
// or unusable. Vite inlines these at build time.

export interface RulConfig {
  enabled: boolean
  /** Base URL of the detector that answers POST /rul (the anomaly detector of the page unless VITE_RUL_URL says otherwise). */
  detectorUrl: string
  sourceId: string
  kind: string
  field: string
  /** The score at which the part counts as worn out. */
  limit: number
  /** How many of the newest score samples are sent (1..1000). */
  points: number
  /** Warn when the earliest plausible day is within this many days. */
  warnDays: number
  /** Critical when it is within this many days. */
  criticalDays: number
  timeoutMs: number
}

export type RulEnv = Readonly<Record<string, string | undefined>>

export const RUL_DEFAULTS = {
  sourceId: 'robot-1',
  kind: 'anomaly_score',
  field: 'value',
  limit: 1,
  points: 200,
  warnDays: 30,
  criticalDays: 7,
  timeoutMs: 5000,
} as const

export const MAX_RUL_POINTS = 1000

function positive(raw: string | undefined, fallback: number, max = Number.POSITIVE_INFINITY): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 && value <= max ? value : fallback
}

function text(raw: string | undefined, fallback: string): string {
  const value = (raw ?? '').trim()
  return value === '' ? fallback : value
}

/** Reads the card configuration from build-time variables. `anomalyUrl` is the detector the page already uses. */
export function readRulConfig(env: RulEnv, anomalyUrl: string): RulConfig {
  const warnDays = positive(env.VITE_RUL_WARN_DAYS, RUL_DEFAULTS.warnDays)
  const criticalRaw = positive(env.VITE_RUL_CRITICAL_DAYS, RUL_DEFAULTS.criticalDays)
  return {
    enabled: env.VITE_RUL_ENABLED === 'true',
    detectorUrl: text(env.VITE_RUL_URL, anomalyUrl),
    sourceId: text(env.VITE_RUL_SOURCE_ID, RUL_DEFAULTS.sourceId),
    kind: text(env.VITE_RUL_KIND, RUL_DEFAULTS.kind),
    field: text(env.VITE_RUL_FIELD, RUL_DEFAULTS.field),
    limit: positive(env.VITE_RUL_LIMIT, RUL_DEFAULTS.limit),
    points: Math.floor(positive(env.VITE_RUL_POINTS, RUL_DEFAULTS.points, MAX_RUL_POINTS)),
    warnDays,
    // the critical threshold never exceeds the warning one, so the order of the two levels holds
    criticalDays: Math.min(criticalRaw, warnDays),
    timeoutMs: Math.floor(positive(env.VITE_RUL_TIMEOUT_MS, RUL_DEFAULTS.timeoutMs, 60_000)),
  }
}
