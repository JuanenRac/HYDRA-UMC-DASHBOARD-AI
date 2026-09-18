// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Panel-level render failure isolation: ErrorBoundary.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
//
// Real gap this closes: neither panel had any error boundary, so a
// render-time exception in either TrendSummaryPanel or AnomalyCheckPanel
// (a malformed HYDRA-UMC-DATALAKE/HYDRA-UMC-ANOMALY-DETECTOR response
// reaching a component that doesn't expect its exact shape, for
// instance) would unmount the WHOLE app - React discards the entire tree
// above the nearest error boundary on an uncaught render error, and
// there wasn't one, so App.tsx itself would blank out, taking down the
// other, perfectly healthy panel along with it. Each panel in App.tsx is
// now wrapped in its own instance of this boundary, so a crash in one
// stays contained to that one panel's own card - only React's own
// documented mechanism (a class component implementing
// getDerivedStateFromError/componentDidCatch) can catch a render error
// at all; no hook-based equivalent exists.
// =============================================================================
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  // Shown in the fallback card so it's obvious which panel crashed,
  // rather than a generic "something went wrong" that could be either
  // one.
  panelName: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Real, visible diagnostic - never swallowed silently. The other
    // panel's own render is unaffected either way; this only logs.
    console.error(`[HYDRA-UMC-DASHBOARD-AI] ${this.props.panelName} crashed:`, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="panel panel-error" role="alert">
          <h2>{this.props.panelName}</h2>
          <p>This panel crashed and could not render: {this.state.error.message}</p>
          <p>The rest of the dashboard is unaffected.</p>
        </div>
      )
    }
    return this.props.children
  }
}
