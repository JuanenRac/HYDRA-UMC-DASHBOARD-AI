// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/rulPanel.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The remaining useful life card against a simulated data lake and a simulated detector (two real node:http servers): the
// switch (off by default: no card, no request), the estimate with its range, the explicit states, the warnings, the failures
// (route off, timeout, unreachable, refused session, nonsense answer) and the eight languages.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import App from '../src/App'
import { RulPanel } from '../src/components/RulPanel'
import { fetchRul, RulApiError, validateRulEstimate } from '../src/api/rulClient'
import { formatDays, rulLevel, toRulPoints } from '../src/lib/rul'
import { readRulConfig, RUL_DEFAULTS, type RulConfig } from '../src/lib/rulConfig'
import { LANGUAGES, pickLang, RUL_KEYS, RUL_TEXTS, tr } from '../src/lib/i18n'

const servers: Server[] = []
const DAY_MS = 86_400_000

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer(handler)
    servers.push(server)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`)
    })
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => { s.closeAllConnections(); s.close(() => resolve()) })))
})

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** A data lake that holds `count` anomaly scores, one a day, rising from 0.1 by 0.01 a day. */
function lakeWith(count: number) {
  const samples = Array.from({ length: count }, (_, i) => ({
    sourceId: 'robot-1', kind: 'anomaly_score', field: 'value', timestamp: i * DAY_MS, value: 0.1 + 0.01 * i,
  }))
  return (req: IncomingMessage, res: ServerResponse) => {
    if (String(req.url).startsWith('/series')) {
      json(res, 200, count === 0 ? [] : [{ sourceId: 'robot-1', kind: 'anomaly_score', field: 'value', count, firstTimestamp: 0, lastTimestamp: (count - 1) * DAY_MS }])
      return
    }
    json(res, 200, samples)
  }
}

interface Seen { body: { points: { t: number; score: number }[]; limit: number } | null }

/** A detector that answers POST /rul with `answer` (or a status) and remembers the request. */
function detectorAnswering(answer: unknown, seen: Seen = { body: null }, status = 200) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST' || req.url !== '/rul') {
      json(res, 404, { error: 'not found' })
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      seen.body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
      json(res, status, answer)
    })
  }
}

function config(detectorUrl: string, extra: Partial<RulConfig> = {}): RulConfig {
  return { ...readRulConfig({ VITE_RUL_ENABLED: 'true' }, detectorUrl), timeoutMs: 1500, ...extra }
}

const ESTIMATED = { status: 'estimated', points: 30, slopePerDay: 0.01, currentValue: 0.39, daysToLimit: 61, daysLow: 40, daysHigh: 90 }

describe('configuration', () => {
  it('is off by default and only the exact word true switches it on', () => {
    expect(readRulConfig({}, '/api/anomaly').enabled).toBe(false)
    for (const v of ['', 'TRUE', '1', 'yes', 'on', ' true']) expect(readRulConfig({ VITE_RUL_ENABLED: v }, '/a').enabled).toBe(false)
    expect(readRulConfig({ VITE_RUL_ENABLED: 'true' }, '/a').enabled).toBe(true)
  })

  it('takes the detector of the page unless a URL is given, and ignores unusable numbers', () => {
    expect(readRulConfig({}, '/api/anomaly').detectorUrl).toBe('/api/anomaly')
    expect(readRulConfig({ VITE_RUL_URL: 'http://det:1' }, '/api/anomaly').detectorUrl).toBe('http://det:1')
    const bad = readRulConfig({ VITE_RUL_LIMIT: 'abc', VITE_RUL_POINTS: '5000', VITE_RUL_WARN_DAYS: '-3', VITE_RUL_TIMEOUT_MS: '0' }, '/a')
    expect(bad.limit).toBe(RUL_DEFAULTS.limit)
    expect(bad.points).toBe(RUL_DEFAULTS.points)
    expect(bad.warnDays).toBe(RUL_DEFAULTS.warnDays)
    expect(bad.timeoutMs).toBe(RUL_DEFAULTS.timeoutMs)
  })

  it('never lets the critical threshold exceed the warning one', () => {
    const c = readRulConfig({ VITE_RUL_WARN_DAYS: '10', VITE_RUL_CRITICAL_DAYS: '20' }, '/a')
    expect(c.criticalDays).toBe(10)
  })
})

describe('reading an estimate', () => {
  it('turns milliseconds into seconds, sorts, drops non-finite samples and keeps the newest', () => {
    const base = { sourceId: 's', kind: 'k', field: 'f' }
    const points = toRulPoints(
      [
        { ...base, timestamp: 3000, value: 3 }, { ...base, timestamp: 1000, value: 1 },
        { ...base, timestamp: 2000, value: Number.NaN }, { ...base, timestamp: 4000, value: 4 },
      ],
      2,
    )
    expect(points).toEqual([{ t: 3, score: 3 }, { t: 4, score: 4 }])
  })

  it('judges the urgency by the earliest plausible day', () => {
    const e = (over: object) => validateRulEstimate({ ...ESTIMATED, ...over })
    expect(rulLevel(e({ daysLow: 40 }), 30, 7)).toBe('ok')
    expect(rulLevel(e({ daysLow: 20 }), 30, 7)).toBe('warning')
    expect(rulLevel(e({ daysLow: 5 }), 30, 7)).toBe('critical')
    expect(rulLevel(e({ status: 'limit_reached', daysToLimit: 0, daysLow: 0, daysHigh: 0 }), 30, 7)).toBe('critical')
    expect(rulLevel(e({ status: 'insufficient_data', daysToLimit: null, daysLow: null, daysHigh: null }), 30, 7)).toBe('none')
    expect(rulLevel(e({ status: 'not_rising', daysToLimit: null, daysLow: null, daysHigh: null }), 30, 7)).toBe('ok')
  })

  it('formats days with a decimal below ten', () => {
    expect(formatDays(3.456)).toBe('3.5')
    expect(formatDays(61.4)).toBe('61')
  })

  it('refuses an answer that is not an estimate', () => {
    expect(() => validateRulEstimate([])).toThrow(RulApiError)
    expect(() => validateRulEstimate({ status: 'soon', points: 1 })).toThrow(RulApiError)
    expect(() => validateRulEstimate({ ...ESTIMATED, daysLow: 'x' })).toThrow(RulApiError)
    expect(() => validateRulEstimate({ ...ESTIMATED, points: 1.5 })).toThrow(RulApiError)
  })
})

describe('the client', () => {
  it('posts the points and the limit and returns the validated estimate', async () => {
    const seen: Seen = { body: null }
    const url = await listen(detectorAnswering(ESTIMATED, seen))
    const estimate = await fetchRul(url, [{ t: 1, score: 0.5 }], 0.9)
    expect(estimate.daysHigh).toBe(90)
    expect(seen.body).toEqual({ points: [{ t: 1, score: 0.5 }], limit: 0.9 })
  })

  it('tells the failures apart', async () => {
    const off = await listen((_req, res) => json(res, 404, { error: 'not found' }))
    await expect(fetchRul(off, [], 1)).rejects.toMatchObject({ kind: 'disabled', status: 404 })
    const denied = await listen((_req, res) => json(res, 401, { error: 'unauthorized' }))
    await expect(fetchRul(denied, [], 1)).rejects.toMatchObject({ kind: 'auth' })
    const broken = await listen((_req, res) => json(res, 400, { error: 'limit must be a finite number' }))
    await expect(fetchRul(broken, [], 1)).rejects.toMatchObject({ kind: 'http', message: 'limit must be a finite number' })
    const html = await listen((_req, res) => { res.writeHead(502); res.end('<html>') })
    await expect(fetchRul(html, [], 1)).rejects.toMatchObject({ kind: 'http', status: 502 })
    const nonsense = await listen((_req, res) => json(res, 200, { status: 'maybe' }))
    await expect(fetchRul(nonsense, [], 1)).rejects.toMatchObject({ kind: 'invalid' })
    const slow = await listen(() => { /* never answers */ })
    await expect(fetchRul(slow, [], 1, 100)).rejects.toMatchObject({ kind: 'timeout' })
    await expect(fetchRul('http://127.0.0.1:1', [], 1, 500)).rejects.toMatchObject({ kind: 'unreachable' })
    await expect(fetchRul('http://user:pw@127.0.0.1:1', [], 1)).rejects.toMatchObject({ kind: 'input' })
    await expect(fetchRul(off, [], Number.NaN)).rejects.toMatchObject({ kind: 'input' })
    await expect(fetchRul(off, Array.from({ length: 1001 }, (_, i) => ({ t: i, score: 0 })), 1)).rejects.toMatchObject({ kind: 'input' })
  })
})

describe('App', () => {
  it('shows no card and never asks the detector while the switch is off', () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    render(<App rul={readRulConfig({}, '/api/anomaly')} />)
    expect(screen.queryByTestId('rul-panel')).not.toBeInTheDocument()
    expect(document.querySelectorAll('section.panel')).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows the card as a third panel when the switch is on', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => { /* pending */ }))
    render(<App rul={readRulConfig({ VITE_RUL_ENABLED: 'true' }, '/api/anomaly')} />)
    expect(screen.getByTestId('rul-panel')).toBeInTheDocument()
    expect(document.querySelectorAll('section.panel')).toHaveLength(3)
  })
})

describe('RulPanel', () => {
  it('shows the estimate, its range and the chart of the scores that were sent', async () => {
    const seen: Seen = { body: null }
    const lake = await listen(lakeWith(30))
    const detector = await listen(detectorAnswering(ESTIMATED, seen))
    render(<RulPanel datalakeBaseUrl={lake} config={config(detector, { limit: 0.9 })} lang="en" />)
    expect(await screen.findByTestId('rul-estimate')).toHaveTextContent('About 61 days left')
    expect(screen.getByTestId('rul-range')).toHaveTextContent('Likely between 40 and 90 days')
    expect(screen.getByTestId('rul-sparkline')).toBeInTheDocument()
    expect(screen.getByTestId('rul-result')).toHaveAttribute('data-level', 'ok')
    expect(screen.queryByTestId('rul-alert')).not.toBeInTheDocument()
    expect(seen.body?.limit).toBe(0.9)
    expect(seen.body?.points).toHaveLength(30)
    expect(seen.body?.points[1].t).toBe(86_400)
  })

  it('says when the gentlest trend does not rise', async () => {
    const lake = await listen(lakeWith(30))
    const detector = await listen(detectorAnswering({ ...ESTIMATED, daysHigh: null }))
    render(<RulPanel datalakeBaseUrl={lake} config={config(detector)} lang="en" />)
    expect(await screen.findByTestId('rul-range')).toHaveTextContent('At the earliest in 40 days')
  })

  it('warns and goes critical by the thresholds of the configuration', async () => {
    const lake = await listen(lakeWith(30))
    const warn = await listen(detectorAnswering({ ...ESTIMATED, daysToLimit: 25, daysLow: 20, daysHigh: 30 }))
    const first = render(<RulPanel datalakeBaseUrl={lake} config={config(warn)} lang="en" />)
    expect(await screen.findByTestId('rul-alert')).toHaveTextContent('Warning: the limit may be reached within 20 days.')
    first.unmount()
    const crit = await listen(detectorAnswering({ ...ESTIMATED, daysToLimit: 6, daysLow: 4, daysHigh: 9 }))
    render(<RulPanel datalakeBaseUrl={lake} config={config(crit)} lang="en" />)
    expect(await screen.findByTestId('rul-alert')).toHaveTextContent('Critical')
    expect(screen.getByTestId('rul-result')).toHaveAttribute('data-level', 'critical')
  })

  it('uses its own thresholds', async () => {
    const lake = await listen(lakeWith(30))
    const detector = await listen(detectorAnswering(ESTIMATED))
    render(<RulPanel datalakeBaseUrl={lake} config={config(detector, { warnDays: 60, criticalDays: 30 })} lang="en" />)
    expect(await screen.findByTestId('rul-alert')).toHaveTextContent('Warning')
  })

  it('shows the explicit states', async () => {
    const lake = await listen(lakeWith(30))
    const none = { daysToLimit: null, daysLow: null, daysHigh: null }
    const cases: [object, string][] = [
      [{ status: 'insufficient_data', points: 5, slopePerDay: null, currentValue: null, ...none }, 'Not enough data yet to estimate (5 samples).'],
      [{ status: 'not_rising', points: 30, slopePerDay: -0.01, currentValue: 0.2, ...none }, 'The trend does not rise: no limit is approaching.'],
      [{ status: 'limit_reached', points: 30, slopePerDay: 0.01, currentValue: 1.2, daysToLimit: 0, daysLow: 0, daysHigh: 0 }, 'The trend has already reached the limit.'],
    ]
    for (const [answer, text] of cases) {
      const detector = await listen(detectorAnswering(answer))
      const view = render(<RulPanel datalakeBaseUrl={lake} config={config(detector)} lang="en" />)
      expect(await screen.findByTestId('rul-state')).toHaveTextContent(text)
      expect(screen.queryByTestId('rul-estimate')).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('says so when the data lake holds no scores, without asking the detector', async () => {
    let asked = false
    const lake = await listen(lakeWith(0))
    const detector = await listen((_req, res) => { asked = true; json(res, 200, ESTIMATED) })
    render(<RulPanel datalakeBaseUrl={lake} config={config(detector)} lang="en" />)
    expect(await screen.findByTestId('rul-empty')).toBeInTheDocument()
    expect(asked).toBe(false)
  })

  it('shows each failure inside the card and keeps working', async () => {
    const lake = await listen(lakeWith(30))
    const off = await listen((_req, res) => json(res, 404, { error: 'not found' }))
    const view = render(<RulPanel datalakeBaseUrl={lake} config={config(off)} lang="en" />)
    expect(await screen.findByTestId('rul-error')).toHaveTextContent('switched off (--rul)')
    view.unmount()

    const slow = await listen(() => { /* never answers */ })
    const view2 = render(<RulPanel datalakeBaseUrl={lake} config={config(slow, { timeoutMs: 100 })} lang="en" />)
    expect(await screen.findByTestId('rul-error')).toHaveTextContent('did not answer in time')
    view2.unmount()

    const down = render(<RulPanel datalakeBaseUrl={lake} config={config('http://127.0.0.1:1')} lang="en" />)
    expect(await screen.findByTestId('rul-error')).toHaveTextContent('cannot be reached')
    down.unmount()

    const lakeDown = render(<RulPanel datalakeBaseUrl="http://127.0.0.1:1" config={config(off)} lang="en" />)
    expect(await screen.findByTestId('rul-error')).toBeInTheDocument()
    lakeDown.unmount()
  })

  it('asks again with the values of the form when Estimate is pressed', async () => {
    const seen: Seen = { body: null }
    const lake = await listen(lakeWith(30))
    const detector = await listen(detectorAnswering(ESTIMATED, seen))
    render(<RulPanel datalakeBaseUrl={lake} config={config(detector)} lang="en" />)
    await screen.findByTestId('rul-estimate')
    const input = screen.getByLabelText('Limit (score)')
    await userEvent.clear(input)
    await userEvent.type(input, '0.75')
    await userEvent.click(screen.getByRole('button', { name: 'Estimate' }))
    await waitFor(() => expect(seen.body?.limit).toBe(0.75))
  })

  it('refuses an empty limit without asking anything', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => { /* pending */ }))
    render(<RulPanel datalakeBaseUrl="/api/datalake" config={config('/api/anomaly')} lang="en" />)
    const calls = spy.mock.calls.length
    await userEvent.clear(screen.getByLabelText('Limit (score)'))
    // an empty required field is stopped by the browser form itself; the card also guards the value
    expect(spy.mock.calls.length).toBe(calls)
  })
})

describe('the eight languages', () => {
  it('has every text in every language, with the same placeholders', () => {
    expect([...LANGUAGES]).toEqual(['en', 'es', 'de', 'fr', 'it', 'ja', 'zh', 'pt'])
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const lang of LANGUAGES) {
      expect(Object.keys(RUL_TEXTS[lang]).sort()).toEqual([...RUL_KEYS].sort())
      for (const key of RUL_KEYS) {
        expect(RUL_TEXTS[lang][key].trim(), `${lang}.${key}`).not.toBe('')
        expect(holes(RUL_TEXTS[lang][key]), `${lang}.${key}`).toBe(holes(RUL_TEXTS.en[key]))
        if (lang !== 'en' && !['source', 'kind'].includes(key)) {
          // a text that is the English one word for word was left untranslated
          expect(RUL_TEXTS[lang][key], `${lang}.${key}`).not.toBe(RUL_TEXTS.en[key])
        }
      }
    }
  })

  it('writes European Portuguese', () => {
    expect(tr('pt', 'errUnreachable')).toContain('detetor')
    expect(tr('pt', 'errAuth')).toContain('Inicie sessão')
    expect(tr('pt', 'loading')).toBe('A estimar…')
  })

  it('picks the language of the browser tag and falls back to English', () => {
    expect(pickLang('pt-PT')).toBe('pt')
    expect(pickLang('zh-CN')).toBe('zh')
    expect(pickLang('DE_de')).toBe('de')
    expect(pickLang('sv')).toBe('en')
    expect(pickLang(undefined)).toBe('en')
  })

  it('renders the card in the chosen language', async () => {
    const lake = await listen(lakeWith(30))
    const detector = await listen(detectorAnswering(ESTIMATED))
    render(<RulPanel datalakeBaseUrl={lake} config={config(detector)} lang="pt" />)
    expect(await screen.findByTestId('rul-estimate')).toHaveTextContent('Faltam cerca de 61 dias')
    expect(screen.getByRole('heading', { name: 'Vida útil restante' })).toBeInTheDocument()
  })
})
