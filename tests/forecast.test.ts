// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Tests of the short-term forecast: forecast.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
import { describe, expect, it } from 'vitest'
import type { DatalakePoint } from '../src/api/datalakeClient'
import { forecast, MIN_FORECAST_POINTS } from '../src/lib/forecast'

const MINUTE = 60_000

function series(values: number[], stepMs = MINUTE): DatalakePoint[] {
  return values.map((value, i) => ({ sourceId: 's', kind: 'k', field: 'f', timestamp: 1_000_000 + i * stepMs, value }))
}

describe('forecast', () => {
  it('continues a straight line exactly, with no range', () => {
    const result = forecast(series([10, 12, 14, 16, 18, 20]), 2 * MINUTE)
    expect(result).not.toBeNull()
    expect(result!.value).toBeCloseTo(24, 9)
    expect(result!.slopePerMinute).toBeCloseTo(2, 9)
    expect(result!.high - result!.low).toBeCloseTo(0, 9)
    expect(result!.basedOn).toBe(6)
    expect(result!.horizonMs).toBe(2 * MINUTE)
  })

  it('does not depend on the order the points arrive in', () => {
    const points = series([10, 12, 14, 16, 18, 20])
    const shuffled = [points[3], points[0], points[5], points[1], points[4], points[2]]
    expect(forecast(shuffled, MINUTE)).toEqual(forecast(points, MINUTE))
  })

  it('widens the range when the points scatter and when the horizon grows', () => {
    const noisy = series([10, 13, 11, 16, 14, 19, 17])
    const near = forecast(noisy, MINUTE)!
    const far = forecast(noisy, 5 * MINUTE)!
    expect(near.high - near.low).toBeGreaterThan(0)
    expect(far.high - far.low).toBeGreaterThan(near.high - near.low)
    expect(near.low).toBeLessThan(near.value)
    expect(near.high).toBeGreaterThan(near.value)
  })

  it('forecasts a flat series as flat', () => {
    const result = forecast(series([5, 5, 5, 5, 5]), MINUTE)!
    expect(result.value).toBeCloseTo(5, 9)
    expect(result.slopePerMinute).toBeCloseTo(0, 9)
  })

  it('refuses a series that is too short', () => {
    expect(forecast(series([1, 2, 3, 4]), MINUTE)).toBeNull()
    expect(MIN_FORECAST_POINTS).toBe(5)
    expect(forecast([], MINUTE)).toBeNull()
  })

  it('refuses to look further ahead than the data reaches back', () => {
    const points = series([1, 2, 3, 4, 5]) // four minutes of data
    expect(forecast(points, 4 * MINUTE)).not.toBeNull()
    expect(forecast(points, 4 * MINUTE + 1)).toBeNull()
  })

  it('refuses a horizon that is not a positive number', () => {
    const points = series([1, 2, 3, 4, 5])
    for (const bad of [0, -MINUTE, Number.NaN, Number.POSITIVE_INFINITY]) expect(forecast(points, bad)).toBeNull()
  })

  it('refuses points that all share one instant', () => {
    expect(forecast(series([1, 2, 3, 4, 5], 0), MINUTE)).toBeNull()
  })

  it('leaves out points that are not numbers instead of poisoning the line', () => {
    const points = series([10, 12, 14, 16, 18, 20])
    points.push({ sourceId: 's', kind: 'k', field: 'f', timestamp: Number.NaN, value: 99 })
    points.push({ sourceId: 's', kind: 'k', field: 'f', timestamp: 5_000_000, value: Number.NaN })
    const result = forecast(points, MINUTE)!
    expect(result.basedOn).toBe(6)
    expect(result.value).toBeCloseTo(22, 9)
  })
})
