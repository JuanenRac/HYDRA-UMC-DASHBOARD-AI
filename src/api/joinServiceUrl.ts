// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Service URL joining: joinServiceUrl.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================

/**
 * Joins a service path onto a base URL while keeping the base's own path.
 * The base may be absolute ("http://host:8095") or same-origin and relative
 * ("/api/datalake", the way the static server proxies the two services), in
 * which case it is resolved against the page's own origin. `new URL('/query',
 * base)` alone would throw away the base path, hence this helper.
 * Throws when the base cannot be parsed; the callers turn that into their own
 * typed error.
 */
export function joinServiceUrl(baseUrl: string, path: string): URL {
  const origin = typeof location !== 'undefined' && location.href ? location.href : 'http://localhost/'
  const base = new URL(baseUrl, origin)
  const prefix = base.pathname.replace(/\/+$/, '')
  base.pathname = `${prefix}${path.startsWith('/') ? path : `/${path}`}`
  base.search = ''
  base.hash = ''
  return base
}
