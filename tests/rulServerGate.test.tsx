// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/rulServerGate.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The card of the remaining useful life appears only when the build allows it AND the running server has it open
// (GET /api/rul/config). The matrix: build off or on, against a server that is open, closed, without the route, refusing the
// session, failing, hanging, or answering nonsense. Anything but a clear "open" leaves the card out, and a build that is off
// never asks the server at all.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import App from '../src/App'
import { RulGate } from '../src/components/RulGate'
import {
  applyServerLimits,
  fetchRulServerConfig,
  RUL_SERVER_CONFIG_PATH,
  RUL_SERVER_CLOSED,
  validateRulServerConfig,
} from '../src/api/rulServerConfigClient'
import { readRulConfig } from '../src/lib/rulConfig'
import { TOKEN_KEY } from '../src/lib/session'

const BUILD_ON = readRulConfig({ VITE_RUL_ENABLED: 'true' }, '/api/anomaly')
const BUILD_OFF = readRulConfig({}, '/api/anomaly')
const OPEN = { enabled: true, maxPoints: 500, timeoutMs: 9000 }
const DAY_MS = 86_400_000
const realFetch = globalThis.fetch.bind(globalThis)
const servers: Server[] = []

function reply(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type ServerAnswer = () => Response | Promise<Response>

const isConfigCall = (input: unknown) => String(input).endsWith(RUL_SERVER_CONFIG_PATH)

/** Answers GET /api/rul/config with `answer`; every other request (the data lake, the detector) stays pending. */
function serverAnswering(answer: ServerAnswer) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    if (isConfigCall(input)) return Promise.resolve(answer())
    return new Promise(() => { /* pending */ })
  })
}

const configCalls = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(([input]) => isConfigCall(input))
const settle = () => new Promise((resolve) => setTimeout(resolve, 40))

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

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage?.clear?.() // some Node versions expose an experimental localStorage that jsdom does not replace
})

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => { s.closeAllConnections(); s.close(() => resolve()) })))
})

describe('the validation of the answer of the server', () => {
  it('takes exactly the three fields and nothing else', () => {
    expect(validateRulServerConfig(OPEN)).toEqual(OPEN)
    expect(validateRulServerConfig({ ...OPEN, enabled: false })).toEqual({ ...OPEN, enabled: false })
    expect(validateRulServerConfig({ ...OPEN, extra: 1 })).toEqual(OPEN)
  })

  it('refuses anything that is not a clear answer', () => {
    const bad: unknown[] = [
      null, undefined, 'x', 5, [], {},
      { enabled: 'true', maxPoints: 500, timeoutMs: 9000 }, { enabled: 1, maxPoints: 500, timeoutMs: 9000 },
      { enabled: true, maxPoints: '500', timeoutMs: 9000 }, { enabled: true, maxPoints: 7, timeoutMs: 9000 },
      { enabled: true, maxPoints: 100001, timeoutMs: 9000 }, { enabled: true, maxPoints: 5.5, timeoutMs: 9000 },
      { enabled: true, maxPoints: 500, timeoutMs: 499 }, { enabled: true, maxPoints: 500, timeoutMs: 60001 },
      { enabled: true, maxPoints: 500 }, { enabled: true, timeoutMs: 9000 },
    ]
    for (const value of bad) expect(validateRulServerConfig(value), JSON.stringify(value)).toBeNull()
  })
})

describe('applying the limits of the server to the configuration of the build', () => {
  it('never sends more points than the server accepts nor waits less than the server does', () => {
    const base = { ...BUILD_ON, points: 200, timeoutMs: 5000 }
    expect(applyServerLimits(base, { enabled: true, maxPoints: 500, timeoutMs: 9000 })).toMatchObject({ points: 200, timeoutMs: 9000, enabled: true })
    expect(applyServerLimits(base, { enabled: true, maxPoints: 50, timeoutMs: 1000 })).toMatchObject({ points: 50, timeoutMs: 5000, enabled: true })
  })
})

