// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Sparkline geometry: sparkline.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The geometry of the small chart of a series, without any rendering: the points of a polyline that fits a box, the
// path of it, and which sample deviates most from the others (the one to mark when the detector calls the window
// anomalous). Plain numbers in, plain numbers out, so it is checked without a DOM.

export interface SparkPoint {
  x: number
  y: number
}

/**
 * The points of `values` in a box of `width` by `height` (y grows downwards, so the highest value is at the top),
 * with `pad` of margin all round. Values that are not finite are skipped (they leave a gap in x, never a NaN in the
 * path). A constant series is drawn along the middle; one value is a single point in the middle; none is empty.
 */
export function sparklinePoints(values: readonly number[], width: number, height: number, pad = 2): SparkPoint[] {
  const usable = values.map((value, index) => ({ value, index })).filter((item) => Number.isFinite(item.value))
  if (usable.length === 0 || width <= 2 * pad || height <= 2 * pad) return []
  let min = Infinity
  let max = -Infinity
  for (const { value } of usable) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const span = max - min
  const lastIndex = Math.max(1, values.length - 1)
  const innerWidth = width - 2 * pad
  const innerHeight = height - 2 * pad
  return usable.map(({ value, index }) => ({
    x: values.length === 1 ? width / 2 : pad + (index / lastIndex) * innerWidth,
    y: span === 0 ? height / 2 : pad + (1 - (value - min) / span) * innerHeight,
  }))
}

const round = (n: number): string => (Math.round(n * 100) / 100).toString()

/** The `points` attribute of an SVG polyline. */
export function polylinePoints(points: readonly SparkPoint[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
}

/** The index in `values` of the sample farthest from their mean (the first one on a tie), or -1 when none is finite. */
export function farthestFromMean(values: readonly number[]): number {
  const finite = values.map((value, index) => ({ value, index })).filter((item) => Number.isFinite(item.value))
  if (finite.length === 0) return -1
  const mean = finite.reduce((sum, item) => sum + item.value, 0) / finite.length
  let best = finite[0]
  for (const item of finite) {
    if (Math.abs(item.value - mean) > Math.abs(best.value - mean)) best = item
  }
  return best.index
}

/** The point of the sample at `index` of `values`, or null when it is not drawn (out of range, not finite). */
export function pointAt(values: readonly number[], index: number, width: number, height: number, pad = 2): SparkPoint | null {
  if (index < 0 || index >= values.length || !Number.isFinite(values[index])) return null
  const usable = values.map((value, i) => ({ value, i })).filter((item) => Number.isFinite(item.value))
  const drawn = sparklinePoints(values, width, height, pad)
  const position = usable.findIndex((item) => item.i === index)
  return position >= 0 ? (drawn[position] ?? null) : null
}
