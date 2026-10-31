// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Client of POST /rul of HYDRA-UMC-ANOMALY-DETECTOR: rulClient.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Asks the detector for the days until the trend of a list of scores reaches a limit. Read-only: the route changes nothing.
// It answers 404 while the detector runs without --rul; that, a timeout, an unreachable detector and a refused session are
// told apart (kind) so the card can say which one it is without breaking the page.

import { fetchWithTimeout, FetchTimeoutError } from './fetchWithTimeout'
import { joinServiceUrl } from './joinServiceUrl'
import { authHeaders } from '../lib/session'

export type RulStatus = 'insufficient_data' | 'not_rising' | 'limit_reached' | 'estimated'
export type RulErrorKind = 'timeout' | 'unreachable' | 'disabled' | 'auth' | 'http' | 'invalid' | 'input'

export class RulApiError extends Error {
  readonly kind: RulErrorKind
  readonly status?: number
  constructor(kind: RulErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
    this.name = 'RulApiError'
  }
}

export interface RulPoint {
  /** Seconds. */
  t: number
  score: number
}

export interface RulEstimate {
  status: RulStatus
  points: number
  slopePerDay: number | null
  currentValue: number | null
  daysToLimit: number | null
  daysLow: number | null
  daysHigh: number | null
}

const STATUSES: readonly string[] = ['insufficient_data', 'not_rising', 'limit_reached', 'estimated']
export const MAX_RUL_REQUEST_POINTS = 1000

function nullableNumber(body: Record<string, unknown>, field: string): number | null {
  const value = body[field]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RulApiError('invalid', `POST /rul: field "${field}" must be a finite number or null`)
  }
  return value
}

export function validateRulEstimate(value: unknown): RulEstimate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RulApiError('invalid', 'POST /rul: response must be a JSON object')
  }
  const body = value as Record<string, unknown>
  if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) {
    throw new RulApiError('invalid', 'POST /rul: field "status" is not a known state')
  }
  const points = body.points
  if (typeof points !== 'number' || !Number.isInteger(points) || points < 0) {
    throw new RulApiError('invalid', 'POST /rul: field "points" must be a whole number')
  }
  return {
    status: body.status as RulStatus,
    points,
    slopePerDay: nullableNumber(body, 'slopePerDay'),
    currentValue: nullableNumber(body, 'currentValue'),
    daysToLimit: nullableNumber(body, 'daysToLimit'),
    daysLow: nullableNumber(body, 'daysLow'),
    daysHigh: nullableNumber(body, 'daysHigh'),
  }
}

/** Real POST /rul. Never throws anything but RulApiError. */
export async function fetchRul(baseUrl: string, points: readonly RulPoint[], limit: number, timeoutMs = 5000): Promise<RulEstimate> {
  if (points.length > MAX_RUL_REQUEST_POINTS) {
    throw new RulApiError('input', `at most ${MAX_RUL_REQUEST_POINTS} points can be sent`)
  }
  if (!Number.isFinite(limit)) throw new RulApiError('input', 'the limit must be a finite number')
  let url: URL
  try {
    url = joinServiceUrl(baseUrl, '/rul')
  } catch {
    throw new RulApiError('input', 'the detector base URL is invalid')
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new RulApiError('input', 'the detector base URL must be HTTP(S) and must not contain credentials')
  }
  let response: Response
  try {
    response = await fetchWithTimeout(
      url.toString(),
      { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(baseUrl) }, body: JSON.stringify({ points, limit }) },
      timeoutMs,
    )
  } catch (err) {
    if (err instanceof FetchTimeoutError) throw new RulApiError('timeout', err.message)
    throw new RulApiError('unreachable', 'could not reach the detector')
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.status === 404) throw new RulApiError('disabled', 'the detector has the RUL route off', 404)
    throw new RulApiError(response.ok ? 'invalid' : 'http', 'POST /rul: response was not valid JSON', response.status)
  }
  if (!response.ok) {
    if (response.status === 404) throw new RulApiError('disabled', 'the detector has the RUL route off', 404)
    if (response.status === 401 || response.status === 403) throw new RulApiError('auth', 'the detector refused the session', response.status)
    const message = (body as { error?: unknown } | null)?.error
    throw new RulApiError('http', typeof message === 'string' ? message : `HTTP ${response.status}`, response.status)
  }
  return validateRulEstimate(body)
}
