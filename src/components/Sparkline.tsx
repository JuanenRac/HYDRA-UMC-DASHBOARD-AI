// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - The small chart of a series: Sparkline.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// An inline SVG polyline of a series with optional marked samples. The text of the figure (the range and the number of
// samples) is real text for a screen reader; the drawing itself is hidden from it.

import { pointAt, polylinePoints, sparklinePoints } from '../lib/sparkline'

export interface SparkMark {
  /** Index in `values`. */
  index: number
  label: string
  tone: 'bad' | 'good' | 'neutral'
}

interface Props {
  values: readonly number[]
  marks?: readonly SparkMark[]
  width?: number
  height?: number
  /** Names the figure for assistive technology. */
  caption: string
  testId?: string
}

export function Sparkline({ values, marks = [], width = 240, height = 48, caption, testId }: Props) {
  const points = sparklinePoints(values, width, height)
  if (points.length === 0) return null
  const finite = values.filter(Number.isFinite)
  const range = `${Math.min(...finite).toFixed(2)} - ${Math.max(...finite).toFixed(2)}`
  return (
    <figure className="sparkline" data-testid={testId}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`${caption}: ${finite.length} samples, ${range}`}>
        {points.length > 1 ? <polyline className="sparkline-line" fill="none" points={polylinePoints(points)} /> : null}
        {points.length === 1 ? <circle className="sparkline-dot" cx={points[0].x} cy={points[0].y} r={2} /> : null}
        {marks.map((mark) => {
          const p = pointAt(values, mark.index, width, height)
          return p ? (
            <circle key={`${mark.index}-${mark.label}`} className={`sparkline-mark sparkline-mark-${mark.tone}`} cx={p.x} cy={p.y} r={3.5} data-testid="sparkline-mark">
              <title>{mark.label}</title>
            </circle>
          ) : null
        })}
      </svg>
      <figcaption className="sparkline-caption">
        {caption}: {finite.length} samples, {range}
      </figcaption>
    </figure>
  )
}
