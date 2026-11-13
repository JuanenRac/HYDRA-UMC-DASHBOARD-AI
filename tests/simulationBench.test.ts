// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/simulationBench.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Simulation bench: the real forecast, the real geometry of the small chart and the real verifier of the numbers of a narrative, against the history of a plant that
// a generator with a fixed seed makes (a drift, noise, a gap, a reading that is not a number) and against narratives that quote the summary right and wrong. The
// checks state what must hold whatever the history is. Nothing here says how the dashboard looks with the data of a real plant: that needs the plant.

import { describe, expect, it } from 'vitest'
import type { DatalakePoint } from '../src/api/datalakeClient'
import type { NarrativeRequest } from '../src/lib/aiProvider'
import { forecast, MIN_FORECAST_POINTS } from '../src/lib/forecast'
import { verifyNarrativeNumbers } from '../src/lib/numberVerifier'
import { farthestFromMean, pointAt, polylinePoints, sparklinePoints } from '../src/lib/sparkline'

const MINUTE = 60_000
const SEED = 20260101

/** A small generator with a fixed seed: the same numbers on every machine. */
function generator(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(random: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}

function history(random: () => number, count: number, slopePerMinute: number, noise: number): { points: DatalakePoint[]; start: number } {
  const start = 40 + random() * 40
  const points = Array.from({ length: count }, (_, i) => ({
    sourceId: 'press-1', kind: 'temperature', field: 'value', timestamp: 1_800_000_000_000 + i * MINUTE,
    value: start + slopePerMinute * i + noise * gaussian(random),
  }))
  return { points, start }
}

describe('the forecast over the history of a plant', () => {
  it('gets the drift of a noisy history right and its range holds the true value about as often as it says', () => {
    const random = generator(SEED)
    let inside = 0
    const trials = 300
    for (let trial = 0; trial < trials; trial += 1) {
      const slope = (random() - 0.5) * 0.4
      const { points, start } = history(random, 60, slope, 0.5)
      const result = forecast(points, 10 * MINUTE)!
      expect(result).not.toBeNull()
      expect(Math.abs(result.slopePerMinute - slope)).toBeLessThan(0.02)
      const truth = start + slope * (59 + 10)
      if (result.low <= truth && truth <= result.high) inside += 1
    }
    expect(inside / trials).toBeGreaterThan(0.9)
  })

  it('has a range that never closes below the value or opens the wrong way', () => {
    const random = generator(SEED + 1)
    for (let trial = 0; trial < 100; trial += 1) {
      const { points } = history(random, 8 + Math.floor(random() * 80), (random() - 0.5) * 0.3, random())
      const result = forecast(points, 3 * MINUTE)
      if (result === null) continue
      expect(result.low).toBeLessThanOrEqual(result.value)
      expect(result.high).toBeGreaterThanOrEqual(result.value)
      expect(result.basedOn).toBe(points.length)
    }
  })

  it('does not depend on the order the points arrive in', () => {
    const random = generator(SEED + 2)
    for (let trial = 0; trial < 30; trial += 1) {
      const { points } = history(random, 30, 0.1, 0.4)
      const shuffled = [...points]
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      expect(forecast(shuffled, 5 * MINUTE)).toEqual(forecast(points, 5 * MINUTE))
    }
  })

  it('says nothing when there is too little history, none in time, or a horizon further than the history reaches', () => {
    const random = generator(SEED + 3)
    const { points } = history(random, 30, 0.1, 0.3)
    expect(forecast(points.slice(0, MIN_FORECAST_POINTS - 1), MINUTE)).toBeNull()
    expect(forecast(points, 30 * MINUTE)).toBeNull() // the history spans 29 minutes
    expect(forecast(points, 29 * MINUTE)).not.toBeNull()
    for (const horizon of [0, -MINUTE, Number.NaN, Number.POSITIVE_INFINITY]) expect(forecast(points, horizon)).toBeNull()
    const sameInstant = points.map((p) => ({ ...p, timestamp: 1_800_000_000_000 }))
    expect(forecast(sameInstant, MINUTE)).toBeNull()
  })

  it('leaves out the readings that are not numbers and uses the rest', () => {
    const random = generator(SEED + 4)
    const { points } = history(random, 40, 0.2, 0.2)
    const damaged = points.map((p, i) => (i % 7 === 0 ? { ...p, value: Number.NaN } : i % 11 === 0 ? { ...p, timestamp: Number.POSITIVE_INFINITY } : p))
    const result = forecast(damaged, 5 * MINUTE)!
    const usable = damaged.filter((p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp)).length
    expect(result.basedOn).toBe(usable)
    expect(Math.abs(result.slopePerMinute - 0.2)).toBeLessThan(0.05)
  })

  it('is the same on every run for the same seed and different for another seed', () => {
    const run = (seed: number) => forecast(history(generator(seed), 50, 0.15, 0.6).points, 8 * MINUTE)
    expect(run(SEED)).toEqual(run(SEED))
    expect(run(SEED)).not.toEqual(run(SEED + 1))
  })
})

describe('the geometry of the small chart over the history of a plant', () => {
  const WIDTH = 120
  const HEIGHT = 32
  const PAD = 2

  it('keeps every point inside the box, in order, with the highest value at the top, whatever the readings are', () => {
    const random = generator(SEED + 5)
    for (let trial = 0; trial < 100; trial += 1) {
      const values = Array.from({ length: 2 + Math.floor(random() * 60) }, () => (random() < 0.1 ? Number.NaN : (random() - 0.5) * 1000))
      const finite = values.filter((v) => Number.isFinite(v))
      const points = sparklinePoints(values, WIDTH, HEIGHT, PAD)
      expect(points).toHaveLength(finite.length)
      for (const p of points) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
        expect(p.x).toBeGreaterThanOrEqual(PAD - 1e-9)
        expect(p.x).toBeLessThanOrEqual(WIDTH - PAD + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(PAD - 1e-9)
        expect(p.y).toBeLessThanOrEqual(HEIGHT - PAD + 1e-9)
      }
      for (let i = 1; i < points.length; i += 1) expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x)
      if (finite.length > 1 && Math.max(...finite) > Math.min(...finite)) {
        const top = points.reduce((best, p, i) => (p.y < points[best].y ? i : best), 0)
        expect(finite[top]).toBe(Math.max(...finite))
      }
    }
  })

  it('draws a constant series along the middle, one value in the middle, and nothing for nothing or for a box with no room', () => {
    expect(sparklinePoints([5, 5, 5], WIDTH, HEIGHT).every((p) => p.y === HEIGHT / 2)).toBe(true)
    expect(sparklinePoints([5], WIDTH, HEIGHT)).toEqual([{ x: WIDTH / 2, y: HEIGHT / 2 }])
    expect(sparklinePoints([], WIDTH, HEIGHT)).toEqual([])
    expect(sparklinePoints([Number.NaN, Number.POSITIVE_INFINITY], WIDTH, HEIGHT)).toEqual([])
    expect(sparklinePoints([1, 2, 3], 4, HEIGHT, 2)).toEqual([])
    expect(sparklinePoints([1, 2, 3], WIDTH, 3, 2)).toEqual([])
  })

  it('writes a polyline with one pair of numbers for each point', () => {
    const random = generator(SEED + 6)
    const values = Array.from({ length: 25 }, () => random() * 100)
    const text = polylinePoints(sparklinePoints(values, WIDTH, HEIGHT))
    const pairs = text.split(' ')
    expect(pairs).toHaveLength(25)
    for (const pair of pairs) expect(pair).toMatch(/^-?\d+(\.\d{1,2})?,-?\d+(\.\d{1,2})?$/)
    expect(polylinePoints([])).toBe('')
  })

  it('marks the sample farthest from the mean, the first on a tie, and none when there is nothing to mark', () => {
    const random = generator(SEED + 7)
    for (let trial = 0; trial < 100; trial += 1) {
      const values = Array.from({ length: 3 + Math.floor(random() * 40) }, () => random() * 20)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      let expected = 0
      values.forEach((v, i) => {
        if (Math.abs(v - mean) > Math.abs(values[expected] - mean)) expected = i
      })
      expect(farthestFromMean(values)).toBe(expected)
    }
    expect(farthestFromMean([])).toBe(-1)
    expect(farthestFromMean([Number.NaN])).toBe(-1)
    expect(farthestFromMean([1, 9, 1, 9])).toBe(0)
  })

  it('finds the point of a sample that is drawn and none for one that is not', () => {
    const values = [1, Number.NaN, 3, 4]
    const drawn = sparklinePoints(values, WIDTH, HEIGHT)
    expect(pointAt(values, 0, WIDTH, HEIGHT)).toEqual(drawn[0])
    expect(pointAt(values, 2, WIDTH, HEIGHT)).toEqual(drawn[1])
    expect(pointAt(values, 1, WIDTH, HEIGHT)).toBeNull()
    expect(pointAt(values, -1, WIDTH, HEIGHT)).toBeNull()
    expect(pointAt(values, 4, WIDTH, HEIGHT)).toBeNull()
  })
})

