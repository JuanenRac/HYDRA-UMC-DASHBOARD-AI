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

/** Real GET /query against a real DATALAKE instance. Throws
 * DatalakeApiError on any failure (network, non-2xx, malformed JSON) -
 * never returns a silently-empty array to mask a real failure. */
export async function queryDatalake(baseUrl: string, params: QueryParams): Promise<DatalakePoint[]> {
  const url = new URL('/query', baseUrl)
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

  return data as DatalakePoint[]
}
