// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Remaining useful life card: RulPanel.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Reads the newest anomaly scores of one source from HYDRA-UMC-DATALAKE and asks HYDRA-UMC-ANOMALY-DETECTOR (POST /rul) for the
// days until their trend reaches the limit. It shows the estimate with its range, the explicit states (not enough data, not
// rising, limit reached), a small chart of the scores and a warning when the earliest plausible day is within the configured
// thresholds. The App mounts it only when the configuration switches it on; any failure is shown inside the card.

import { useCallback, useEffect, useRef, useState } from 'react'
import { DatalakeApiError, recentSamples } from '../api/datalakeClient'
import { fetchRul, RulApiError, type RulEstimate, type RulErrorKind } from '../api/rulClient'
import { formatDays, rulLevel, toRulPoints, type RulLevel } from '../lib/rul'
import type { RulConfig } from '../lib/rulConfig'
import { browserLang, tr, type Lang, type RulKey } from '../lib/i18n'
import { Sparkline } from './Sparkline'

interface Props {
  datalakeBaseUrl: string
  config: RulConfig
  /** Fixed language; the browser's by default. */
  lang?: Lang
}

const ERROR_KEY: Record<RulErrorKind, RulKey> = {
  timeout: 'errTimeout',
  unreachable: 'errUnreachable',
  disabled: 'errDisabled',
  auth: 'errAuth',
  http: 'errHttp',
  invalid: 'errInvalid',
  input: 'errInput',
}

interface Failure {
  key: RulKey
  detail?: string
}

interface Outcome {
  estimate: RulEstimate
  scores: number[]
  level: RulLevel
}

export function RulPanel({ datalakeBaseUrl, config, lang }: Props) {
  const language = lang ?? browserLang()
  const [sourceId, setSourceId] = useState(config.sourceId)
  const [kind, setKind] = useState(config.kind)
  const [field, setField] = useState(config.field)
  const [limit, setLimit] = useState(String(config.limit))
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [empty, setEmpty] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const latest = useRef(0)

  const run = useCallback(async () => {
    const ticket = ++latest.current
    const limitValue = Number(limit)
    setFailure(null)
    setEmpty(false)
    setOutcome(null)
    if (limit.trim() === '' || !Number.isFinite(limitValue)) {
      setFailure({ key: 'errInput', detail: 'limit' })
      return
    }
    setLoading(true)
    try {
      const samples = await recentSamples(datalakeBaseUrl, { sourceId, kind, field }, config.points)
      if (ticket !== latest.current) return
      const points = toRulPoints(samples, config.points)
      if (points.length === 0) {
        setEmpty(true)
        return
      }
      const estimate = await fetchRul(config.detectorUrl, points, limitValue, config.timeoutMs)
      if (ticket !== latest.current) return
      setOutcome({ estimate, scores: points.map((p) => p.score), level: rulLevel(estimate, config.warnDays, config.criticalDays) })
    } catch (err) {
      if (ticket !== latest.current) return
      if (err instanceof RulApiError) {
        setFailure({ key: ERROR_KEY[err.kind], detail: err.message })
      } else if (err instanceof DatalakeApiError) {
        setFailure({ key: 'errHttp', detail: err.message })
      } else {
        setFailure({ key: 'errUnreachable' })
      }
    } finally {
      if (ticket === latest.current) setLoading(false)
    }
  }, [config, datalakeBaseUrl, field, kind, limit, sourceId])

  // one estimate when the card appears; after that, the button
  useEffect(() => {
    void run()
    return () => {
      latest.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = (key: RulKey, params?: Record<string, string | number>) => tr(language, key, params)
  const estimate = outcome?.estimate
  const earliest = estimate ? (estimate.daysLow ?? estimate.daysToLimit) : null

  return (
    <section className="panel" aria-labelledby="rul-heading" data-testid="rul-panel">
      <h2 id="rul-heading">{t('title')}</h2>
      <p className="panel-subtitle">{t('subtitle')}</p>

      <form
        className="panel-form"
        onSubmit={(event) => {
          event.preventDefault()
          void run()
        }}
      >
        <label>
          {t('source')}
          <input value={sourceId} onChange={(e) => setSourceId(e.target.value)} required />
        </label>
        <label>
          {t('kind')}
          <input value={kind} onChange={(e) => setKind(e.target.value)} required />
        </label>
        <label>
          {t('field')}
          <input value={field} onChange={(e) => setField(e.target.value)} required />
        </label>
        <label>
          {t('limit')}
          <input type="number" step="any" value={limit} onChange={(e) => setLimit(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? t('loading') : t('refresh')}
        </button>
      </form>

      {failure && (
        <p role="alert" className="panel-error" data-testid="rul-error">
          {t(failure.key, { detail: failure.detail ?? '' })}
        </p>
      )}

      {empty && (
        <p className="panel-warning" data-testid="rul-empty">
          {t('noSamples')}
        </p>
      )}

      {outcome && estimate && (
        <div data-testid="rul-result" data-level={outcome.level} data-status={estimate.status}>
          {outcome.scores.length > 1 && (
            <Sparkline values={outcome.scores} caption={t('chart')} testId="rul-sparkline" />
          )}

          {estimate.status === 'estimated' && estimate.daysToLimit !== null && (
            <>
              <p className="rul-estimate" data-testid="rul-estimate">
                {t('estimate', { days: formatDays(estimate.daysToLimit) })}
              </p>
              <p className="rul-range" data-testid="rul-range">
                {estimate.daysLow !== null && estimate.daysHigh !== null
                  ? t('range', { low: formatDays(estimate.daysLow), high: formatDays(estimate.daysHigh) })
                  : estimate.daysLow !== null
                    ? t('rangeOpen', { low: formatDays(estimate.daysLow) })
                    : null}
              </p>
            </>
          )}
          {estimate.status === 'insufficient_data' && (
            <p className="panel-warning" data-testid="rul-state">
              {t('statusInsufficient', { n: estimate.points })}
            </p>
          )}
          {estimate.status === 'not_rising' && (
            <p className="rul-state" data-testid="rul-state">
              {t('statusNotRising')}
            </p>
          )}
          {estimate.status === 'limit_reached' && (
            <p className="panel-error" data-testid="rul-state">
              {t('statusLimitReached')}
            </p>
          )}

          {estimate.slopePerDay !== null && estimate.currentValue !== null && (
            <p className="rul-detail">
              {t('slope', { slope: estimate.slopePerDay.toFixed(3) })} · {t('current', { value: estimate.currentValue.toFixed(3) })} ·{' '}
              {t('samples', { n: estimate.points })}
            </p>
          )}

          {outcome.level === 'warning' && earliest !== null && (
            <p className="panel-warning" role="status" data-testid="rul-alert">
              {t('warning', { days: formatDays(earliest) })}
            </p>
          )}
          {outcome.level === 'critical' && estimate.status !== 'limit_reached' && earliest !== null && (
            <p className="panel-error" role="alert" data-testid="rul-alert">
              {t('critical', { days: formatDays(earliest) })}
            </p>
          )}
          <p className="rul-disclaimer">{t('disclaimer')}</p>
        </div>
      )}
    </section>
  )
}
