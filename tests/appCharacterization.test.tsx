// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/appCharacterization.test.tsx
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Fixes what the page shows and requests on its own with the default configuration: the two panels, nothing else, and no
// request at all until somebody submits a form.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App with the default configuration', () => {
  it('shows the two panels and makes no request on its own', () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Trend Summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Anomaly Check' })).toBeInTheDocument()
    expect(document.querySelectorAll('section.panel')).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
  })
})
