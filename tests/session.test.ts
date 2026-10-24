// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/session.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The session of STUDIO as this page uses it behind HYDRA-UMC-SERVER, and the two sets of addresses the page can be served with.

import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { authHeaders, isSameOriginPath, readToken, sessionHint, TOKEN_KEY } from '../src/lib/session'
import { defaultEndpoints } from '../src/lib/endpoints'
import { queryDatalake, DatalakeApiError } from '../src/api/datalakeClient'
import { detectAnomaly, fetchDetectorStats, AnomalyApiError } from '../src/api/anomalyClient'

const store = (value: string | null) => ({ getItem: (key: string) => (key === TOKEN_KEY ? value : null) })

describe('readToken', () => {
  it('prefers the token of this tab over a saved login', () => {
    expect(readToken({ session: store('tab-token'), local: store('saved-token') })).toBe('tab-token')
    expect(readToken({ session: store(null), local: store('saved-token') })).toBe('saved-token')
  })

  it('is null without a session, with blocked storage or with a token that could split a header', () => {
    expect(readToken({ session: null, local: null })).toBeNull()
    expect(readToken({ session: store(null), local: store(null) })).toBeNull()
    expect(readToken({ session: store('   '), local: null })).toBeNull()
    expect(readToken({ session: store('abc\r\nX-Evil: 1'), local: null })).toBeNull()
    const throwing = { getItem: () => { throw new Error('blocked') } }
    expect(readToken({ session: throwing, local: throwing })).toBeNull()
  })
})

describe('authHeaders', () => {
  it('adds the Bearer token to a same-origin address only', () => {
    expect(isSameOriginPath('/api/ai/datalake')).toBe(true)
    for (const other of ['//evil.example/api', 'http://127.0.0.1:8095', 'https://example.org', '/\\evil.example', 'api/ai']) {
      expect(isSameOriginPath(other)).toBe(false)
      expect(authHeaders(other, 'secret')).toEqual({})
    }
    expect(authHeaders('/api/ai/datalake', 'secret')).toEqual({ Authorization: 'Bearer secret' })
  })

  it('adds nothing without a session', () => {
    expect(authHeaders('/api/ai/datalake', null)).toEqual({})
  })
})

describe('sessionHint', () => {
  it('names what to do for a missing or a refused session', () => {
    expect(sessionHint(401)).toMatch(/STUDIO/)
    expect(sessionHint(403)).toMatch(/administrator or an operator/)
    expect(sessionHint(500)).toBe('')
    expect(sessionHint(undefined)).toBe('')
  })
})

describe('defaultEndpoints', () => {
  it('uses the relay of the server under /dashboard-ai and the proxy of the static server elsewhere', () => {
    for (const path of ['/dashboard-ai', '/dashboard-ai/', '/dashboard-ai/index.html']) {
      expect(defaultEndpoints(path)).toEqual({ datalake: '/api/ai/datalake', anomaly: '/api/ai/anomaly-detector', behindServer: true })
    }
    for (const path of ['/', '/index.html', '/dashboard-ai-other', '/x/dashboard-ai']) {
      expect(defaultEndpoints(path)).toEqual({ datalake: '/api/datalake', anomaly: '/api/anomaly', behindServer: false })
    }
  })
})

// The clients read the session from the page's own storage; here the page is a jsdom window on http://localhost, so a base URL that is
// "/..." would go to localhost: a real server on a loopback port stands in for the relay by being the origin of the page is not possible,
// so the headers are checked through an absolute address (no token must reach it) and through a stubbed fetch for the relative one.
describe('the clients and the session', () => {
  let server: Server | undefined

  afterEach(async () => {
    window.sessionStorage.clear()
    window.localStorage?.clear?.() // some Node versions expose an experimental localStorage that jsdom does not replace
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = undefined
  })

  it('never send the token to an absolute address', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'studio-session-token')
    const seen: Array<string | undefined> = []
    server = createServer((req, res) => {
      seen.push(req.headers.authorization)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(req.url?.startsWith('/query') ? '[]' : JSON.stringify({ fitted: true }))
    })
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
    await queryDatalake(base, { sourceId: 's' })
    await fetchDetectorStats(base)
    expect(seen).toEqual([undefined, undefined])
  })

  it('send the token of the session to a same-origin address, and say what to do when it is refused', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'studio-session-token')
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; authorization: string | null }> = []
    let status = 200
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      calls.push({ url: String(input), authorization: headers.get('authorization') })
      return new Response(status === 200 ? '[]' : JSON.stringify({ error: 'nope' }), { status, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      await queryDatalake('/api/ai/datalake', { sourceId: 's' })
      expect(calls[0].url).toContain('/api/ai/datalake/query')
      expect(calls[0].authorization).toBe('Bearer studio-session-token')

      status = 401
      await expect(queryDatalake('/api/ai/datalake', { sourceId: 's' })).rejects.toThrow(/sign in through HYDRA-UMC STUDIO/)
      await expect(queryDatalake('/api/ai/datalake', { sourceId: 's' })).rejects.toBeInstanceOf(DatalakeApiError)

      status = 403
      await expect(detectAnomaly('/api/ai/anomaly-detector', [1, 2, 3])).rejects.toThrow(/administrator or an operator/)
      await expect(fetchDetectorStats('/api/ai/anomaly-detector')).rejects.toBeInstanceOf(AnomalyApiError)
      const detect = calls.find((call) => call.url.includes('/detect'))
      expect(detect?.authorization).toBe('Bearer studio-session-token')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('send nothing extra without a session (the standalone mode)', async () => {
    const originalFetch = globalThis.fetch
    let authorization: string | null = 'unset'
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get('authorization')
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      await queryDatalake('/api/datalake', { sourceId: 's' })
      expect(authorization).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
