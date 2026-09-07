// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real trend summary panel: TrendSummaryPanel.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// A real, working panel: queries a real HYDRA-UMC-DATALAKE instance for a
// source/kind/field's recent history and shows real min/max/average/
// latest/direction, computed by lib/summary.ts. No mock data path - a
// real DATALAKE outage shows a real error message, not a silent fallback.

import { useState } from 'react'
import { queryDatalake, DatalakeApiError } from '../api/datalakeClient'
import { summarize, SummaryError, type TrendSummary } from '../lib/summary'
import { NO_PROVIDER_CONFIGURED, safeGenerateNarrative, type NarrativeResponse } from '../lib/aiProvider'

interface Props {
  datalakeBaseUrl: string
}

const DIRECTION_LABEL: Record<TrendSummary['direction'], string> = {
  up: '↑ rising',
  down: '↓ falling',
  flat: '→ flat',
}

export function TrendSummaryPanel({ datalakeBaseUrl }: Props) {
  const [sourceId, setSourceId] = useState('robot-1')
  const [kind, setKind] = useState('motor_temp')
  const [field, setField] = useState('value')
  const [minutesBack, setMinutesBack] = useState(60)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<TrendSummary | null>(null)
  const [narrative, setNarrative] = useState<NarrativeResponse | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSummary(null)
    setNarrative(null)

    const end = Date.now()
    const start = end - minutesBack * 60_000

    try {
      const points = await queryDatalake(datalakeBaseUrl, { sourceId, kind, field, start, end })
      const computed = summarize(points)
      setSummary(computed)
      // No real AI provider is configured for v0 - safeGenerateNarrative
      // still runs the real request/response validation gate and returns
      // the real, honestly-labeled statistical fallback rather than
      // skipping straight to it.
      setNarrative(await safeGenerateNarrative(NO_PROVIDER_CONFIGURED, { sourceId, kind, field, summary: computed }))
    } catch (err) {
      if (err instanceof DatalakeApiError || err instanceof SummaryError) {
        setError(err.message)
      } else {
        setError('Unexpected error computing the trend summary.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="trend-summary-heading">
      <h2 id="trend-summary-heading">Trend Summary</h2>
      <p className="panel-subtitle">
        Real min/max/average/latest computed from HYDRA-UMC-DATALAKE's own history for one
        source/kind/field.
      </p>

      <form onSubmit={handleSubmit} className="panel-form">
        <label>
          Source ID
          <input value={sourceId} onChange={(e) => setSourceId(e.target.value)} required />
        </label>
        <label>
          Kind
          <input value={kind} onChange={(e) => setKind(e.target.value)} required />
        </label>
        <label>
          Field
          <input value={field} onChange={(e) => setField(e.target.value)} required />
        </label>
        <label>
          Minutes back
          <input
            type="number"
            min={1}
            value={minutesBack}
            onChange={(e) => setMinutesBack(Number(e.target.value))}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Querying…' : 'Fetch summary'}
        </button>
      </form>

      {error && (
        <p role="alert" className="panel-error">
          {error}
        </p>
      )}

      {summary && (
        <dl className="summary-grid" data-testid="trend-summary-result">
          <div>
            <dt>Samples</dt>
            <dd>{summary.count}</dd>
          </div>
          <div>
            <dt>Min</dt>
            <dd>{summary.min.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Max</dt>
            <dd>{summary.max.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{summary.average.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Latest</dt>
            <dd>{summary.latest.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{DIRECTION_LABEL[summary.direction]}</dd>
          </div>
        </dl>
      )}

      {narrative && (
        <p className="panel-narrative" data-testid="trend-narrative">
          <span className="panel-narrative-badge">
            {narrative.generatedBy === 'ai' ? 'AI' : 'Statistical fallback'}
          </span>{' '}
          {narrative.narrative}
        </p>
      )}
    </section>
  )
}
