// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/AnomalyCheckPanel.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// A real end-to-end render: mounts the real AnomalyCheckPanel component,
// drives it with real user-event clicks (@testing-library), and has it
// make real HTTP requests against two real node:http servers standing in
// for HYDRA-UMC-DATALAKE and HYDRA-UMC-ANOMALY-DETECTOR - the full path
// from a click to a rendered verdict, not a mocked fetch. Follows the
// same real-server pattern as TrendSummaryPanel.test.tsx.

import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServer, type Server } from 'node:http'
import { AnomalyCheckPanel } from '../src/components/AnomalyCheckPanel'

let datalakeServer: Server
let anomalyServer: Server

/** Starts a real node:http server on an ephemeral port and resolves its
 * base URL once listening. Assigns the server into the given holder so
 * afterEach can close it - two independent real servers are needed per
 * test (DATALAKE + ANOMALY-DETECTOR), so a single shared module-level
 * server (as TrendSummaryPanel.test.tsx uses) does not fit here. */
function listenOn(assign: (server: Server) => void, handler: (req: any, res: any) => void): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer(handler)
    assign(server)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

afterEach(async () => {
  await Promise.all(
    [datalakeServer, anomalyServer]
      .filter((s): s is Server => Boolean(s))
      .map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  )
})

function jsonResponse(res: any, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function makePoints(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    sourceId: 'robot-1',
    kind: 'motor_temp',
    field: 'value',
    timestamp: i * 1000,
    value: 20 + (i % 5),
  }))
}

describe('AnomalyCheckPanel', () => {
  it('shows the real "not fitted yet" state instead of an error when the detector has no baseline', async () => {
    const anomalyBaseUrl = await listenOn(
      (s) => (anomalyServer = s),
      (req, res) => {
        if (req.url === '/stats') {
          jsonResponse(res, 200, { fitted: false })
          return
        }
        jsonResponse(res, 404, { error: 'not found' })
      },
    )
    const datalakeBaseUrl = await listenOn(
      (s) => (datalakeServer = s),
      (_req, res) => jsonResponse(res, 200, []),
    )

    render(<AnomalyCheckPanel datalakeBaseUrl={datalakeBaseUrl} anomalyBaseUrl={anomalyBaseUrl} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check for anomalies/i }))

    await waitFor(() => {
      expect(screen.getByTestId('anomaly-not-fitted')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('anomaly-verdict')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('fetches real recent samples and renders the real scored verdict when the detector is fitted', async () => {
    const anomalyBaseUrl = await listenOn(
      (s) => (anomalyServer = s),
      (req, res) => {
        if (req.url === '/stats') {
          jsonResponse(res, 200, { fitted: true })
          return
        }
        if (req.url === '/detect') {
          jsonResponse(res, 200, { score: 0.125, anomalous: true, worstBinFreqHz: 3.5 })
          return
        }
        jsonResponse(res, 404, { error: 'not found' })
      },
    )
    const datalakeBaseUrl = await listenOn(
      (s) => (datalakeServer = s),
      (_req, res) => jsonResponse(res, 200, makePoints(64)),
    )

    render(<AnomalyCheckPanel datalakeBaseUrl={datalakeBaseUrl} anomalyBaseUrl={anomalyBaseUrl} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check for anomalies/i }))

    await waitFor(() => {
      expect(screen.getByTestId('anomaly-verdict')).toBeInTheDocument()
    })

    expect(screen.getByText('0.125')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('3.50 Hz')).toBeInTheDocument()
  })

  it('shows a real error when there are fewer real samples than the requested window size', async () => {
    const anomalyBaseUrl = await listenOn(
      (s) => (anomalyServer = s),
      (req, res) => {
        if (req.url === '/stats') {
          jsonResponse(res, 200, { fitted: true })
          return
        }
        jsonResponse(res, 404, { error: 'not found' })
      },
    )
    const datalakeBaseUrl = await listenOn(
      (s) => (datalakeServer = s),
      (_req, res) => jsonResponse(res, 200, makePoints(3)),
    )

    render(<AnomalyCheckPanel datalakeBaseUrl={datalakeBaseUrl} anomalyBaseUrl={anomalyBaseUrl} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /check for anomalies/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/only 3 real sample\(s\) available/i)
    })
    expect(screen.queryByTestId('anomaly-verdict')).not.toBeInTheDocument()
  })
})
