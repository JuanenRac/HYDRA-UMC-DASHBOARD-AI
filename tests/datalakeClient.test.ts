// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/datalakeClient.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// @vitest-environment node
//
// No DOM needed here - see fetchWithTimeout.test.ts's own header comment
// for why this file deliberately overrides this project's default jsdom
// test environment.
//
// Real HTTP round-trips: a real node:http server standing in for
// HYDRA-UMC-DATALAKE's own GET /query contract, hit with the real
// `fetch` this project's own datalakeClient.ts uses - not a mocked
// fetch, a real socket.

import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { queryDatalake, recentSamples, DatalakeApiError } from '../src/api/datalakeClient'

let server: Server
let baseUrl: string
let lastRequestUrl: string | undefined

function listen(handler: (req: any, res: any) => void): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('queryDatalake', () => {
  it('parses a real 200 JSON array response', async () => {
    baseUrl = await listen((req, res) => {
      lastRequestUrl = req.url
      const body = JSON.stringify([
        { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 1000, value: 42.5 },
      ])
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
    })

    const points = await queryDatalake(baseUrl, { sourceId: 'robot-1', kind: 'motor_temp', start: 0, end: 5000 })
    expect(points).toHaveLength(1)
    expect(points[0].value).toBe(42.5)
    expect(lastRequestUrl).toContain('sourceId=robot-1')
    expect(lastRequestUrl).toContain('start=0')
    expect(lastRequestUrl).toContain('end=5000')
  })

  it('throws DatalakeApiError on a real non-2xx response', async () => {
    baseUrl = await listen((_req, res) => {
      res.writeHead(500)
      res.end('boom')
    })

    await expect(queryDatalake(baseUrl, { sourceId: 'robot-1' })).rejects.toThrow(DatalakeApiError)
  })

  it('throws DatalakeApiError on a real malformed-JSON response', async () => {
    baseUrl = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('not json')
    })

    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(DatalakeApiError)
  })

  it('rejects malformed point objects before they reach a panel', async () => {
    baseUrl = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify([{ sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 1, value: '42.5' }]))
    })

    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(/invalid value/i)
  })

  it('rejects control characters in service-provided identifiers', async () => {
    baseUrl = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify([{ sourceId: 'robot-1\u0000hidden', kind: 'motor_temp', field: 'value', timestamp: 1, value: 42.5 }]))
    })

    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(/unsafe sourceId/i)
  })

  it('throws DatalakeApiError when nothing is listening', async () => {
    await expect(queryDatalake('http://127.0.0.1:1', {})).rejects.toThrow(DatalakeApiError)
  })

  it('rejects a browser-visible service URL with embedded credentials', async () => {
    await expect(queryDatalake('https://operator:secret@example.test', {})).rejects.toThrow(/must not contain credentials/i)
  })

  it('requests a generous default limit when the caller does not specify one', async () => {
    baseUrl = await listen((req, res) => {
      lastRequestUrl = req.url
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    })

    await queryDatalake(baseUrl, { sourceId: 'robot-1' })
    expect(lastRequestUrl).toContain('limit=5000')
  })

  it('honors an explicit caller-supplied limit instead of overriding it', async () => {
    baseUrl = await listen((req, res) => {
      lastRequestUrl = req.url
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    })

    await queryDatalake(baseUrl, { sourceId: 'robot-1', limit: 10 })
    expect(lastRequestUrl).toContain('limit=10')
  })

  it('fails honestly instead of silently returning a truncated, stale window', async () => {
    // A real, confirmed bug found while auditing the code: DATALAKE's
    // own /query returns points oldest-first, capped at `limit` - a
    // response with exactly that many points means real, more-recent
    // samples may have been silently cut off. Every caller in this
    // codebase treats the tail of the array as "the most recent sample",
    // so this must fail loudly rather than hand back stale data.
    baseUrl = await listen((req, res) => {
      lastRequestUrl = req.url
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify([{ sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 1, value: 1 }]))
    })

    await expect(queryDatalake(baseUrl, { sourceId: 'robot-1', limit: 1 })).rejects.toThrow(
      /exactly the requested limit/i,
    )
  })
})

