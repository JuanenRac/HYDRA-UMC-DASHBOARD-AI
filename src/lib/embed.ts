// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - The page embedded in STUDIO: embed.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// STUDIO can show this page inside one of its own panels (an iframe of /dashboard-ai?embed=1, which shares the origin and therefore the
// session of the person who signed in). In that mode the page leaves out its own heading and tells the frame how tall it is, so the
// frame can follow it. The message goes only to the origin of the page itself, never to "*", and carries one number. Nothing else changes:
// the same login, the same relays, the same panels. Outside a frame, or without ?embed=1, none of this runs.

export const EMBED_MESSAGE_TYPE = 'hydra-dashboard-ai:height'

/** Is the page asked to run embedded (`?embed=1`)? */
export function isEmbedRequested(search: string): boolean {
  return new URLSearchParams(search).get('embed') === '1'
}

/** Is the page really inside another page? A page that was asked to embed but runs on its own behaves as usual. */
export function isFramed(win: Pick<Window, 'parent' | 'self'> = window): boolean {
  try {
    return win.parent !== win.self
  } catch {
    return true // a parent of another origin refuses the comparison: there is a parent
  }
}

export interface EmbedMessage {
  type: typeof EMBED_MESSAGE_TYPE
  height: number
}

/** Tells the parent the height of the page; returns false when nothing was sent. */
export function postHeight(height: number, win: Pick<Window, 'parent' | 'self' | 'location'> = window): boolean {
  if (!Number.isFinite(height) || height <= 0 || height > 100_000) return false
  if (!isFramed(win)) return false
  const message: EmbedMessage = { type: EMBED_MESSAGE_TYPE, height: Math.ceil(height) }
  win.parent.postMessage(message, win.location.origin)
  return true
}
