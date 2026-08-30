// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/aiProvider.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================

import { describe, expect, it } from 'vitest'
import {
  AiProviderError,
  NO_PROVIDER_CONFIGURED,
  safeGenerateNarrative,
  validateNarrativeRequest,
  validateNarrativeResponse,
  type AiProvider,
  type NarrativeRequest,
} from '../src/lib/aiProvider'
import type { TrendSummary } from '../src/lib/summary'

function summary(overrides: Partial<TrendSummary> = {}): TrendSummary {
  return { count: 5, min: 10, max: 30, average: 20, latest: 28, direction: 'up', ...overrides }
}

function request(overrides: Partial<NarrativeRequest> = {}): NarrativeRequest {
  return { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', summary: summary(), ...overrides }
}

describe('validateNarrativeRequest', () => {
  it('accepts a well-formed request', () => {
    expect(() => validateNarrativeRequest(request())).not.toThrow()
  })

  it.each(['sourceId', 'kind', 'field'] as const)('rejects an empty "%s"', (field) => {
    expect(() => validateNarrativeRequest(request({ [field]: '' } as Partial<NarrativeRequest>))).toThrow(
      AiProviderError,
    )
  })

  it('rejects a missing summary object', () => {
    const bad = { sourceId: 'a', kind: 'b', field: 'c' }
    expect(() => validateNarrativeRequest(bad)).toThrow(AiProviderError)
  })

  it('rejects a summary with a non-finite number field', () => {
    const bad = request({ summary: summary({ average: NaN }) })
    expect(() => validateNarrativeRequest(bad)).toThrow(AiProviderError)
  })

  it('rejects a summary with an invalid direction', () => {
    const bad = { ...request(), summary: { ...summary(), direction: 'sideways' } }
    expect(() => validateNarrativeRequest(bad)).toThrow(AiProviderError)
  })

  it('rejects a non-object value entirely', () => {
    expect(() => validateNarrativeRequest('not an object')).toThrow(AiProviderError)
    expect(() => validateNarrativeRequest(null)).toThrow(AiProviderError)
  })
})

describe('validateNarrativeResponse', () => {
  it('accepts a well-formed response', () => {
    const result = validateNarrativeResponse({ narrative: 'Values are rising.', generatedBy: 'ai' })
    expect(result.narrative).toBe('Values are rising.')
    expect(result.generatedBy).toBe('ai')
  })

  it('rejects a missing narrative field - the real "unstructured output" case', () => {
    expect(() => validateNarrativeResponse({ generatedBy: 'ai' })).toThrow(AiProviderError)
  })

  it('rejects an empty-string narrative', () => {
    expect(() => validateNarrativeResponse({ narrative: '   ', generatedBy: 'ai' })).toThrow(AiProviderError)
  })

  it('rejects a non-string narrative (e.g. a raw object a provider mistakenly returned)', () => {
    expect(() => validateNarrativeResponse({ narrative: { text: 'oops' }, generatedBy: 'ai' })).toThrow(
      AiProviderError,
    )
  })

  it('rejects an absurdly long narrative', () => {
    const huge = 'x'.repeat(5000)
    expect(() => validateNarrativeResponse({ narrative: huge, generatedBy: 'ai' })).toThrow(AiProviderError)
  })

  it('rejects control and bidirectional-format characters in a provider narrative', () => {
    expect(() => validateNarrativeResponse({ narrative: 'safe\u0000hidden', generatedBy: 'ai' })).toThrow(AiProviderError)
    expect(() => validateNarrativeResponse({ narrative: 'safe\u202Ehidden', generatedBy: 'ai' })).toThrow(AiProviderError)
  })

  it('trims accepted provider narratives before rendering them', () => {
    expect(validateNarrativeResponse({ narrative: '  Values are rising.  ', generatedBy: 'ai' }).narrative).toBe(
      'Values are rising.',
    )
  })

  it('rejects an unknown generatedBy value', () => {
    expect(() => validateNarrativeResponse({ narrative: 'ok', generatedBy: 'made-up' })).toThrow(AiProviderError)
  })

  it('rejects a bare string or array instead of a real response object', () => {
    expect(() => validateNarrativeResponse('just a string')).toThrow(AiProviderError)
    expect(() => validateNarrativeResponse(['narrative text'])).toThrow(AiProviderError)
  })
})

describe('NO_PROVIDER_CONFIGURED (the real fallback)', () => {
  it('builds a real narrative from the real summary, labeled honestly', async () => {
    const result = await NO_PROVIDER_CONFIGURED.generateNarrative(request())
    expect(result.generatedBy).toBe('statistical-fallback')
    expect(result.narrative).toContain('robot-1/motor_temp/value')
    expect(result.narrative).toContain('5 sample(s)')
    expect(result.narrative).toContain('rising')
  })

  it('produces a response that itself passes real response validation', async () => {
    const result = await NO_PROVIDER_CONFIGURED.generateNarrative(request())
    expect(() => validateNarrativeResponse(result)).not.toThrow()
  })
})

describe('safeGenerateNarrative', () => {
  it('returns the real fallback when no provider is configured', async () => {
    const result = await safeGenerateNarrative(NO_PROVIDER_CONFIGURED, request())
    expect(result.generatedBy).toBe('statistical-fallback')
  })

  it('returns a real working provider\'s own AI-generated narrative', async () => {
    const workingProvider: AiProvider = {
      name: 'fake-llm',
      async generateNarrative() {
        return { narrative: 'A real AI-generated narrative.', generatedBy: 'ai' }
      },
    }
    const result = await safeGenerateNarrative(workingProvider, request())
    expect(result.generatedBy).toBe('ai')
    expect(result.narrative).toBe('A real AI-generated narrative.')
  })

  it('falls back to the statistical narrative when a provider throws (e.g. a real network error)', async () => {
    const brokenProvider: AiProvider = {
      name: 'broken-llm',
      async generateNarrative() {
        throw new Error('real network timeout')
      },
    }
    const result = await safeGenerateNarrative(brokenProvider, request())
    expect(result.generatedBy).toBe('statistical-fallback')
  })

  it('falls back to the statistical narrative when a provider returns unstructured output', async () => {
    // The real failure mode this whole gate exists for: a provider that
    // "succeeds" but hands back something that doesn't match the real
    // response schema (here: no narrative field at all).
    const unstructuredProvider = {
      name: 'misbehaving-llm',
      async generateNarrative() {
        return { text: 'wrong field name entirely' }
      },
    } as unknown as AiProvider
    const result = await safeGenerateNarrative(unstructuredProvider, request())
    expect(result.generatedBy).toBe('statistical-fallback')
    expect(result.narrative).toContain('robot-1/motor_temp/value')
  })

  it('falls back when a provider returns a non-object (e.g. a raw string)', async () => {
    const stringProvider = {
      name: 'string-only-llm',
      async generateNarrative() {
        return 'just a raw string, not a real response object'
      },
    } as unknown as AiProvider
    const result = await safeGenerateNarrative(stringProvider, request())
    expect(result.generatedBy).toBe('statistical-fallback')
  })

  it('throws on a genuinely malformed request instead of silently guessing', async () => {
    const bad = { sourceId: '', kind: 'motor_temp', field: 'value', summary: summary() }
    await expect(safeGenerateNarrative(NO_PROVIDER_CONFIGURED, bad)).rejects.toThrow(AiProviderError)
  })
})