describe('recentSamples', () => {
  /** A store with one series sampled at `hz` from t=0 for `seconds`; /series says so and /query computes the points of the asked window. */
  function store(hz: number, seconds: number) {
    const stepMs = 1000 / hz
    const total = Math.floor(seconds * hz)
    const last = (total - 1) * stepMs
    const requests: string[] = []
    return {
      requests,
      handler: (req: any, res: any) => {
        requests.push(req.url)
        const url = new URL(req.url, 'http://x')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        if (url.pathname === '/series') {
          res.end(JSON.stringify([
            { sourceId: 's1', kind: 'vibration', field: 'value', count: total, firstTimestamp: 0, lastTimestamp: last },
            { sourceId: 's2', kind: 'vibration', field: 'value', count: 5, firstTimestamp: 0, lastTimestamp: 4 },
            { not: 'a series' },
          ]))
          return
        }
        const start = Number(url.searchParams.get('start'))
        const before = Number(url.searchParams.get('before'))
        const limit = Number(url.searchParams.get('limit'))
        const out = []
        for (let i = Math.max(0, Math.ceil(start / stepMs)); i < total && i * stepMs < before && out.length < limit; i += 1) {
          out.push({ sourceId: 's1', kind: 'vibration', field: 'value', timestamp: Math.round(i * stepMs), value: i })
        }
        res.end(JSON.stringify(out))
      },
    }
  }
  const SERIES = { sourceId: 's1', kind: 'vibration', field: 'value' }

  it('gets the newest samples of a source far faster than one per second, in one query', async () => {
    const fake = store(1000, 600) // 1 kHz for ten minutes: 600 000 samples, which a fixed day with limit 5000 never could
    baseUrl = await listen(fake.handler)
    const points = await recentSamples(baseUrl, SERIES, 64)
    expect(points).toHaveLength(64)
    expect(points.map((p) => p.value)).toEqual(Array.from({ length: 64 }, (_, i) => 599_936 + i))
    expect(fake.requests.filter((r) => r.startsWith('/query'))).toHaveLength(1)
    expect(fake.requests[0]).toContain('/series?kind=vibration')
  })

  it('gets them from a slow source too, and from one with fewer samples than asked', async () => {
    baseUrl = await listen(store(0.5, 4000).handler)
    const slow = await recentSamples(baseUrl, SERIES, 64)
    expect(slow).toHaveLength(64)
    expect(slow.at(-1)?.value).toBe(1999)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    baseUrl = await listen(store(1, 10).handler)
    const few = await recentSamples(baseUrl, SERIES, 64)
    expect(few.map((p) => p.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('widens the window when the source slowed down at the end', async () => {
    // 100 samples a second for a minute, then one a minute: the average rate says "fast", the tail is slow
    const samples: number[] = []
    for (let i = 0; i < 6000; i += 1) samples.push(i * 10)
    for (let i = 1; i <= 200; i += 1) samples.push(60_000 + i * 60_000)
    const requests: string[] = []
    baseUrl = await listen((req, res) => {
      requests.push(req.url)
      const url = new URL(req.url, 'http://x')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      if (url.pathname === '/series') {
        res.end(JSON.stringify([{ sourceId: 's1', kind: 'vibration', field: 'value', count: samples.length, firstTimestamp: 0, lastTimestamp: samples.at(-1) }]))
        return
      }
      const start = Number(url.searchParams.get('start'))
      const before = Number(url.searchParams.get('before'))
      res.end(JSON.stringify(samples.filter((t) => t >= start && t < before).map((t) => ({ sourceId: 's1', kind: 'vibration', field: 'value', timestamp: t, value: t }))))
    })
    const points = await recentSamples(baseUrl, SERIES, 64)
    expect(points).toHaveLength(64)
    expect(points.at(-1)?.timestamp).toBe(samples.at(-1))
    expect(requests.filter((r) => r.startsWith('/query')).length).toBeGreaterThan(1)
  })

  it('narrows the window when a burst does not fit one answer', async () => {
    const requests: string[] = []
    baseUrl = await listen((req, res) => {
      requests.push(req.url)
      const url = new URL(req.url, 'http://x')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      if (url.pathname === '/series') {
        res.end(JSON.stringify([{ sourceId: 's1', kind: 'vibration', field: 'value', count: 3, firstTimestamp: 0, lastTimestamp: 100_000 }]))
        return
      }
      const limit = Number(url.searchParams.get('limit'))
      const start = Number(url.searchParams.get('start'))
      // the span reads as very sparse, but the last seconds hold `limit` points (a burst): a wide window comes back full
      const wide = start < 99_000
      const n = wide ? limit : 70
      res.end(JSON.stringify(Array.from({ length: n }, (_, i) => ({ sourceId: 's1', kind: 'vibration', field: 'value', timestamp: 99_000 + i, value: i }))))
    })
    const points = await recentSamples(baseUrl, SERIES, 64)
    expect(points).toHaveLength(64)
    expect(requests.filter((r) => r.startsWith('/query')).length).toBeGreaterThan(1)
  })

  it('returns nothing for a series that does not exist, and refuses a bad count', async () => {
    baseUrl = await listen(store(1, 10).handler)
    expect(await recentSamples(baseUrl, { ...SERIES, field: 'other' }, 8)).toEqual([])
    await expect(recentSamples(baseUrl, SERIES, 0)).rejects.toBeInstanceOf(DatalakeApiError)
    await expect(recentSamples(baseUrl, SERIES, 1.5)).rejects.toBeInstanceOf(DatalakeApiError)
  })

  it('fails honestly when the catalogue is unreachable or damaged', async () => {
    baseUrl = await listen((_req, res) => { res.writeHead(500); res.end('boom') })
    await expect(recentSamples(baseUrl, SERIES, 8)).rejects.toThrow(/HTTP 500/)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    baseUrl = await listen((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"not":"an array"}') })
    await expect(recentSamples(baseUrl, SERIES, 8)).rejects.toThrow(/non-array \/series/)
  })
})
