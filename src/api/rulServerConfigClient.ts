// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Client of GET /api/rul/config of HYDRA-UMC-SERVER: rulServerConfigClient.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The server holds the switch of the remaining-useful-life relay (rul.enabled) and its limits. This reads them, read only, with the
// session of the person who signed in to STUDIO, so the card appears only when the server has the option open. It is fail-closed:
// a server that does not answer, has no such route, refuses the session or answers anything but a clear { enabled, maxPoints,
// timeoutMs } counts as closed, and the function never throws.

import { fetchWithTimeout, FetchTimeoutError } from './fetchWithTimeout'
import { authHeaders, isSameOriginPath } from '../lib/session'
import type { RulConfig } from '../lib/rulConfig'

export const RUL_SERVER_CONFIG_PATH = '/api/rul/config'

export interface RulServerConfig {
  enabled: boolean
  maxPoints: number
  timeoutMs: number
}

/** What the server answers when it has no usable configuration: the same closed default the server uses. */
export const RUL_SERVER_CLOSED: Readonly<RulServerConfig> = Object.freeze({ enabled: false, maxPoints: 5000, timeoutMs: 8000 })

export type RulServerClosedReason = 'disabled' | 'no_route' | 'auth' | 'error' | 'invalid' | 'timeout' | 'input'

export type RulServerOutcome =
  | { state: 'open'; config: RulServerConfig }
  | { state: 'closed'; reason: RulServerClosedReason }

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/** The three fields of the answer, or null when it is not exactly a clear answer (other fields are dropped). */
export function validateRulServerConfig(value: unknown): RulServerConfig | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (typeof body.enabled !== 'boolean') return null
  if (!inRange(body.maxPoints, 8, 100000) || !inRange(body.timeoutMs, 500, 60000)) return null
  return { enabled: body.enabled, maxPoints: body.maxPoints, timeoutMs: body.timeoutMs }
}

/** Asks the server of this page's own origin. Only a path of that origin is asked (the session never goes anywhere else). */
export async function fetchRulServerConfig(url: string = RUL_SERVER_CONFIG_PATH, timeoutMs = 4000): Promise<RulServerOutcome> {
  if (!isSameOriginPath(url)) return { state: 'closed', reason: 'input' }
  let response: Response
  try {
    response = await fetchWithTimeout(url, { method: 'GET', headers: { Accept: 'application/json', ...authHeaders(url) }, cache: 'no-store' }, timeoutMs)
  } catch (err) {
    return { state: 'closed', reason: err instanceof FetchTimeoutError ? 'timeout' : 'error' }
  }
  if (response.status === 404) return { state: 'closed', reason: 'no_route' }
  if (response.status === 401 || response.status === 403) return { state: 'closed', reason: 'auth' }
  if (!response.ok) return { state: 'closed', reason: 'error' }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { state: 'closed', reason: 'invalid' }
  }
  const config = validateRulServerConfig(body)
  if (config === null) return { state: 'closed', reason: 'invalid' }
  return config.enabled ? { state: 'open', config } : { state: 'closed', reason: 'disabled' }
}

/** The configuration of the build with the limits of the server: never more points than it accepts, never less time than it waits. */
export function applyServerLimits(build: RulConfig, server: RulServerConfig): RulConfig {
  return {
    ...build,
    points: Math.max(1, Math.min(build.points, server.maxPoints)),
    timeoutMs: Math.max(build.timeoutMs, server.timeoutMs),
  }
}
