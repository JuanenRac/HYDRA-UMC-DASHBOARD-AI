// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/edgeCases.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// @vitest-environment node
//
// Hostile or broken answers from the two services, odd service addresses and
// the abort handling of the shared fetch wrapper, against real node:http
// servers (see fetchWithTimeout.test.ts for why this file runs under plain
// Node instead of jsdom).

import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { fetchWithTimeout, FetchTimeoutError } from '../src/api/fetchWithTimeout'
import { joinServiceUrl } from '../src/api/joinServiceUrl'
import { detectAnomaly, fetchDetectorStats, AnomalyApiError } from '../src/api/anomalyClient'
import { queryDatalake, validateDatalakePoint, DatalakeApiError } from '../src/api/datalakeClient'
import { safeGenerateNarrative, validateNarrativeRequest, validateNarrativeResponse } from '../src/lib/aiProvider'
import { summarize } from '../src/lib/summary'

type Handler = (req: IncomingMessage, res: ServerResponse) => void
let server: Server | undefined

function listen(handler: Handler): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const address = server!.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

afterEach(async () => {
  const current = server
  server = undefined
  if (current) {
    current.closeAllConnections?.()
    await new Promise<void>((resolve) => current.close(() => resolve()))
  }
})

function reply(status: number, body: string, type = 'application/json'): Handler {
  return (_req, res) => {
    res.writeHead(status, { 'Content-Type': type })
    res.end(body)
  }
}

const GOOD_POINT = { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 1000, value: 21.5 }

