// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - The session of the person who signed in to STUDIO: session.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// When this page is served by HYDRA-UMC-SERVER (at /dashboard-ai) it shares the origin of STUDIO, so the access token of the
// person who signed in there is in this browser's storage under the same key. The token is sent only to a same-origin
// address (a base URL that starts with a single "/"): an absolute address, which a deployment can configure at build time,
// never receives it. Without a token nothing is added and the call goes out as it always did (the standalone mode).

/** The key STUDIO keeps the access token under (sessionStorage for a login of this tab, localStorage for "keep me signed in"). */
export const TOKEN_KEY = 'hydra_token'

type StorageLike = Pick<Storage, 'getItem'>

interface Stores {
  session: StorageLike | null
  local: StorageLike | null
}

function browserStorage(kind: 'localStorage' | 'sessionStorage'): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window[kind]
  } catch {
    return null // storage blocked
  }
}

function safeGet(store: StorageLike | null): string | null {
  try {
    return store ? store.getItem(TOKEN_KEY) : null
  } catch {
    return null
  }
}

/** The access token of this browser: the one of this tab wins over a saved login. Null when there is none. */
export function readToken(stores: Stores = { session: browserStorage('sessionStorage'), local: browserStorage('localStorage') }): string | null {
  const token = (safeGet(stores.session) ?? safeGet(stores.local) ?? '').trim()
  // a token with a line break or a control character could split a header: it is not used
  // eslint-disable-next-line no-control-regex
  return token !== '' && !/[\u0000-\u001F\u007F]/.test(token) ? token : null
}

/** Is this base URL on the page's own origin ("/api/..." and not "//host/..." or "http://host")? */
export function isSameOriginPath(baseUrl: string): boolean {
  return baseUrl.startsWith('/') && !baseUrl.startsWith('//') && !baseUrl.includes('\\')
}

/** `{ Authorization: 'Bearer ...' }` for a same-origin base URL when a session exists; nothing otherwise. */
export function authHeaders(baseUrl: string, token: string | null = readToken()): Record<string, string> {
  return token && isSameOriginPath(baseUrl) ? { Authorization: `Bearer ${token}` } : {}
}

/** The sentence for an answer that says the session is missing or not allowed. */
export function sessionHint(status: number | undefined): string {
  if (status === 401) return 'sign in through HYDRA-UMC STUDIO in this browser first'
  if (status === 403) return 'this account is not allowed to use the AI services (an administrator or an operator is needed)'
  return ''
}
