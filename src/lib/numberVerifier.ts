// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Numeric verifier of a generated narrative: numberVerifier.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// A language model can write a fluent sentence with a wrong figure. Before a narrative of a model is shown, every number written in
// it must be one of the numbers of the summary it is about (the count, the minimum, the maximum, the average, the latest), as
// written to the number of decimals it uses ("2.8" for 2.75 is a rounding, "3.1" is not). A number that matches none, a digit
// of another writing system, or a number that cannot be read makes the whole narrative unusable and the caller falls back to
// the statistical sentence. The identifiers of the series ("motor-1/vibration/rms") are not numbers and are taken out first.
//
// What it does NOT do: it reads digits, not words ("three thousand" or a Chinese numeral is not read), so it narrows what a model
// can get wrong, it does not prove that the sentence is true. The prompt that the node builds tells the model to copy the numbers.

import type { NarrativeRequest } from './aiProvider'

export interface VerifyResult {
  ok: boolean
  /** The numbers as written in the text that match no figure of the summary (a non-ASCII digit appears as such). */
  unmatched: string[]
}

const EPSILON = 1e-9

function stripIdentifiers(text: string, request: NarrativeRequest): string {
  let out = text
  for (const id of [`${request.sourceId}/${request.kind}/${request.field}`, request.sourceId, request.kind, request.field]) {
    if (id !== '') out = out.split(id).join(' ')
  }
  return out
}

interface Candidate {
  value: number
  decimals: number
}

/** The readings of one written number: "1.234" may be 1.234 or 1234, "1,5" is 1.5, "1.234,5" is 1234.5. */
function candidates(raw: string): Candidate[] {
  const hasDot = raw.includes('.')
  const hasComma = raw.includes(',')
  if (!hasDot && !hasComma) return [{ value: Number(raw), decimals: 0 }]
  const lastDot = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')
  if (hasDot && hasComma) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandSep = decimalSep === '.' ? ',' : '.'
    const [integer, fraction] = raw.split(decimalSep).length === 2 ? raw.split(decimalSep) : [raw, '']
    const cleaned = integer.split(thousandSep).join('')
    if (!/^\d+$/.test(cleaned) || !/^\d*$/.test(fraction)) return []
    return [{ value: Number(`${cleaned}.${fraction === '' ? '0' : fraction}`), decimals: fraction.length }]
  }
  const sep = hasDot ? '.' : ','
  const parts = raw.split(sep)
  if (parts.length === 2) {
    const readings: Candidate[] = [{ value: Number(`${parts[0]}.${parts[1]}`), decimals: parts[1].length }]
    if (parts[1].length === 3 && parts[0].length <= 3) readings.push({ value: Number(parts[0] + parts[1]), decimals: 0 }) // a thousands separator
    return readings
  }
  // several of the same separator: only thousands groups can be meant
  if (parts.slice(1).every((group) => group.length === 3)) return [{ value: Number(parts.join('')), decimals: 0 }]
  return []
}

function matches(written: Candidate, sign: number, allowed: number): boolean {
  const tolerance = 0.5 * Math.pow(10, -written.decimals) + EPSILON * Math.max(1, Math.abs(allowed))
  return Math.abs(sign * written.value - allowed) <= tolerance
}

/** Checks every number written in `narrative` against the figures of the summary of `request`. */
export function verifyNarrativeNumbers(narrative: string, request: NarrativeRequest): VerifyResult {
  const text = stripIdentifiers(narrative.normalize('NFKC'), request)
  const unmatched: string[] = []
  // a digit of another writing system (Arabic-Indic, Devanagari...) would slip past an ASCII reading: refuse it
  for (const found of text.match(/[\p{Nd}]/gu) ?? []) {
    if (!/[0-9]/.test(found)) unmatched.push(found)
  }
  const { count, min, max, average, latest } = request.summary
  const allowed = [count, min, max, average, latest]
  const pattern = /(^|[^\p{L}\p{N}])?([-−]?)(\d+(?:[.,]\d+)*)/gu
  for (const hit of text.matchAll(pattern)) {
    const before = hit[1] ?? ''
    const minus = hit[2]
    const raw = hit[3]
    // a "-" right after a letter or digit is a hyphen or a range ("0.5-3.25"), not a sign; the true minus sign is always a sign
    const isSign = minus === '−' || (minus === '-' && !/[\p{L}\p{N}]/u.test(before))
    const sign = isSign ? -1 : 1
    const readings = candidates(raw)
    const ok = readings.some((written) => allowed.some((figure) => matches(written, sign, figure)))
    if (!ok) unmatched.push(`${isSign ? minus : ''}${raw}`)
  }
  return { ok: unmatched.length === 0, unmatched }
}