describe('the client of GET /api/rul/config', () => {
  it('reads an open answer and sends the session of STUDIO to this origin', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'tok-123')
    const spy = serverAnswering(() => reply(200, OPEN))
    expect(await fetchRulServerConfig()).toEqual({ state: 'open', config: OPEN })
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toBe(RUL_SERVER_CONFIG_PATH)
    expect((init as RequestInit).method ?? 'GET').toBe('GET')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok-123' })
  })

  it('says closed for a server that has it off', async () => {
    serverAnswering(() => reply(200, { ...OPEN, enabled: false }))
    expect(await fetchRulServerConfig()).toEqual({ state: 'closed', reason: 'disabled' })
  })

  it('tells the reasons for closed apart and never throws', async () => {
    const cases: [string, () => Response, string][] = [
      ['no route', () => reply(404, ''), 'no_route'],
      ['no route with a body', () => reply(404, { error: 'x' }), 'no_route'],
      ['not signed in', () => reply(401, { error: 'x' }), 'auth'],
      ['refused', () => reply(403, { error: 'x' }), 'auth'],
      ['server error', () => reply(500, { error: 'x' }), 'error'],
      ['not JSON', () => reply(200, 'hello'), 'invalid'],
      ['wrong shape', () => reply(200, { enabled: true }), 'invalid'],
      ['network failure', () => { throw new TypeError('failed to fetch') }, 'error'],
    ]
    for (const [name, answer, reason] of cases) {
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        try {
          return Promise.resolve(answer())
        } catch (err) {
          return Promise.reject(err)
        }
      })
      expect(await fetchRulServerConfig(), name).toEqual({ state: 'closed', reason })
    }
  })

  it('gives up on a server that never answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    expect(await fetchRulServerConfig(RUL_SERVER_CONFIG_PATH, 60)).toEqual({ state: 'closed', reason: 'timeout' })
  })

  it('asks only a path of its own origin, with no request for any other address', async () => {
    const spy = serverAnswering(() => reply(200, OPEN))
    for (const url of ['http://evil.example/api/rul/config', '//evil.example/api/rul/config', 'api/rul/config', '', '/a\\b']) {
      expect(await fetchRulServerConfig(url), url).toEqual({ state: 'closed', reason: 'input' })
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('the closed default is the one of the server', () => {
    expect(RUL_SERVER_CLOSED).toEqual({ enabled: false, maxPoints: 5000, timeoutMs: 8000 })
  })
})

describe('the card against the build and the server (matrix)', () => {
  it('build off: no card and no request to the server, whatever the server would say', async () => {
    const spy = serverAnswering(() => reply(200, OPEN))
    render(<App rul={BUILD_OFF} />)
    await settle()
    expect(screen.queryByTestId('rul-panel')).not.toBeInTheDocument()
    expect(document.querySelectorAll('section.panel')).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
  })

  it('build on, server open: the card appears as a third panel after one request', async () => {
    const spy = serverAnswering(() => reply(200, OPEN))
    render(<App rul={BUILD_ON} />)
    expect(await screen.findByTestId('rul-panel')).toBeInTheDocument()
    expect(document.querySelectorAll('section.panel')).toHaveLength(3)
    expect(configCalls(spy)).toHaveLength(1)
  })

  it('build on: the card is not there while the server has not answered yet', async () => {
    const spy = serverAnswering(() => new Promise<Response>(() => { /* pending */ }) as unknown as Response)
    render(<App rul={BUILD_ON} />)
    await waitFor(() => expect(configCalls(spy)).toHaveLength(1))
    expect(screen.queryByTestId('rul-panel')).not.toBeInTheDocument()
  })

  const closedCases: [string, ServerAnswer][] = [
    ['closed (enabled false)', () => reply(200, { ...OPEN, enabled: false })],
    ['without the route (404)', () => reply(404, '')],
    ['refusing the session (401)', () => reply(401, { error: 'x' })],
    ['failing (500)', () => reply(500, { error: 'x' })],
    ['answering nonsense', () => reply(200, { enabled: 'yes' })],
    ['answering text', () => reply(200, 'not json')],
  ]
  for (const [name, answer] of closedCases) {
    it(`build on, server ${name}: no card`, async () => {
      const spy = serverAnswering(answer)
      render(<App rul={BUILD_ON} />)
      await waitFor(() => expect(configCalls(spy)).toHaveLength(1))
      await settle()
      expect(screen.queryByTestId('rul-panel')).not.toBeInTheDocument()
      expect(document.querySelectorAll('section.panel')).toHaveLength(2)
    })
  }

  it('build on, server unreachable: no card and the two panels stay', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      isConfigCall(input) ? Promise.reject(new TypeError('failed to fetch')) : new Promise(() => { /* pending */ }),
    )
    render(<App rul={BUILD_ON} />)
    await waitFor(() => expect(configCalls(spy)).toHaveLength(1))
    await settle()
    expect(screen.queryByTestId('rul-panel')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trend Summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Anomaly Check' })).toBeInTheDocument()
  })

  it('the default configuration of the page (build off) still makes no request on its own', () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    render(<App />)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('the open card is sized by the limits of the server', () => {
  it('sends no more points than the server accepts', async () => {
    const samples = Array.from({ length: 60 }, (_, i) => ({ sourceId: 'robot-1', kind: 'anomaly_score', field: 'value', timestamp: i * DAY_MS, value: 0.1 + 0.01 * i }))
    const lake = await listen((req, res) => {
      if (String(req.url).startsWith('/series')) {
        json(res, 200, [{ sourceId: 'robot-1', kind: 'anomaly_score', field: 'value', count: 60, firstTimestamp: 0, lastTimestamp: 59 * DAY_MS }])
        return
      }
      json(res, 200, samples)
    })
    let sent: { points: unknown[] } | null = null
    const detector = await listen((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        sent = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
        json(res, 200, { status: 'not_rising', points: 20, slopePerDay: null, currentValue: null, daysToLimit: null, daysLow: null, daysHigh: null })
      })
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      isConfigCall(input) ? Promise.resolve(reply(200, { enabled: true, maxPoints: 20, timeoutMs: 9000 })) : realFetch(input, init),
    )
    render(<RulGate build={{ ...BUILD_ON, detectorUrl: detector, points: 200, timeoutMs: 1500 }} datalakeBaseUrl={lake} />)
    expect(await screen.findByTestId('rul-result')).toBeInTheDocument()
    expect(sent).not.toBeNull()
    expect((sent as unknown as { points: unknown[] }).points.length).toBeLessThanOrEqual(20)
  })
})
