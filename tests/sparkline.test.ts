// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/sparkline.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { farthestFromMean, pointAt, polylinePoints, sparklinePoints } from '../src/lib/sparkline'

describe('sparklinePoints', () => {
  it('puts the lowest value at the bottom and the highest at the top, inside the margin', () => {
    const points = sparklinePoints([0, 5, 10], 104, 54, 2)
    expect(points).toEqual([
      { x: 2, y: 52 },
      { x: 52, y: 27 },
      { x: 102, y: 2 },
    ])
  })

  it('draws a constant series along the middle and a single value in the middle', () => {
    expect(sparklinePoints([3, 3, 3], 100, 40).map((p) => p.y)).toEqual([20, 20, 20])
    expect(sparklinePoints([7], 100, 40)).toEqual([{ x: 50, y: 20 }])
  })

  it('draws nothing for no data, a box with no room, or only values that are not numbers', () => {
    expect(sparklinePoints([], 100, 40)).toEqual([])
    expect(sparklinePoints([1, 2], 4, 4, 2)).toEqual([])
    expect(sparklinePoints([Number.NaN, Infinity], 100, 40)).toEqual([])
  })

  it('skips a value that is not a number and keeps the others where they belong in time', () => {
    const points = sparklinePoints([0, Number.NaN, 10], 104, 54, 2)
    expect(points).toHaveLength(2)
    expect(points[0].x).toBe(2)
    expect(points[1].x).toBe(102)
    expect(polylinePoints(points)).not.toMatch(/NaN/)
  })
})

describe('polylinePoints', () => {
  it('writes the points the way an SVG polyline wants them, rounded', () => {
    expect(polylinePoints([{ x: 1.23456, y: 2 }, { x: 3, y: 4.5 }])).toBe('1.23,2 3,4.5')
    expect(polylinePoints([])).toBe('')
  })
})

describe('farthestFromMean', () => {
  it('finds the sample that deviates most, the first one on a tie', () => {
    expect(farthestFromMean([1, 1, 1, 9, 1, 1])).toBe(3)
    expect(farthestFromMean([5, 5, 5])).toBe(0)
    expect(farthestFromMean([1, -1, 1, -1])).toBe(0)
  })

  it('ignores values that are not numbers, and says -1 when there is nothing to compare', () => {
    expect(farthestFromMean([Number.NaN, 2, 2, 20])).toBe(3)
    expect(farthestFromMean([])).toBe(-1)
    expect(farthestFromMean([Number.NaN])).toBe(-1)
  })
})

describe('pointAt', () => {
  it('gives the point drawn for a sample, even after a value that was skipped', () => {
    const values = [0, Number.NaN, 10]
    expect(pointAt(values, 2, 104, 54)).toEqual({ x: 102, y: 2 })
    expect(pointAt(values, 1, 104, 54)).toBeNull()
    expect(pointAt(values, 9, 104, 54)).toBeNull()
    expect(pointAt(values, -1, 104, 54)).toBeNull()
  })
})
