// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/numberVerifier.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// A narrative of a language model is shown only when every number in it is a figure of the summary (to the decimals it is written
// with); the identifiers of the series are not numbers; digits of other writing systems are refused; the gate falls back to the
// statistical sentence with the reason.

import { describe, expect, it, vi } from 'vitest'
import { safeGenerateNarrative, type AiProvider, type NarrativeRequest } from '../src/lib/aiProvider'
import { verifyNarrativeNumbers } from '../src/lib/numberVerifier'

const request: NarrativeRequest = {
  sourceId: 'motor-1',
  kind: 'vibration',
  field: 'rms',
  summary: {
    count: 120, min: 0.5, max: 3.25, average: 1.8, latest: 2.75, direction: 'up',
    minTimestamp: 1, maxTimestamp: 2, latestTimestamp: 3,
  },
}

const ok = (text: string) => verifyNarrativeNumbers(text, request)

describe('verifyNarrativeNumbers', () => {
  it('accepts the figures of the summary, exact or rounded to the decimals they are written with', () => {
    expect(ok('motor-1/vibration/rms: 120 samples between 0.50 and 3.25, average 1.80, latest 2.75.').ok).toBe(true)
    expect(ok('Latest 2.8, average 1.8, 120 samples.').ok).toBe(true)
    expect(ok('Latest 3, 120 samples.').ok).toBe(true)
  })

  it('accepts a text with no number at all', () => {
    expect(ok('Nothing to report.').ok).toBe(true)
  })

  it('refuses a number that is not in the summary', () => {
    const result = ok('120 samples, latest 3.10.')
    expect(result.ok).toBe(false)
    expect(result.unmatched).toEqual(['3.10'])
  })

  it('does not take the digits of the identifiers for numbers', () => {
    expect(ok('motor-1 vibration rms: latest 2.75').ok).toBe(true)
    expect(ok('Series motor-1/vibration/rms.').ok).toBe(true)
  })

  it('reads a decimal comma and a thousands separator', () => {
    expect(ok('Mittelwert 1,80 und letzter Wert 2,75.').ok).toBe(true)
    const big: NarrativeRequest = { ...request, summary: { ...request.summary, max: 1234.5, count: 1500 } }
    expect(verifyNarrativeNumbers('Max 1.234,5 und 1.500 Werte.', big).ok).toBe(true)
    expect(verifyNarrativeNumbers('Max 1,234.5 and 1,500 values.', big).ok).toBe(true)
    expect(verifyNarrativeNumbers('Max 1.236,5.', big).ok).toBe(false)
  })

  it('does not mistake a range hyphen for a minus sign, and checks a real sign', () => {
    expect(ok('Between 0.5-3.25, latest 2.75.').ok).toBe(true)
    expect(ok('Latest -2.75.').ok).toBe(false)
    const negative: NarrativeRequest = { ...request, summary: { ...request.summary, min: -4.5 } }
    expect(verifyNarrativeNumbers('Minimum -4.5', negative).ok).toBe(true)
    expect(verifyNarrativeNumbers('Minimum −4.5', negative).ok).toBe(true)
    expect(verifyNarrativeNumbers('Minimum 4.5', negative).ok).toBe(false)
  })

  it('reads full-width digits as the digits they are and refuses digits of other writing systems', () => {
    expect(ok('最新値は２.７５です').ok).toBe(true)
    expect(ok('latest ٣.٧٥').ok).toBe(false) // Arabic-Indic digits
  })

  it('refuses a figure that only looks like a list of numbers', () => {
    expect(ok('values 0.5,3.25,9').ok).toBe(false)
  })
})

describe('the narrative gate with a language model', () => {
  const provider = (text: string): AiProvider => ({ name: 'model', generateNarrative: async () => ({ narrative: text, generatedBy: 'ai' }) })

  it('shows the sentence of the model when its numbers are the summary', async () => {
    const result = await safeGenerateNarrative(provider('120 samples, latest 2.75, rising.'), request)
    expect(result.generatedBy).toBe('ai')
    expect(result.fallbackReason).toBeUndefined()
  })

  it('falls back to the statistical sentence, saying why, when a number is not in the summary', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = await safeGenerateNarrative(provider('120 samples, latest 4.20.'), request)
    expect(result.generatedBy).toBe('statistical-fallback')
    expect(result.fallbackReason).toBe('unverified')
    expect(result.narrative).toContain('2.75')
    vi.restoreAllMocks()
  })

  it('falls back, saying it was unavailable, when the model fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const broken: AiProvider = { name: 'model', generateNarrative: async () => { throw new Error('down') } }
    const result = await safeGenerateNarrative(broken, request)
    expect(result.generatedBy).toBe('statistical-fallback')
    expect(result.fallbackReason).toBe('unavailable')
    vi.restoreAllMocks()
  })

  it('does not verify the built-in statistical sentence (nothing to say about why)', async () => {
    const { NO_PROVIDER_CONFIGURED } = await import('../src/lib/aiProvider')
    const result = await safeGenerateNarrative(NO_PROVIDER_CONFIGURED, request)
    expect(result.fallbackReason).toBeUndefined()
  })
})
