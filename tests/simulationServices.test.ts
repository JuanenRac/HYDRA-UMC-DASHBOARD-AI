// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/simulationServices.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// @vitest-environment node
//
// Simulation bench, failure and recovery of the services around the dashboard. A real HTTP server on a loopback port plays the data lake, the anomaly detector and
// the fleet view, and goes wrong on command (the connection is cut, an error status, text that is not JSON, a shape nobody promised, a detector that is not fitted
// yet, a service that hangs). The order of the failures is drawn from a fixed seed. What must hold: every failure comes out as the error of that client with the
// reason in it, never as an unhandled rejection or a silent empty answer, and the next call after the service is back works as if nothing had happened. A language
// model that fails in each of its ways must always end in the statistical sentence, with the reason. Nothing here says how a real plant, a real data lake or a real
// model behave: that needs the plant.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { DatalakeApiError, queryDatalake } from '../src/api/datalakeClient'
import { AnomalyApiError, detectAnomaly, fetchDetectorStats } from '../src/api/anomalyClient'
import { fetchFleet } from '../src/api/fleetClient'
import { safeGenerateNarrative, type AiProvider, type NarrativeRequest } from '../src/lib/aiProvider'

const SEED = 20260101

function generator(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Mode = 'ok' | 'down' | 'http500' | 'badjson' | 'nonarray' | 'badpoint' | 'notfitted' | 'badshape' | 'hang' | 'forbidden' | 'off'

let server: Server
let mode: Mode = 'ok'
let calls = 0

const POINTS = [
  { sourceId: 'press-1', kind: 'temperature', field: 'value', timestamp: 1_800_000_000_000, value: 41.5 },
  { sourceId: 'press-1', kind: 'temperature', field: 'value', timestamp: 1_800_000_060_000, value: 42.5 },
  { sourceId: 'press-1', kind: 'temperature', field: 'value', timestamp: 1_800_000_120_000, value: 43.5 },
]
const FLEET = {
  series: [{ sourceId: 'press-1', kind: 'temperature', field: 'value', windowsScored: 3, lastScore: 0.2, lastTimestamp: 1, anomalous: false, threshold: 1, driftRatio: 0.1 }],
  driftRatioLimit: 2,
  maintenanceMode: 'off',
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' })
  res.end(JSON.stringify(body))
}

function handler(req: IncomingMessage, res: ServerResponse): void {
  calls += 1
  const path = (req.url ?? '').split('?')[0]
  if (mode === 'down') return void req.socket.destroy()
  if (mode === 'hang') return // the connection stays open and nothing is ever written
  if (mode === 'http500') return json(res, 500, { error: 'boom' })
  if (mode === 'forbidden') return json(res, 403, { error: 'no' })
  if (mode === 'off') return json(res, 404, { error: 'off' })
  if (mode === 'badjson') {
    res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' })
    return void res.end('{"series": [')
  }
  if (path === '/query') {
    if (mode === 'nonarray') return json(res, 200, { points: [] })
    if (mode === 'badpoint') return json(res, 200, [POINTS[0], { ...POINTS[1], value: 'warm' }])
    return json(res, 200, POINTS)
  }
  if (path === '/fleet') return json(res, 200, mode === 'badshape' ? { series: 'none' } : FLEET)
  if (path === '/stats') return json(res, 200, mode === 'badshape' ? { fitted: 'yes' } : { fitted: mode !== 'notfitted' })
  if (path === '/detect') {
    if (mode === 'notfitted') return json(res, 409, { error: 'detector not fitted yet' })
    if (mode === 'badshape') return json(res, 200, { score: 0.5, anomalous: 'maybe', worstBinFreqHz: 50 })
    return json(res, 200, { score: 0.5, anomalous: false, worstBinFreqHz: 50 })
  }
  return json(res, 404, { error: 'unknown' })
}

async function listen(): Promise<string> {
  mode = 'ok'
  calls = 0
  server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
}

afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

/** The failures of a service, in an order drawn from the seed, with an equal number of each. */
function drawn<T>(items: readonly T[], rounds: number, seed: number): T[] {
  const random = generator(seed)
  const all = Array.from({ length: rounds }, () => items).flat()
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
}

describe('the data lake that goes wrong and comes back', () => {
  const FAILURES: ReadonlyArray<[Mode, RegExp]> = [
    ['down', /could not reach DATALAKE/],
    ['http500', /HTTP 500/],
    ['badjson', /not valid JSON/],
    ['nonarray', /non-array/],
    ['badpoint', /invalid value/],
    ['forbidden', /HTTP 403/],
  ]

  it('names each failure in the error of the client and answers again at the next call, in any order', async () => {
    const base = await listen()
    for (const [failure, pattern] of drawn(FAILURES, 4, SEED)) {
      mode = failure
      const error = await queryDatalake(base, { sourceId: 'press-1' }).then(() => null, (e: unknown) => e)
      expect(error, failure).toBeInstanceOf(DatalakeApiError)
      expect((error as DatalakeApiError).message).toMatch(pattern)
      mode = 'ok'
      const points = await queryDatalake(base, { sourceId: 'press-1' })
      expect(points.map((p) => p.value)).toEqual([41.5, 42.5, 43.5])
    }
  })

  it('never turns a failure into an empty answer', async () => {
    const base = await listen()
    for (const [failure] of FAILURES) {
      mode = failure
      await expect(queryDatalake(base, {}), failure).rejects.toBeInstanceOf(DatalakeApiError)
    }
  })

  it('reaches nothing at an address where no service is listening, and says so', async () => {
    const base = await listen()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await expect(queryDatalake(base, {})).rejects.toThrow(/could not reach DATALAKE/)
    // the service comes back on a new port: the client keeps no memory of the lost one
    const again = await listen()
    expect((await queryDatalake(again, {})).length).toBe(3)
  })
})

describe('the anomaly detector that is not ready, goes wrong and comes back', () => {
  it('says that it is not fitted yet with the status of the detector, and scores once it is', async () => {
    const base = await listen()
    mode = 'notfitted'
    expect(await fetchDetectorStats(base)).toEqual({ fitted: false })
    const refused = await detectAnomaly(base, [1, 2, 3]).then(() => null, (e: unknown) => e)
    expect(refused).toBeInstanceOf(AnomalyApiError)
    expect((refused as AnomalyApiError).status).toBe(409)
    mode = 'ok'
    expect(await fetchDetectorStats(base)).toEqual({ fitted: true })
    expect(await detectAnomaly(base, [1, 2, 3])).toEqual({ score: 0.5, anomalous: false, worstBinFreqHz: 50 })
  })

  it('names each failure in the error of the client and answers again at the next call, in any order', async () => {
    const base = await listen()
    const failures: ReadonlyArray<[Mode, RegExp]> = [
      ['down', /could not reach/],
      ['http500', /boom/],
      ['badjson', /not valid JSON/],
      ['badshape', /anomalous/],
    ]
    for (const [failure, pattern] of drawn(failures, 4, SEED + 1)) {
      mode = failure
      const error = await detectAnomaly(base, [1, 2, 3]).then(() => null, (e: unknown) => e)
      expect(error, failure).toBeInstanceOf(AnomalyApiError)
      expect((error as AnomalyApiError).message).toMatch(pattern)
      mode = 'ok'
      expect((await detectAnomaly(base, [1, 2, 3])).anomalous).toBe(false)
    }
  })
})

describe('the fleet view that goes wrong and comes back', () => {
  it('gives each failure its own reason and the view again at the next call, in any order', async () => {
    const base = await listen()
    const failures: ReadonlyArray<[Mode, string]> = [
      ['down', 'unreachable'],
      ['hang', 'timeout'],
      ['http500', 'http'],
      ['forbidden', 'auth'],
      ['off', 'off'],
      ['badjson', 'invalid'],
      ['badshape', 'invalid'],
    ]
    for (const [failure, reason] of drawn(failures, 3, SEED + 2)) {
      mode = failure
      const outcome = await fetchFleet(base, 150)
      expect(outcome, failure).toMatchObject({ state: 'failed', reason })
      server.closeAllConnections() // the hung request of the round goes away with its client
      mode = 'ok'
      const view = await fetchFleet(base, 2000)
      expect(view.state).toBe('ok')
      if (view.state === 'ok') expect(view.view.rows.map((r) => r.sourceId)).toEqual(['press-1'])
    }
  })

  it('waits for the hung service no longer than the time it was given', async () => {
    const base = await listen()
    mode = 'hang'
    const started = Date.now()
    expect(await fetchFleet(base, 100)).toMatchObject({ state: 'failed', reason: 'timeout' })
    expect(Date.now() - started).toBeLessThan(3000)
    expect(calls).toBe(1)
  })
})

describe('the language model that fails in each of its ways', () => {
  const request: NarrativeRequest = {
    sourceId: 'press-1',
    kind: 'temperature',
    field: 'value',
    summary: { count: 120, min: 40.5, minTimestamp: 1, max: 61.25, maxTimestamp: 2, average: 50.75, latest: 55.5, latestTimestamp: 3, direction: 'up' },
  }
  const GOOD = 'The press temperature: 120 samples between 40.5 and 61.25, average 50.75, latest 55.5.'

  type Behaviour = { name: string; provider: AiProvider; expect: 'ai' | 'unavailable' | 'unverified' }
  const provider = (name: string, answer: () => Promise<unknown>): AiProvider => ({ name, generateNarrative: answer as AiProvider['generateNarrative'] })
  const BEHAVIOURS: Behaviour[] = [
    { name: 'answers right', provider: provider('right', async () => ({ narrative: GOOD, generatedBy: 'ai' })), expect: 'ai' },
    { name: 'throws', provider: provider('throws', async () => { throw new Error('connection reset') }), expect: 'unavailable' },
    { name: 'answers nothing', provider: provider('nothing', async () => undefined), expect: 'unavailable' },
    { name: 'answers an empty text', provider: provider('empty', async () => ({ narrative: '   ', generatedBy: 'ai' })), expect: 'unavailable' },
    { name: 'answers a text that is too long', provider: provider('long', async () => ({ narrative: 'x'.repeat(2001), generatedBy: 'ai' })), expect: 'unavailable' },
    { name: 'answers with a control character', provider: provider('control', async () => ({ narrative: 'ok‮evil', generatedBy: 'ai' })), expect: 'unavailable' },
    { name: 'claims a label nobody has', provider: provider('label', async () => ({ narrative: GOOD, generatedBy: 'oracle' })), expect: 'unavailable' },
    { name: 'invents a figure', provider: provider('invents', async () => ({ narrative: 'Latest 55.5, peak 99.9.', generatedBy: 'ai' })), expect: 'unverified' },
  ]

  it('always ends in a sentence, the statistical one with its reason unless the model was right, in any order', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      for (const behaviour of drawn(BEHAVIOURS, 5, SEED + 3)) {
        const answer = await safeGenerateNarrative(behaviour.provider, request)
        expect(answer.narrative.length, behaviour.name).toBeGreaterThan(0)
        if (behaviour.expect === 'ai') {
          expect(answer, behaviour.name).toEqual({ narrative: GOOD, generatedBy: 'ai' })
        } else {
          expect(answer.generatedBy, behaviour.name).toBe('statistical-fallback')
          expect(answer.fallbackReason, behaviour.name).toBe(behaviour.expect)
          expect(answer.narrative, behaviour.name).toContain('120 sample(s)')
        }
      }
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('goes back to the model when it recovers, without remembering the failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      let healthy = false
      const flaky: AiProvider = {
        name: 'flaky',
        async generateNarrative() {
          if (!healthy) throw new Error('503')
          return { narrative: GOOD, generatedBy: 'ai' }
        },
      }
      expect((await safeGenerateNarrative(flaky, request)).fallbackReason).toBe('unavailable')
      expect((await safeGenerateNarrative(flaky, request)).fallbackReason).toBe('unavailable')
      healthy = true
      expect(await safeGenerateNarrative(flaky, request)).toEqual({ narrative: GOOD, generatedBy: 'ai' })
    } finally {
      vi.restoreAllMocks()
    }
  })
})
