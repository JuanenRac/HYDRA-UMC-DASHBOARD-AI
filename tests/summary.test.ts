// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/summary.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================

import { describe, expect, it } from 'vitest'
import { summarize, SummaryError } from '../src/lib/summary'
import type { DatalakePoint } from '../src/api/datalakeClient'

function point(timestamp: number, value: number): DatalakePoint {
  return { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp, value }
}

describe('summarize', () => {
  it('computes real min/max/average/latest from a hand-checkable series', () => {
    const points = [point(0, 10), point(1000, 20), point(2000, 30)]
    const summary = summarize(points)
    expect(summary.count).toBe(3)
    expect(summary.min).toBe(10)
    expect(summary.max).toBe(30)
    expect(summary.average).toBe(20)
    expect(summary.latest).toBe(30)
    expect(summary.direction).toBe('up')
  })

  it('sorts out-of-order points before computing latest/direction', () => {
    // Deliberately shuffled - DATALAKE's own /query does not guarantee order.
    const points = [point(2000, 5), point(0, 50), point(1000, 25)]
    const summary = summarize(points)
    expect(summary.latest).toBe(5)
    expect(summary.direction).toBe('down')
  })

  it('reports "flat" for a genuinely flat series', () => {
    const points = [point(0, 42), point(1000, 42), point(2000, 42)]
    expect(summarize(points).direction).toBe('flat')
  })

  it('reports "flat" for noise within the relative threshold, not "up"/"down"', () => {
    const points = [point(0, 100), point(1000, 100.1), point(2000, 100.05)]
    expect(summarize(points).direction).toBe('flat')
  })

  it('throws SummaryError on an empty list instead of returning a misleading zero-summary', () => {
    expect(() => summarize([])).toThrow(SummaryError)
  })

  it('works correctly for a single point', () => {
    const summary = summarize([point(0, 7)])
    expect(summary.count).toBe(1)
    expect(summary.min).toBe(7)
    expect(summary.max).toBe(7)
    expect(summary.average).toBe(7)
    expect(summary.direction).toBe('flat')
  })
})
