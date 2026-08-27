// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/TrendSummaryPanel.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// A real end-to-end render: mounts the real TrendSummaryPanel component,
// drives it with real user-event clicks/typing (@testing-library), and
// has it make a real HTTP request against a real node:http server - the
// full path from a click to a rendered number, not a mocked fetch.

import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServer, type Server } from 'node:http'
import { TrendSummaryPanel } from '../src/components/TrendSummaryPanel'

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

describe('TrendSummaryPanel', () => {
  it('fetches real data from a real server on submit and renders the real computed summary', async () => {
    // 4 points with min/max/average/latest all landing on 4 distinct
    // numbers, so each rendered value in the summary grid is uniquely
    // findable by getByText - reusing a value across two of those
    // fields (an earlier version of this test had average == latest by
    // accident) makes getByText legitimately ambiguous between two real
    // <dd> elements.
    const baseUrl = await listen((_req, res) => {
      const body = JSON.stringify([
        { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 0, value: 10 },
        { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 1000, value: 50 },
        { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 2000, value: 20 },
        { sourceId: 'robot-1', kind: 'motor_temp', field: 'value', timestamp: 3000, value: 36 },
      ])
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
    })

    render(<TrendSummaryPanel datalakeBaseUrl={baseUrl} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /fetch summary/i }))

    await waitFor(() => {
      expect(screen.getByTestId('trend-summary-result')).toBeInTheDocument()
    })

    expect(screen.getByText('10.00')).toBeInTheDocument() // min
    expect(screen.getByText('50.00')).toBeInTheDocument() // max
    expect(screen.getByText('29.00')).toBeInTheDocument() // average: (10+50+20+36)/4
    expect(screen.getByText('36.00')).toBeInTheDocument() // latest
  })

  it('shows a real error message when the server is unreachable', async () => {
    render(<TrendSummaryPanel datalakeBaseUrl="http://127.0.0.1:1" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /fetch summary/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not reach datalake/i)
    })
  })
})
