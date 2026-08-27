// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/datalakeClient.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Real HTTP round-trips: a real node:http server standing in for
// HYDRA-UMC-DATALAKE's own GET /query contract, hit with the real
// `fetch` this project's own datalakeClient.ts uses - not a mocked
// fetch, a real socket.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { queryDatalake, DatalakeApiError } from '../src/api/datalakeClient'

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

  it('throws DatalakeApiError when nothing is listening', async () => {
    await expect(queryDatalake('http://127.0.0.1:1', {})).rejects.toThrow(DatalakeApiError)
  })
})