describe('the verifier of the numbers of a narrative over summaries drawn from a plant', () => {
  function summaryRequest(random: () => number): NarrativeRequest {
    const min = Math.round((random() * 40) * 100) / 100
    const max = Math.round((min + 5 + random() * 40) * 100) / 100
    return {
      sourceId: `press-${1 + Math.floor(random() * 9)}`, kind: 'temperature', field: 'value',
      summary: {
        count: 20 + Math.floor(random() * 5000), min, max, average: Math.round(((min + max) / 2) * 100) / 100, latest: Math.round((min + random() * (max - min)) * 100) / 100,
        direction: 'up', minTimestamp: 1, maxTimestamp: 2, latestTimestamp: 3,
      },
    }
  }

  it('accepts a narrative that quotes the figures of the summary as they are', () => {
    const random = generator(SEED + 8)
    for (let trial = 0; trial < 100; trial += 1) {
      const request = summaryRequest(random)
      const s = request.summary
      const text = `${request.sourceId}/${request.kind}/${request.field}: ${s.count} samples between ${s.min} and ${s.max}, average ${s.average}, latest ${s.latest}.`
      expect(verifyNarrativeNumbers(text, request)).toEqual({ ok: true, unmatched: [] })
    }
  })

  it('accepts the same figures with a decimal comma or rounded to fewer decimals', () => {
    const random = generator(SEED + 9)
    for (let trial = 0; trial < 100; trial += 1) {
      const request = summaryRequest(random)
      const s = request.summary
      expect(verifyNarrativeNumbers(`Mittelwert ${s.average.toFixed(2).replace('.', ',')} und letzter Wert ${s.latest.toFixed(2).replace('.', ',')}.`, request).ok).toBe(true)
      expect(verifyNarrativeNumbers(`Latest ${s.latest.toFixed(1)}, average ${s.average.toFixed(0)}.`, request).ok).toBe(true)
    }
  })

  it('refuses a narrative with one figure that is not in the summary and says which', () => {
    const random = generator(SEED + 10)
    for (let trial = 0; trial < 100; trial += 1) {
      const request = summaryRequest(random)
      const s = request.summary
      const wrong = Math.round((s.max + 7.77) * 100) / 100
      const result = verifyNarrativeNumbers(`${s.count} samples, latest ${s.latest}, peak ${wrong.toFixed(2)}.`, request)
      expect(result.ok).toBe(false)
      expect(result.unmatched).toEqual([wrong.toFixed(2)])
    }
  })

  it('refuses digits of another writing system and a narrative whose only number is wrong', () => {
    const request = summaryRequest(generator(SEED + 11))
    expect(verifyNarrativeNumbers('Latest ٢٫٧٥ and ١٢٠ samples.', request).ok).toBe(false)
    expect(verifyNarrativeNumbers(`The value is ${request.summary.max + 100}.`, request).ok).toBe(false)
    expect(verifyNarrativeNumbers('Nothing to report.', request).ok).toBe(true)
  })
})
