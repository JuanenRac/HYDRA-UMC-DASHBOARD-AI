// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real anomaly check panel: AnomalyCheckPanel.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Pulls the most recent N samples for a source/kind/field from a real
// HYDRA-UMC-DATALAKE instance and scores them for real against a real
// HYDRA-UMC-ANOMALY-DETECTOR instance. Deliberately checks GET /stats
// first and shows the real "not fitted yet" operational state as its own
// message rather than a generic error - see anomalyClient.ts's own
// header comment for why fitting the shared baseline is out of scope
// here.

import { useState } from 'react'
import { queryDatalake, DatalakeApiError } from '../api/datalakeClient'
import { detectAnomaly, fetchDetectorStats, AnomalyApiError, type DetectVerdict } from '../api/anomalyClient'

interface Props {
  datalakeBaseUrl: string
  anomalyBaseUrl: string
}

export function AnomalyCheckPanel({ datalakeBaseUrl, anomalyBaseUrl }: Props) {
  const [sourceId, setSourceId] = useState('robot-1')
  const [kind, setKind] = useState('motor_temp')
  const [field, setField] = useState('value')
  const [windowSize, setWindowSize] = useState(64)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFitted, setNotFitted] = useState(false)
  const [verdict, setVerdict] = useState<DetectVerdict | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotFitted(false)
    setVerdict(null)

    try {
      const stats = await fetchDetectorStats(anomalyBaseUrl)
      if (!stats.fitted) {
        setNotFitted(true)
        return
      }

      // Real most-recent-N: query a wide-enough window and keep the tail,
      // since DATALAKE's own /query takes a time range, not a sample
      // count. 24h back is generous enough for any real telemetry rate
      // this ecosystem's collectors run at.
      const end = Date.now()
      const start = end - 24 * 60 * 60_000
      const points = await queryDatalake(datalakeBaseUrl, { sourceId, kind, field, start, end })

      if (points.length < windowSize) {
        setError(
          `Only ${points.length} real sample(s) available for this source/kind/field in the last 24h - need at least ${windowSize} to score a window.`,
        )
        return
      }

      const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
      const window = sorted.slice(-windowSize).map((p) => p.value)
      setVerdict(await detectAnomaly(anomalyBaseUrl, window))
    } catch (err) {
      if (err instanceof DatalakeApiError || err instanceof AnomalyApiError) {
        setError(err.message)
      } else {
        setError('Unexpected error checking for anomalies.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="anomaly-check-heading">
      <h2 id="anomaly-check-heading">Anomaly Check</h2>
      <p className="panel-subtitle">
        Scores the most recent real samples for a source against a real, already-fitted
        HYDRA-UMC-ANOMALY-DETECTOR baseline.
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
          Window size
          <input
            type="number"
            min={1}
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'Check for anomalies'}
        </button>
      </form>

      {error && (
        <p role="alert" className="panel-error">
          {error}
        </p>
      )}

      {notFitted && (
        <p className="panel-warning" data-testid="anomaly-not-fitted">
          The anomaly detector at {anomalyBaseUrl} has no baseline fitted yet - real result, not
          an error: nothing can be scored until it is.
        </p>
      )}

      {verdict && (
        <dl className="summary-grid" data-testid="anomaly-verdict">
          <div>
            <dt>Score</dt>
            <dd>{verdict.score.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Anomalous</dt>
            <dd className={verdict.anomalous ? 'verdict-bad' : 'verdict-good'}>
              {verdict.anomalous ? 'Yes' : 'No'}
            </dd>
          </div>
          <div>
            <dt>Worst bin frequency</dt>
            <dd>{verdict.worstBinFreqHz.toFixed(2)} Hz</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
