// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/fetchWithTimeout.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// @vitest-environment node
//
// No DOM needed here - forcing the plain Node environment (rather than
// this project's default jsdom, see vite.config.ts) is what actually lets
// this file exercise the real timeout/abort path: jsdom's own
// AbortController/AbortSignal live in a different JS realm than Node's
// built-in fetch expects (a real, documented incompatibility -
// fetchWithTimeout.ts's own fallback comment explains it), so under
// jsdom this suite would only ever exercise that fallback, never prove a
// real abort actually happens.
//
// Real regression: datalakeClient.ts/anomalyClient.ts used to call fetch()
// directly with no AbortController and no timeout at all - a server that
// accepted the connection but never wrote a response left the caller
// waiting indefinitely. A real node:http server that deliberately never
// responds proves fetchWithTimeout() aborts on its own instead.

import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { fetchWithTimeout, FetchTimeoutError } from '../src/api/fetchWithTimeout'

let server: Server

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function listenAndNeverRespond(): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(() => {
      // Deliberately never calls res.end()/res.writeHead() - the real
      // shape of a hung backend, not a closed connection.
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

describe('fetchWithTimeout', () => {
  it('aborts and throws FetchTimeoutError against a server that never responds', async () => {
    const baseUrl = await listenAndNeverRespond()
    const start = Date.now()
    await expect(fetchWithTimeout(baseUrl, {}, 50)).rejects.toBeInstanceOf(FetchTimeoutError)
    // Real proof this didn't just happen to reject for an unrelated
    // reason - it actually waited close to the real timeout, not zero.
    expect(Date.now() - start).toBeGreaterThanOrEqual(40)
  })

  it('resolves normally well within the timeout against a real, responsive server', async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
    })
    const baseUrl = await new Promise<string>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0
        resolve(`http://127.0.0.1:${port}`)
      })
    })
    const response = await fetchWithTimeout(baseUrl, {}, 5000)
    expect(response.ok).toBe(true)
  })

  it('a caller-supplied AbortSignal still cancels, and is not mistaken for our own timeout', async () => {
    const baseUrl = await listenAndNeverRespond()
    const controller = new AbortController()
    const pending = fetchWithTimeout(baseUrl, { signal: controller.signal }, 5000)
    controller.abort()
    await expect(pending).rejects.not.toBeInstanceOf(FetchTimeoutError)
  })
})
