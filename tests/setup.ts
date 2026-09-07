// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - tests/setup.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// Loaded once per test file (see vite.config.ts's own test.setupFiles) -
// adds the real jest-dom matchers (toBeInTheDocument, etc.) that the
// component tests under this directory use, and unmounts whatever the
// previous test rendered before the next one starts. Without this,
// component tests in the same file/describe block leak DOM nodes into
// each other (e.g. two <button> elements both matching the same
// getByRole query) - real-not-mocked component tests exercise real DOM
// mounting, so real cleanup between them is what makes that safe.

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
