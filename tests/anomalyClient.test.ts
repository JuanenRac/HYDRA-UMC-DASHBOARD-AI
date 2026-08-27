// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/anomalyClient.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Real HTTP round-trips against a real node:http server standing in for
// HYDRA-UMC-ANOMALY-DETECTOR's own /stats and /detect contract.

import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { fetchDetectorStats, detectAnomaly, AnomalyApiError } from '../src/api/anomalyClient'

let server: Server

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

describe('fetchDetectorStats', () => {
  it('parses a real fitted:true response', async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ fitted: true }))
    })
    const stats = await fetchDetectorStats(baseUrl)
    expect(stats.fitted).toBe(true)
  })
})

describe('detectAnomaly', () => {
  it('sends a real JSON body and parses a real verdict', async () => {
    let receivedBody = ''
    const baseUrl = await listen((req, res) => {
      req.on('data', (chunk: Buffer) => (receivedBody += chunk.toString()))
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ score: 3.2, anomalous: false, worstBinFreqHz: 120.5 }))
      })
    })

    const verdict = await detectAnomaly(baseUrl, [1, 2, 3, 4])
    expect(verdict).toEqual({ score: 3.2, anomalous: false, worstBinFreqHz: 120.5 })
    expect(JSON.parse(receivedBody)).toEqual({ window: [1, 2, 3, 4] })
  })

  it('surfaces a real 409 "not fitted" as a distinguishable AnomalyApiError.status', async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'detector has not been fitted yet' }))
    })

    try {
      await detectAnomaly(baseUrl, [1, 2, 3])
      expect.unreachable('detectAnomaly should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AnomalyApiError)
      expect((err as AnomalyApiError).status).toBe(409)
      expect((err as AnomalyApiError).message).toContain('not been fitted')
    }
  })

  it('rejects an empty window before making any real request', async () => {
    await expect(detectAnomaly('http://127.0.0.1:1', [])).rejects.toThrow(AnomalyApiError)
  })
})
