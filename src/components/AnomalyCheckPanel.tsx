// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Real anomaly check panel: AnomalyCheckPanel.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Pulls the most recent N samples for a source/kind/field from a real
// HYDRA-UMC-DATALAKE instance and scores them for real against a real
// HYDRA-UMC-ANOMALY-DETECTOR instance. Deliberately checks GET /stats
// first and shows the real "not fitted yet" operational state as its own
// message rather than a generic error - see anomalyClient.ts's own
// header comment for why fitting the shared baseline is out of scope
// here.

import { useState } from 'react'
import { recentSamples, DatalakeApiError } from '../api/datalakeClient'
import { Sparkline } from './Sparkline'
import { farthestFromMean } from '../lib/sparkline'
import { detectAnomaly, fetchDetectorStats, AnomalyApiError, type DetectVerdict } from '../api/anomalyClient'

interface Props {
  datalakeBaseUrl: string
  anomalyBaseUrl: string
}

export function AnomalyCheckPanel({ datalakeBaseUrl, anomalyBaseUrl }: Props) {
  const [sourceId, setSourceId] = useState('robot-1')
  const [kind, setKind] = useState('vibration')
  const [field, setField] = useState('value')
  const [windowSize, setWindowSize] = useState(64)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFitted, setNotFitted] = useState(false)
  const [verdict, setVerdict] = useState<DetectVerdict | null>(null)
  const [scored, setScored] = useState<number[]>([])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(windowSize) || windowSize < 1) {
      setError('Window size must be a whole number of at least 1.')
      return
    }
    setLoading(true)
    setError(null)
    setNotFitted(false)
    setVerdict(null)
    setScored([])

    try {
      const stats = await fetchDetectorStats(anomalyBaseUrl)
      if (!stats.fitted) {
        setNotFitted(true)
        return
      }

      // The newest N samples whatever the sampling rate: the window is derived from the rate the series has.
      const recent = await recentSamples(datalakeBaseUrl, { sourceId, kind, field }, windowSize)
      if (recent.length < windowSize) {
        setError(
          `Only ${recent.length} real sample(s) stored for this source/kind/field - need at least ${windowSize} to score a window.`,
        )
        return
      }
      const window = recent.map((p) => p.value)
      const result = await detectAnomaly(anomalyBaseUrl, window)
      setScored(window)
      setVerdict(result)
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

      {verdict && scored.length > 0 && (
        <Sparkline
          values={scored}
          caption="Scored window"
          testId="anomaly-sparkline"
          marks={verdict.anomalous ? [{ index: farthestFromMean(scored), label: 'Sample farthest from the mean of the window', tone: 'bad' }] : []}
        />
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
