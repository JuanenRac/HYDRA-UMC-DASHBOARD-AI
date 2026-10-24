// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Where the two services are reached from: endpoints.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Served by HYDRA-UMC-SERVER (under /dashboard-ai) the page reaches the data lake and the anomaly detector through that server's
// relay, which holds their tokens and applies its roles. Served on its own (scripts/serve_static.py or the Vite dev server) it
// reaches them through the proxy of that static server.

export interface Endpoints {
  datalake: string
  anomaly: string
  /** Served behind HYDRA-UMC-SERVER? */
  behindServer: boolean
}

export const SERVER_PREFIX = '/dashboard-ai'

export function defaultEndpoints(pathname: string): Endpoints {
  const behindServer = pathname === SERVER_PREFIX || pathname.startsWith(`${SERVER_PREFIX}/`)
  return behindServer
    ? { datalake: '/api/ai/datalake', anomaly: '/api/ai/anomaly-detector', behindServer }
    : { datalake: '/api/datalake', anomaly: '/api/anomaly', behindServer }
}