describe('fetchWithTimeout abort handling', () => {
  it('does not send anything when the caller signal is already aborted', async () => {
    let requests = 0
    const baseUrl = await listen((_req, res) => {
      requests += 1
      res.writeHead(200)
      res.end('ok')
    })
    const controller = new AbortController()
    controller.abort()

    await expect(fetchWithTimeout(baseUrl, { signal: controller.signal }, 5000)).rejects.not.toBeInstanceOf(
      FetchTimeoutError,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(requests).toBe(0)
  })

  it('reports the configured timeout in the error', async () => {
    const baseUrl = await listen(() => {})
    const error = await fetchWithTimeout(baseUrl, {}, 30).catch((err) => err)
    expect(error).toBeInstanceOf(FetchTimeoutError)
    expect(error.timeoutMs).toBe(30)
    expect(error.name).toBe('FetchTimeoutError')
  })

  it('passes a connection failure through untouched', async () => {
    await expect(fetchWithTimeout('http://127.0.0.1:1', {}, 2000)).rejects.not.toBeInstanceOf(FetchTimeoutError)
  })
})

describe('joinServiceUrl edge cases', () => {
  it('drops the query string and fragment of the base', () => {
    const url = joinServiceUrl('http://host:1/api?token=abc#frag', '/query')
    expect(url.search).toBe('')
    expect(url.hash).toBe('')
    expect(url.pathname).toBe('/api/query')
  })

  it('adds the missing slash of a relative path and collapses trailing slashes of the base', () => {
    expect(joinServiceUrl('http://host:1/a///', 'stats').pathname).toBe('/a/stats')
  })

  it('keeps credentials visible so the clients can refuse them', () => {
    const url = joinServiceUrl('http://user:pw@host:1', '/query')
    expect(url.username).toBe('user')
  })

  it('throws on an unparsable absolute base', () => {
    expect(() => joinServiceUrl('http://', '/query')).toThrow()
  })
})

describe('queryDatalake against hostile answers', () => {
  it('turns an unparsable base into a DatalakeApiError', async () => {
    await expect(queryDatalake('http://', {})).rejects.toBeInstanceOf(DatalakeApiError)
  })

  it('refuses non-http schemes', async () => {
    await expect(queryDatalake('ftp://host', {})).rejects.toThrow(/HTTP\(S\)/)
    await expect(queryDatalake('file:///etc/passwd', {})).rejects.toThrow(/HTTP\(S\)/)
  })

  it.each([
    ['null', 'null'],
    ['an object', '{"points":[]}'],
    ['a string', '"hello"'],
    ['a number', '5'],
  ])('rejects a /query answer that is %s', async (_name, body) => {
    const baseUrl = await listen(reply(200, body))
    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(/non-array/)
  })

  it('rejects an HTML error page that came with a 200', async () => {
    const baseUrl = await listen(reply(200, '<html>proxy error</html>', 'text/html'))
    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(/not valid JSON/)
  })

  it('names the HTTP status of a failure', async () => {
    const baseUrl = await listen(reply(503, 'busy', 'text/plain'))
    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(/HTTP 503/)
  })

  it('reports the index of the first bad point', async () => {
    const baseUrl = await listen(reply(200, JSON.stringify([GOOD_POINT, { ...GOOD_POINT, value: 'hot' }])))
    await expect(queryDatalake(baseUrl, {})).rejects.toThrow(/value in \/query point 1/)
  })

  it('sends every filter and defaults the limit', async () => {
    let seen = ''
    const baseUrl = await listen((req, res) => {
      seen = req.url ?? ''
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    })
    await queryDatalake(baseUrl, { sourceId: 'a b', kind: 'k', field: 'f', start: 1, end: 2 })
    const query = new URL(seen, 'http://x').searchParams
    expect(Object.fromEntries(query)).toEqual({
      sourceId: 'a b',
      kind: 'k',
      field: 'f',
      start: '1',
      end: '2',
      limit: '5000',
    })
  })

  it('does not send a parameter that was left undefined', async () => {
    let seen = ''
    const baseUrl = await listen((req, res) => {
      seen = req.url ?? ''
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    })
    await queryDatalake(baseUrl, { sourceId: undefined, limit: 10 })
    expect(new URL(seen, 'http://x').searchParams.get('sourceId')).toBeNull()
    expect(new URL(seen, 'http://x').searchParams.get('limit')).toBe('10')
  })
})

describe('validateDatalakePoint', () => {
  it.each([
    ['an array', []],
    ['null', null],
    ['a string', 'x'],
    ['an empty sourceId', { ...GOOD_POINT, sourceId: '' }],
    ['a 129 character kind', { ...GOOD_POINT, kind: 'k'.repeat(129) }],
    ['a numeric field name', { ...GOOD_POINT, field: 5 }],
    ['a newline in sourceId', { ...GOOD_POINT, sourceId: 'a\nb' }],
    ['an escape in kind', { ...GOOD_POINT, kind: 'a\u001bb' }],
    ['a C1 control in field', { ...GOOD_POINT, field: 'a\u009bb' }],
    ['a fractional timestamp', { ...GOOD_POINT, timestamp: 1.5 }],
    ['a timestamp beyond the safe range', { ...GOOD_POINT, timestamp: 2 ** 60 }],
    ['an infinite value', { ...GOOD_POINT, value: Number.POSITIVE_INFINITY }],
    ['a NaN value', { ...GOOD_POINT, value: Number.NaN }],
    ['a string timestamp', { ...GOOD_POINT, timestamp: '1000' }],
    ['a missing value', { sourceId: 'a', kind: 'b', field: 'c', timestamp: 1 }],
  ])('rejects %s', (_name, value) => {
    expect(() => validateDatalakePoint(value)).toThrow(DatalakeApiError)
  })

  it('accepts a 128 character identifier and a negative value', () => {
    const point = validateDatalakePoint({ ...GOOD_POINT, kind: 'k'.repeat(128), value: -3.25 })
    expect(point.kind).toHaveLength(128)
    expect(point.value).toBe(-3.25)
  })

  it('drops unknown fields instead of passing them to a panel', () => {
    const point = validateDatalakePoint({ ...GOOD_POINT, extra: '<script>' }) as unknown as Record<string, unknown>
    expect('extra' in point).toBe(false)
  })
})

describe('anomaly client against hostile answers', () => {
  it('keeps the HTTP status when a proxy answers with an HTML page', async () => {
    const baseUrl = await listen(reply(502, '<html>bad gateway</html>', 'text/html'))
    const error = await fetchDetectorStats(baseUrl).catch((err) => err)
    expect(error).toBeInstanceOf(AnomalyApiError)
    expect(error.status).toBe(502)
  })

  it('uses the error text of the service when there is one', async () => {
    const baseUrl = await listen(reply(409, JSON.stringify({ error: 'detector not fitted' })))
    const error = await detectAnomaly(baseUrl, [1, 2, 3]).catch((err) => err)
    expect(error.status).toBe(409)
    expect(error.message).toContain('detector not fitted')
  })

  it('falls back to the status when the error body is JSON null or has no text', async () => {
    for (const body of ['null', '{}', '[]']) {
      const baseUrl = await listen(reply(500, body))
      const error = await detectAnomaly(baseUrl, [1]).catch((err) => err)
      expect(error).toBeInstanceOf(AnomalyApiError)
      expect(error.status).toBe(500)
      server!.closeAllConnections?.()
      await new Promise<void>((resolve) => server!.close(() => resolve()))
      server = undefined
    }
  })

  it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"fitted"'],
  ])('rejects a /stats answer that is %s', async (_name, body) => {
    const baseUrl = await listen(reply(200, body))
    await expect(fetchDetectorStats(baseUrl)).rejects.toThrow(/JSON object/)
  })

  it.each([
    ['a missing score', { anomalous: false, worstBinFreqHz: 1 }],
    ['a string score', { score: '1', anomalous: false, worstBinFreqHz: 1 }],
    ['a missing frequency', { score: 1, anomalous: true }],
    ['a numeric anomalous flag', { score: 1, anomalous: 1, worstBinFreqHz: 1 }],
  ])('rejects a /detect verdict with %s', async (_name, verdict) => {
    const baseUrl = await listen(reply(200, JSON.stringify(verdict)))
    await expect(detectAnomaly(baseUrl, [1, 2])).rejects.toBeInstanceOf(AnomalyApiError)
  })

  it('posts the window as JSON to /detect under a proxy path', async () => {
    let seenPath = ''
    let seenBody = ''
    const baseUrl = await listen((req, res) => {
      seenPath = req.url ?? ''
      let data = ''
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => {
        seenBody = data
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ score: 0.5, anomalous: false, worstBinFreqHz: 12 }))
      })
    })
    const verdict = await detectAnomaly(`${baseUrl}/api/anomaly/`, [1, 2, 3])
    expect(seenPath).toBe('/api/anomaly/detect')
    expect(JSON.parse(seenBody)).toEqual({ window: [1, 2, 3] })
    expect(verdict).toEqual({ score: 0.5, anomalous: false, worstBinFreqHz: 12 })
  })

  it('refuses a base that is not http(s)', async () => {
    await expect(fetchDetectorStats('ftp://host')).rejects.toThrow(/HTTP\(S\)/)
    await expect(detectAnomaly('http://', [1])).rejects.toThrow(/base URL is invalid/)
  })

  it('reports an unreachable service', async () => {
    await expect(fetchDetectorStats('http://127.0.0.1:1')).rejects.toThrow(/could not reach/)
  })
})

