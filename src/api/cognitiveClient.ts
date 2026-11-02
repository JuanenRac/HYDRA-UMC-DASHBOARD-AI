// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Client of POST /narrative of HYDRA-UMC-COGNITIVE-NODE: cognitiveClient.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The local language model of the cognitive node (Hailo-10, or its simulator) writes the sentence of the Trend Summary from the numbers
// of the summary. This module is only the AiProvider that asks for it: it sends numbers and identifiers (never free text), takes
// back a string and leaves its checking to aiProvider.ts (structure) and numberVerifier.ts (every number must be one of the summary).
// It never throws anything but AiProviderError, and safeGenerateNarrative turns any of those into the statistical sentence.

import { AiProviderError, type AiProvider, type NarrativeRequest, type NarrativeResponse } from '../lib/aiProvider'
import type { Lang } from '../lib/i18n'
import { authHeaders } from '../lib/session'
import { fetchWithTimeout, FetchTimeoutError } from './fetchWithTimeout'
import { joinServiceUrl } from './joinServiceUrl'

export const COGNITIVE_NARRATIVE_PATH = '/narrative'

function endpoint(baseUrl: string): string {
  let url: URL
  try {
    url = joinServiceUrl(baseUrl, COGNITIVE_NARRATIVE_PATH)
  } catch (err) {
    throw new AiProviderError(`the cognitive node address is invalid: ${String(err)}`)
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new AiProviderError('the cognitive node address must be HTTP(S) and must not contain credentials')
  }
  return url.toString()
}

/** The AiProvider that asks the cognitive node. `language` is the language of the sentence (one of the eight). */
export function createCognitiveProvider(baseUrl: string, language: Lang, timeoutMs = 20_000): AiProvider {
  return {
    name: 'cognitive-node',
    async generateNarrative(request: NarrativeRequest): Promise<NarrativeResponse> {
      const { summary } = request
      const body = {
        sourceId: request.sourceId,
        kind: request.kind,
        field: request.field,
        count: summary.count,
        min: summary.min,
        max: summary.max,
        average: summary.average,
        latest: summary.latest,
        direction: summary.direction,
        language,
      }
      let response: Response
      try {
        response = await fetchWithTimeout(
          endpoint(baseUrl),
          { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(baseUrl) }, body: JSON.stringify(body) },
          timeoutMs,
        )
      } catch (err) {
        if (err instanceof AiProviderError) throw err
        if (err instanceof FetchTimeoutError) throw new AiProviderError(`the cognitive node did not answer in time (${err.timeoutMs} ms)`)
        throw new AiProviderError('the cognitive node cannot be reached')
      }
      let answer: unknown
      try {
        answer = await response.json()
      } catch {
        throw new AiProviderError(`the cognitive node answered HTTP ${response.status} without JSON`)
      }
      if (!response.ok) {
        const detail = typeof answer === 'object' && answer !== null ? (answer as { error?: unknown }).error : undefined
        throw new AiProviderError(`the cognitive node answered HTTP ${response.status}${typeof detail === 'string' ? `: ${detail}` : ''}`)
      }
      const narrative = typeof answer === 'object' && answer !== null ? (answer as { narrative?: unknown }).narrative : undefined
      if (typeof narrative !== 'string') throw new AiProviderError('the cognitive node answered without a narrative')
      // the label is decided by aiProvider.ts from the path taken, not from this claim
      return { narrative, generatedBy: 'ai' }
    },
  }
}
