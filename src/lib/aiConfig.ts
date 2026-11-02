// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Configuration of the language-model narrative and of the fleet view: aiConfig.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Both are OFF unless the build says so with the exact word `true`: with them off the page shows what it always showed and makes no
// request for them. A value that is missing or unusable falls back to its default. Vite inlines these at build time.
//
//   VITE_COGNITIVE_ENABLED   the Trend Summary asks the language model of HYDRA-UMC-COGNITIVE-NODE for its sentence (every number it
//                            writes is checked against the summary; anything else is the statistical sentence)
//   VITE_COGNITIVE_URL       base URL of the cognitive node (the same-origin relay of the page by default)
//   VITE_COGNITIVE_TIMEOUT_MS  how long to wait for the sentence, 1000 to 120000 (default 20000)
//   VITE_FLEET_ENABLED       the Fleet card: every followed series with its last anomaly score and its drift (GET /fleet of the detector)
//   VITE_FLEET_REFRESH_MS    seconds between refreshes in milliseconds, 0 for manual only, 5000 to 3600000 (default 15000)

export interface AiFeatures {
  cognitiveEnabled: boolean
  cognitiveUrl: string
  cognitiveTimeoutMs: number
  fleetEnabled: boolean
  fleetRefreshMs: number
}

export type AiEnv = Readonly<Record<string, string | undefined>>

export const AI_DEFAULTS = { cognitiveTimeoutMs: 20_000, fleetRefreshMs: 15_000 } as const

/** Where the cognitive node is reached from: through the relay of HYDRA-UMC-SERVER behind it, through the proxy of the static server on its own. */
export function defaultCognitiveUrl(behindServer: boolean): string {
  return behindServer ? '/api/ai/cognitive-node' : '/api/cognitive'
}

function whole(raw: string | undefined, fallback: number, low: number, high: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value >= low && value <= high ? value : fallback
}

export function readAiFeatures(env: AiEnv, behindServer: boolean): AiFeatures {
  const url = (env.VITE_COGNITIVE_URL ?? '').trim()
  const refresh = (env.VITE_FLEET_REFRESH_MS ?? '').trim()
  return {
    cognitiveEnabled: env.VITE_COGNITIVE_ENABLED === 'true',
    cognitiveUrl: url === '' ? defaultCognitiveUrl(behindServer) : url,
    cognitiveTimeoutMs: whole(env.VITE_COGNITIVE_TIMEOUT_MS, AI_DEFAULTS.cognitiveTimeoutMs, 1000, 120_000),
    fleetEnabled: env.VITE_FLEET_ENABLED === 'true',
    fleetRefreshMs: refresh === '0' ? 0 : whole(env.VITE_FLEET_REFRESH_MS, AI_DEFAULTS.fleetRefreshMs, 5000, 3_600_000),
  }
}