describe('narrative gate edge cases', () => {
  const summary = summarize([
    { sourceId: 's', kind: 'k', field: 'f', timestamp: 1, value: 1 },
    { sourceId: 's', kind: 'k', field: 'f', timestamp: 2, value: 3 },
  ])
  const request = { sourceId: 's', kind: 'k', field: 'f', summary }

  it.each(['a b', 'a/b', 'a;b', '<b>', 'a\nb', 'x'.repeat(129), 'ñ'])('refuses the identifier %j', (id) => {
    expect(() => validateNarrativeRequest({ ...request, sourceId: id })).toThrow(/may only contain/)
  })

  it('refuses a summary given as an array', () => {
    expect(() => validateNarrativeRequest({ ...request, summary: [] })).toThrow()
  })

  it('accepts the longest allowed narrative and refuses one more', () => {
    expect(validateNarrativeResponse({ narrative: 'a'.repeat(2000), generatedBy: 'ai' }).narrative).toHaveLength(2000)
    expect(() => validateNarrativeResponse({ narrative: 'a'.repeat(2001), generatedBy: 'ai' })).toThrow(/exceeds/)
  })

  it.each(['‮', '⁦', '\u0000', '\u001b', '\u007f', '\u009b'])('refuses the control character %j', (ch) => {
    expect(() => validateNarrativeResponse({ narrative: `ok${ch}ok`, generatedBy: 'ai' })).toThrow(/unsafe/)
  })

  it('allows tabs-free multi-line text', () => {
    expect(validateNarrativeResponse({ narrative: 'line one\nline two', generatedBy: 'ai' }).narrative).toContain('\n')
  })

  it('falls back when a provider answers with an overlong narrative', async () => {
    const provider = {
      name: 'p',
      generateNarrative: async () => ({ narrative: 'x'.repeat(5000), generatedBy: 'ai' as const }),
    }
    const originalWarn = console.warn
    console.warn = () => {}
    try {
      const answer = await safeGenerateNarrative(provider, request)
      expect(answer.generatedBy).toBe('statistical-fallback')
    } finally {
      console.warn = originalWarn
    }
  })
})

describe('summarize edge cases', () => {
  const at = (timestamp: number, value: number) => ({ sourceId: 's', kind: 'k', field: 'f', timestamp, value })

  it('does not change the order of the points it was given', () => {
    const points = [at(3, 1), at(1, 2), at(2, 3)]
    summarize(points)
    expect(points.map((p) => p.timestamp)).toEqual([3, 1, 2])
  })

  it('handles two points', () => {
    const summary = summarize([at(1, 1), at(2, 5)])
    expect(summary.direction).toBe('up')
    expect(summary.average).toBe(3)
  })

  it('handles an all-zero series as flat', () => {
    expect(summarize([at(1, 0), at(2, 0), at(3, 0)]).direction).toBe('flat')
  })

  it('handles negative values', () => {
    const summary = summarize([at(1, -1), at(2, -5), at(3, -9)])
    expect(summary.min).toBe(-9)
    expect(summary.max).toBe(-1)
    expect(summary.direction).toBe('down')
  })

  it('keeps timestamps of equal points in the order given by timestamp', () => {
    const summary = summarize([at(5, 2), at(5, 2), at(5, 2)])
    expect(summary.count).toBe(3)
    expect(summary.minTimestamp).toBe(5)
  })
})
