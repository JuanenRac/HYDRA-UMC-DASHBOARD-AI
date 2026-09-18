// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/ErrorBoundary.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Real regression this locks in: before ErrorBoundary existed, a render
// exception in one panel unmounted the WHOLE app (React discards
// everything above the nearest boundary on an uncaught render error).
// These mount two real sibling components - one that genuinely throws
// during render, one that renders normally - each wrapped in its own
// ErrorBoundary exactly as App.tsx does, and prove the healthy sibling
// is completely unaffected.

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

function Crashes(): never {
  throw new Error('simulated render failure')
}

function Healthy() {
  return <div>I am fine</div>
}

describe('ErrorBoundary', () => {
  it('renders a fallback card naming the crashed panel, without throwing out of render', () => {
    // React logs the caught error to the console by design (same as any
    // componentDidCatch) - silence it here so the test's own real
    // assertions aren't lost in expected noise.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary panelName="Trend Summary">
        <Crashes />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Trend Summary')
    expect(screen.getByText(/simulated render failure/)).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('a crash in one boundary never affects a sibling boundary rendering normally', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <div>
        <ErrorBoundary panelName="Trend Summary">
          <Crashes />
        </ErrorBoundary>
        <ErrorBoundary panelName="Anomaly Check">
          <Healthy />
        </ErrorBoundary>
      </div>,
    )

    // The crashed panel shows its own fallback...
    expect(screen.getByRole('alert')).toHaveTextContent('Trend Summary')
    // ...and the healthy sibling still rendered its real content, exactly
    // the isolation this whole component exists to guarantee.
    expect(screen.getByText('I am fine')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary panelName="Anomaly Check">
        <Healthy />
      </ErrorBoundary>,
    )
    expect(screen.getByText('I am fine')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
