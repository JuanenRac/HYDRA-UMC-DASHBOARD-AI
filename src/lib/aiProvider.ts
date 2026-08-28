// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real AI-provider gate: aiProvider.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// The real "Smart Summaries" LLM narrative (mejoras_futuras.txt's own
// [PENDIENTE]) is future work - no real AI provider is wired in yet, and
// this module does not invent one. What IS real: the honest v0 contract
// an eventual provider has to satisfy - real input-schema validation,
// real structural validation of whatever a provider returns (catching
// exactly the "unstructured output" failure mode a real LLM API can
// produce), and a real, tested fallback for when no provider is
// configured (or one fails) that never leaves a caller with a broken or
// empty panel: the same real statistics already computed by summary.ts,
// honestly labeled as a statistical fallback rather than passed off as
// an AI-generated narrative.

import type { TrendSummary } from './summary'

export interface NarrativeRequest {
  sourceId: string
  kind: string
  field: string
  summary: TrendSummary
}

export interface NarrativeResponse {
  narrative: string
  generatedBy: 'ai' | 'statistical-fallback'
}

export class AiProviderError extends Error {}

export interface AiProvider {
  readonly name: string
  generateNarrative(request: NarrativeRequest): Promise<NarrativeResponse>
}

const MAX_NARRATIVE_LENGTH = 2000
const DIRECTIONS: ReadonlyArray<TrendSummary['direction']> = ['up', 'down', 'flat']

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Real schema validation of what would be sent TO a provider - catches
 * a wiring bug (a missing/empty identifier, a summary object built
 * wrong) before it ever reaches a real network call. */
export function validateNarrativeRequest(value: unknown): NarrativeRequest {
  if (typeof value !== 'object' || value === null) {
    throw new AiProviderError('narrative request must be an object')
  }
  const v = value as Record<string, unknown>

  for (const field of ['sourceId', 'kind', 'field'] as const) {
    if (typeof v[field] !== 'string' || (v[field] as string).length === 0) {
      throw new AiProviderError(`narrative request field "${field}" must be a non-empty string`)
    }
  }

  if (typeof v.summary !== 'object' || v.summary === null) {
    throw new AiProviderError('narrative request field "summary" must be an object')
  }
  const s = v.summary as Record<string, unknown>
  for (const field of ['count', 'min', 'max', 'average', 'latest'] as const) {
    if (!isFiniteNumber(s[field])) {
      throw new AiProviderError(`narrative request summary field "${field}" must be a finite number`)
    }
  }
  if (!DIRECTIONS.includes(s.direction as TrendSummary['direction'])) {
    throw new AiProviderError('narrative request summary field "direction" must be "up", "down", or "flat"')
  }

  return value as NarrativeRequest
}

/** Real structural validation of a provider's response - the exact
 * "unstructured output" failure mode this gate exists to catch: a
 * missing/empty narrative, a non-string narrative, an absurdly long
 * one, or a `generatedBy` tag that isn't one of the two real, honest
 * values this project ever actually produces. */
export function validateNarrativeResponse(value: unknown): NarrativeResponse {
  if (typeof value !== 'object' || value === null) {
    throw new AiProviderError('provider response must be an object')
  }
  const v = value as Record<string, unknown>

  if (typeof v.narrative !== 'string' || v.narrative.trim().length === 0) {
    throw new AiProviderError('provider response field "narrative" must be a non-empty string')
  }
  if (v.narrative.length > MAX_NARRATIVE_LENGTH) {
    throw new AiProviderError(`provider response field "narrative" exceeds ${MAX_NARRATIVE_LENGTH} characters`)
  }
  if (v.generatedBy !== 'ai' && v.generatedBy !== 'statistical-fallback') {
    throw new AiProviderError('provider response field "generatedBy" must be "ai" or "statistical-fallback"')
  }

  return { narrative: v.narrative, generatedBy: v.generatedBy }
}

function directionWord(direction: TrendSummary['direction']): string {
  return direction === 'up' ? 'rising' : direction === 'down' ? 'falling' : 'flat'
}

/** The real default provider for v0: no real AI backend configured, so
 * this builds its narrative directly from the already-real statistics
 * in `summary.ts` and labels it honestly - never pretends to be an
 * AI-generated summary it isn't. */
export const NO_PROVIDER_CONFIGURED: AiProvider = {
  name: 'statistical-fallback',
  async generateNarrative(request: NarrativeRequest): Promise<NarrativeResponse> {
    const { summary } = request
    const narrative =
      `${request.sourceId}/${request.kind}/${request.field}: ${summary.count} sample(s), ` +
      `ranging ${summary.min.toFixed(2)} to ${summary.max.toFixed(2)}, averaging ${summary.average.toFixed(2)}, ` +
      `latest ${summary.latest.toFixed(2)} (${directionWord(summary.direction)}).`
    return { narrative, generatedBy: 'statistical-fallback' }
  },
}

/** The real safe entry point every caller should use instead of a
 * provider directly: validates `request` (a genuine wiring bug here is
 * allowed to throw - there's no summary to honestly fall back to if the
 * request itself is broken), then calls `provider` and validates its
 * response is well-structured. ANY real failure past that point - a
 * thrown network/API error, or a provider returning malformed/
 * unstructured output - degrades to the same real statistical fallback
 * rather than ever showing a broken or empty panel. */
export async function safeGenerateNarrative(
  provider: AiProvider,
  request: NarrativeRequest,
): Promise<NarrativeResponse> {
  validateNarrativeRequest(request)

  try {
    const raw = await provider.generateNarrative(request)
    return validateNarrativeResponse(raw)
  } catch {
    return NO_PROVIDER_CONFIGURED.generateNarrative(request)
  }
}
