// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/aiFeatures.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The language-model sentence, the Fleet card and the embedded mode: all off by default, each against a simulated service. The
// "cognitive node" here is a stand-in that answers like the simulator of HYDRA-UMC-COGNITIVE-NODE (faithful or altered); nothing
// here has run against a Hailo accelerator.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { createCognitiveProvider } from '../src/api/cognitiveClient'
import { fetchFleet, validateFleetView } from '../src/api/fleetClient'
import { FleetPanel, fleetState, sortFleet } from '../src/components/FleetPanel'
import { TrendSummaryPanel } from '../src/components/TrendSummaryPanel'
import { AI_KEYS, AI_TEXTS, at } from '../src/lib/aiTexts'
import { AI_DEFAULTS, defaultCognitiveUrl, readAiFeatures } from '../src/lib/aiConfig'
import { EMBED_MESSAGE_TYPE, isEmbedRequested, postHeight } from '../src/lib/embed'
import { LANGUAGES } from '../src/lib/i18n'
import { TOKEN_KEY } from '../src/lib/session'
import type { FleetRow } from '../src/api/fleetClient'

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const REQUEST = {
  sourceId: 'robot-1', kind: 'motor_temp', field: 'value',
  summary: { count: 5, min: 10, max: 30, average: 20, latest: 30, direction: 'up' as const, minTimestamp: 1, maxTimestamp: 5, latestTimestamp: 5 },
}

// ------------------------------------------------------------------------------------------------------------ configuration
describe('readAiFeatures', () => {
  it('is all off by default and points at the relay that fits the way the page is served', () => {
    const features = readAiFeatures({}, false)
    expect(features).toEqual({
      cognitiveEnabled: false, cognitiveUrl: '/api/cognitive', cognitiveTimeoutMs: AI_DEFAULTS.cognitiveTimeoutMs,
      fleetEnabled: false, fleetRefreshMs: AI_DEFAULTS.fleetRefreshMs,
    })
    expect(readAiFeatures({}, true).cognitiveUrl).toBe(defaultCognitiveUrl(true))
  })

  it('switches on only with the exact word true', () => {
    expect(readAiFeatures({ VITE_COGNITIVE_ENABLED: 'TRUE', VITE_FLEET_ENABLED: '1' }, false)).toMatchObject({ cognitiveEnabled: false, fleetEnabled: false })
    expect(readAiFeatures({ VITE_COGNITIVE_ENABLED: 'true', VITE_FLEET_ENABLED: 'true' }, false)).toMatchObject({ cognitiveEnabled: true, fleetEnabled: true })
  })

  it('falls back to the default for an unusable number, and 0 means manual refresh', () => {
    expect(readAiFeatures({ VITE_FLEET_REFRESH_MS: 'soon', VITE_COGNITIVE_TIMEOUT_MS: '5' }, false)).toMatchObject({ fleetRefreshMs: 15_000, cognitiveTimeoutMs: 20_000 })
    expect(readAiFeatures({ VITE_FLEET_REFRESH_MS: '0' }, false).fleetRefreshMs).toBe(0)
    expect(readAiFeatures({ VITE_FLEET_REFRESH_MS: '30000', VITE_COGNITIVE_URL: 'http://node:8096' }, false)).toMatchObject({ fleetRefreshMs: 30_000, cognitiveUrl: 'http://node:8096' })
  })
})

describe('the texts', () => {
  it('exist in the eight languages for every key, with the same placeholders', () => {
    for (const lang of LANGUAGES) {
      for (const key of AI_KEYS) {
        expect(AI_TEXTS[lang][key], `${lang}.${key}`).toBeTruthy()
        const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
        expect(names(AI_TEXTS[lang][key]), `${lang}.${key} placeholders`).toEqual(names(AI_TEXTS.en[key]))
      }
    }
  })

  it('uses European Portuguese', () => {
    expect(at('pt', 'fleetLoading')).toBe('A carregar…')
    expect(at('pt', 'fleetErrOff')).toContain('desligada')
  })
})

