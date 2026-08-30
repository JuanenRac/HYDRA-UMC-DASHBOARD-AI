// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real HTTP client for HYDRA-UMC-DATALAKE: datalakeClient.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Talks to a real, running HYDRA-UMC-DATALAKE instance's GET /query over
// plain HTTP - the same real API HYDRA-UMC-PRODUCTION-REPORTS's own
// datalake_client.py already consumes. Deliberately does not assume
// DATALAKE is reachable: every call can fail (network error, DATALAKE
// down, malformed response) and callers are expected to handle
// DatalakeApiError rather than getting an unhandled rejection.

export interface DatalakePoint {
  sourceId: string
  kind: string
  field: string
  timestamp: number
  value: number
}

export class DatalakeApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'DatalakeApiError'
  }
}

export interface QueryParams {
  sourceId?: string
  kind?: string
  field?: string
  start?: number
  end?: number
  limit?: number
}

const MAX_IDENTIFIER_LENGTH = 128
const UNSAFE_IDENTIFIER_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/

function requireSafeIdentifier(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new DatalakeApiError(`DATALAKE returned invalid ${field} in /query point ${index}`)
  }
  if (UNSAFE_IDENTIFIER_CHARACTERS.test(value)) {
    throw new DatalakeApiError(`DATALAKE returned unsafe ${field} in /query point ${index}`)
  }
  return value
}

function requireFiniteNumber(value: unknown, field: string, index: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DatalakeApiError(`DATALAKE returned invalid ${field} in /query point ${index}`)
  }
  return value
}

/** Validates data arriving from the Datalake trust boundary before a panel
 * can sort it, calculate with it, or render its identifiers. React escapes
 * text nodes, but the client still rejects malformed, overlong, or control-
 * character-bearing payloads instead of treating a remote JSON response as a
 * TypeScript value merely because it parsed. */
export function validateDatalakePoint(value: unknown, index = 0): DatalakePoint {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DatalakeApiError(`DATALAKE returned a non-object /query point at index ${index}`)
  }
  const point = value as Record<string, unknown>
  const timestamp = requireFiniteNumber(point.timestamp, 'timestamp', index)
  if (!Number.isSafeInteger(timestamp)) {
    throw new DatalakeApiError(`DATALAKE returned unsafe timestamp in /query point ${index}`)
  }

  return {
    sourceId: requireSafeIdentifier(point.sourceId, 'sourceId', index),
    kind: requireSafeIdentifier(point.kind, 'kind', index),
    field: requireSafeIdentifier(point.field, 'field', index),
    timestamp,
    value: requireFiniteNumber(point.value, 'value', index),
  }
}

function queryUrl(baseUrl: string): URL {
  let url: URL
  try {
    url = new URL('/query', baseUrl)
  } catch (err) {
    throw new DatalakeApiError('DATALAKE base URL is invalid', err)
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new DatalakeApiError('DATALAKE base URL must be HTTP(S) and must not contain credentials')
  }
  return url
}

/** Real GET /query against a real DATALAKE instance. Throws
 * DatalakeApiError on any failure (network, non-2xx, malformed JSON) -
 * never returns a silently-empty array to mask a real failure. */
export async function queryDatalake(baseUrl: string, params: QueryParams): Promise<DatalakePoint[]> {
  const url = queryUrl(baseUrl)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  let response: Response
  try {
    response = await fetch(url.toString())
  } catch (err) {
    throw new DatalakeApiError(`could not reach DATALAKE at ${baseUrl}`, err)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new DatalakeApiError(`DATALAKE returned HTTP ${response.status} for ${url.pathname}: ${body}`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (err) {
    throw new DatalakeApiError('DATALAKE returned a response that was not valid JSON', err)
  }

  if (!Array.isArray(data)) {
    throw new DatalakeApiError('DATALAKE returned a non-array /query response')
  }

  return data.map((point, index) => validateDatalakePoint(point, index))
}