// ------------------------------------------------------------------------------------------------------------ the language model
describe('createCognitiveProvider', () => {
  it('sends numbers and identifiers only and takes back the sentence', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { narrative: '5 samples, latest 30.00', backend: 'simulator' }))
    const result = await createCognitiveProvider('/api/cognitive', 'es').generateNarrative(REQUEST)
    expect(result).toEqual({ narrative: '5 samples, latest 30.00', generatedBy: 'ai' })
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/cognitive\/narrative$/)
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      sourceId: 'robot-1', kind: 'motor_temp', field: 'value', count: 5, min: 10, max: 30, average: 20, latest: 30, direction: 'up', language: 'es',
    })
  })

  it('presents the session only to a same-origin address', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'session-token')
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { narrative: 'x' }))
    await createCognitiveProvider('/api/ai/cognitive-node', 'en').generateNarrative(REQUEST)
    await createCognitiveProvider('http://node.example:8096', 'en').generateNarrative(REQUEST)
    const header = (call: number) => ((spy.mock.calls[call][1] as RequestInit).headers as Record<string, string>).Authorization
    expect(header(0)).toBe('Bearer session-token')
    expect(header(1)).toBeUndefined()
  })

  it.each([
    ['an error status', () => json(503, { error: 'not available' })],
    ['an answer without a narrative', () => json(200, { backend: 'simulator' })],
    ['an answer that is not JSON', () => new Response('<html>', { status: 200 })],
  ])('fails with a provider error on %s, and the gate shows the statistical sentence', async (_name, answer) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(answer())
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { safeGenerateNarrative } = await import('../src/lib/aiProvider')
    const result = await safeGenerateNarrative(createCognitiveProvider('/api/cognitive', 'en'), REQUEST)
    expect(result.generatedBy).toBe('statistical-fallback')
    expect(result.fallbackReason).toBe('unavailable')
  })

  it('refuses an address with credentials', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    await expect(createCognitiveProvider('http://user:pw@node:8096', 'en').generateNarrative(REQUEST)).rejects.toThrow(/credentials/)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('the Trend Summary with a language model', () => {
  const POINTS = [10, 15, 20, 25, 30].map((value, index) => ({ sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 1000 + index, value }))

  function fetchStub(narrative: string, narrativeStatus = 200) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/narrative')) return narrativeStatus === 200 ? json(200, { narrative }) : json(narrativeStatus, { error: 'busy' })
      return json(200, POINTS)
    })
  }

  async function run(narrative: string, status = 200) {
    fetchStub(narrative, status)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<TrendSummaryPanel datalakeBaseUrl="/api/datalake" provider={createCognitiveProvider('/api/cognitive', 'en')} lang="en" />)
    await userEvent.click(screen.getByRole('button', { name: /fetch summary/i }))
    return screen.findByTestId('trend-narrative')
  }

  it('shows the sentence of the model, labeled, when its numbers are the summary', async () => {
    const node = await run('5 samples from 10.00 to 30.00, average 20.00, latest 30.00.')
    expect(node).toHaveTextContent('AI, numbers checked')
    expect(node).toHaveTextContent('5 samples from 10.00 to 30.00')
    expect(screen.queryByTestId('trend-narrative-reason')).toBeNull()
  })

  it('shows the statistical sentence and says why when the model wrote another number', async () => {
    const node = await run('5 samples, latest 31.00.')
    expect(node).toHaveTextContent('Statistical fallback')
    expect(node).toHaveTextContent('latest 30.00')
    expect(screen.getByTestId('trend-narrative-reason')).toHaveTextContent('not in the summary')
  })

  it('shows the statistical sentence and says why when the node does not answer', async () => {
    const node = await run('', 503)
    expect(node).toHaveTextContent('Statistical fallback')
    expect(screen.getByTestId('trend-narrative-reason')).toHaveTextContent('did not answer')
  })

  it('says it in the language of the reader', async () => {
    fetchStub('', 503)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<TrendSummaryPanel datalakeBaseUrl="/api/datalake" provider={createCognitiveProvider('/api/cognitive', 'pt')} lang="pt" />)
    await userEvent.click(screen.getByRole('button', { name: /fetch summary/i }))
    expect(await screen.findByTestId('trend-narrative-reason')).toHaveTextContent('não respondeu')
  })
})

// ------------------------------------------------------------------------------------------------------------ the Fleet card
const row = (over: Partial<FleetRow>): FleetRow => ({
  sourceId: 'm', kind: 'vibration', field: 'value', windowsScored: 10, lastScore: 1, lastTimestamp: 1_700_000_000_000, anomalous: false, threshold: 4,
  driftRatio: 1, drifted: false, driftSustained: false, driftSince: null, proposalsSent: 0, ...over,
})

const FLEET_BODY = {
  driftRatioLimit: 2, driftWindow: 20, maintenanceMode: 'propose',
  series: [
    { sourceId: 'ok-1', kind: 'vibration', field: 'value', windowsScored: 40, lastScore: 0.9, lastTimestamp: 1_700_000_000_000, anomalous: false, threshold: 4, driftRatio: 1.1, drifted: false, driftSustained: false, driftSince: null, proposalsSent: 0 },
    { sourceId: 'worn-2', kind: 'vibration', field: 'value', windowsScored: 90, lastScore: 3.2, lastTimestamp: 1_700_000_100_000, anomalous: false, threshold: 4, driftRatio: 3.4, drifted: true, driftSustained: true, driftSince: 1_699_999_000_000, proposalsSent: 1 },
    { sourceId: 'new-3', kind: 'vibration', field: 'value', windowsScored: 0, lastScore: null, lastTimestamp: null, anomalous: null, threshold: null, driftRatio: null, drifted: false, driftSustained: false, driftSince: null },
    { nonsense: true },
  ],
}

describe('the Fleet view', () => {
  it('orders the states with the worst first', () => {
    const rows = sortFleet([row({ sourceId: 'b' }), row({ sourceId: 'a', lastScore: null }), row({ sourceId: 'c', drifted: true }), row({ sourceId: 'd', driftSustained: true, drifted: true }), row({ sourceId: 'e', anomalous: true })])
    expect(rows.map((r) => fleetState(r))).toEqual(['sustained', 'drifted', 'anomalous', 'normal', 'nodata'])
  })

  it('reads the answer row by row and counts what it cannot read', () => {
    const view = validateFleetView(FLEET_BODY)
    expect(view?.rows).toHaveLength(3)
    expect(view?.skipped).toBe(1)
    expect(view?.maintenanceMode).toBe('propose')
    expect(validateFleetView({ series: 'no' })).toBeNull()
    expect(validateFleetView([])).toBeNull()
  })

  it.each([
    [404, 'off'], [401, 'auth'], [403, 'auth'], [500, 'http'],
  ])('maps HTTP %i to the reason %s', async (status, reason) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(status, { error: 'x' }))
    expect(await fetchFleet('/api/anomaly')).toMatchObject({ state: 'failed', reason })
  })

  it('maps an unreachable detector, a bad address and a body that is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'))
    expect(await fetchFleet('/api/anomaly')).toMatchObject({ reason: 'unreachable' })
    expect(await fetchFleet('http://user:pw@host')).toMatchObject({ reason: 'invalid' })
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 200 }))
    expect(await fetchFleet('/api/anomaly')).toMatchObject({ reason: 'invalid' })
  })

  it('shows one row per series with the state and the proposals, and the notes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, FLEET_BODY))
    render(<FleetPanel anomalyBaseUrl="/api/anomaly" refreshMs={0} lang="en" />)
    const table = await screen.findByTestId('fleet-table')
    const rows = table.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute('data-state', 'sustained')
    expect(rows[0]).toHaveTextContent('worn-2/vibration/value')
    expect(rows[0]).toHaveTextContent('3.40x')
    expect(rows[0]).toHaveTextContent('Maintenance proposed (1)')
    expect(rows[2]).toHaveAttribute('data-state', 'nodata')
    expect(screen.getByText(/only proposes a maintenance order/)).toBeInTheDocument()
    expect(screen.getByText(/1 rows of the answer/)).toBeInTheDocument()
  })

  it('says in the language of the reader that the detector has the view off', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(404, { error: 'not found' }))
    render(<FleetPanel anomalyBaseUrl="/api/anomaly" refreshMs={0} lang="de" />)
    expect(await screen.findByTestId('fleet-error')).toHaveTextContent('Flottenansicht ausgeschaltet')
  })

  it('refreshes on its own only when asked to, and stops when it goes away', async () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { series: [] }))
    const { unmount } = render(<FleetPanel anomalyBaseUrl="/api/anomaly" refreshMs={5000} lang="en" />)
    await vi.advanceTimersByTimeAsync(0)
    expect(spy).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(spy).toHaveBeenCalledTimes(2)
    unmount()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(spy).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

// ------------------------------------------------------------------------------------------------------------ the page
describe('App', () => {
  const OFF = readAiFeatures({}, false)

  it('with the defaults has no Fleet card and asks nothing', () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    render(<App ai={OFF} search="" />)
    expect(screen.queryByTestId('fleet-panel')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows the Fleet card when the build switches it on', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { series: [] }))
    render(<App ai={{ ...OFF, fleetEnabled: true, fleetRefreshMs: 0 }} search="" />)
    expect(await screen.findByTestId('fleet-panel')).toBeInTheDocument()
  })

  it('embedded: no heading of its own, the same panels', () => {
    render(<App ai={OFF} search="?embed=1" />)
    expect(screen.queryByRole('heading', { name: 'HYDRA-UMC-DASHBOARD-AI' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Trend Summary' })).toBeInTheDocument()
    expect(document.querySelector('main.app-embedded')).not.toBeNull()
  })

  it('not embedded: the heading stays', () => {
    render(<App ai={OFF} search="?embed=0" />)
    expect(screen.getByRole('heading', { name: 'HYDRA-UMC-DASHBOARD-AI' })).toBeInTheDocument()
  })
})

describe('the embedded mode', () => {
  it('is asked for only with embed=1', () => {
    expect(isEmbedRequested('?embed=1')).toBe(true)
    expect(isEmbedRequested('?embed=true')).toBe(false)
    expect(isEmbedRequested('')).toBe(false)
  })

  it('tells the frame the height, to the origin of the page and not to anyone', () => {
    const parent = { postMessage: vi.fn() }
    const win = { parent, self: {}, location: { origin: 'https://cm5.local' } } as unknown as Window
    expect(postHeight(420.2, win)).toBe(true)
    expect(parent.postMessage).toHaveBeenCalledWith({ type: EMBED_MESSAGE_TYPE, height: 421 }, 'https://cm5.local')
  })

  it('sends nothing outside a frame or for a height that is not one', () => {
    const self = {}
    const alone = { parent: self, self, location: { origin: 'https://cm5.local' } } as unknown as Window
    expect(postHeight(300, alone)).toBe(false)
    const parent = { postMessage: vi.fn() }
    const framed = { parent, self: {}, location: { origin: 'https://cm5.local' } } as unknown as Window
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e9]) expect(postHeight(bad, framed)).toBe(false)
    expect(parent.postMessage).not.toHaveBeenCalled()
  })
})

