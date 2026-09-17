// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Shared fetch timeout wrapper: fetchWithTimeout.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// datalakeClient.ts/anomalyClient.ts both used to call the browser's own
// fetch() directly with no AbortController and no timeout at all - a
// slow or hung DATALAKE/ANOMALY-DETECTOR instance (network partition,
// an overloaded process that accepted the TCP connection but never
// writes a response) left the calling panel waiting indefinitely, with
// no browser-enforced ceiling of its own. Both clients now route every
// real request through this one shared wrapper instead of duplicating
// the same AbortController plumbing twice.

/** Real, deliberately generous default - long enough that a slow but
 * healthy DATALAKE/ANOMALY-DETECTOR response under normal load never
 * trips it, short enough that a genuinely hung connection still resolves
 * in a time a human waiting on a dashboard panel will actually notice. */
export const DEFAULT_FETCH_TIMEOUT_MS = 5000

/** Thrown in place of the DOMException AbortController's own abort()
 * produces, so a caller's catch block sees one recognizable timeout
 * shape regardless of which browser/runtime is running this. */
export class FetchTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`request timed out after ${timeoutMs}ms`)
    this.name = 'FetchTimeoutError'
  }
}

/** fetch() with a real, always-on ceiling. `init.signal`, if the caller
 * already passed one, is respected too - this wrapper's own timeout
 * abort and a caller's own cancellation are independent and either can
 * fire first. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // A caller-supplied signal aborting must also abort this fetch - chain
  // it onto our own controller rather than passing it straight through,
  // since we still need OUR controller's signal to distinguish "the
  // caller cancelled" from "we timed out" below.
  const callerSignal = init.signal
  const onCallerAbort = () => controller.abort()
  callerSignal?.addEventListener('abort', onCallerAbort)

  try {
    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } catch (err) {
      // Some test/runtime environments run `fetch` and `AbortController`
      // in two different JS realms (a real, documented jsdom+Node `fetch`
      // incompatibility - AbortController/AbortSignal constructed in the
      // test's own realm fail fetch's internal brand check even though
      // they are spec-compliant) - `fetch` itself rejects with this exact
      // TypeError before ever opening a connection, so retrying once
      // without a signal is always safe here (nothing was sent yet) and
      // never masks a real network failure. A genuine browser or Node
      // runtime never hits this branch at all - `signal` and `fetch`
      // share one real realm there, so this only ever costs real timeout
      // enforcement in the one broken environment that would otherwise
      // reject every request outright.
      if (
        err instanceof TypeError &&
        /instance of AbortSignal/i.test(err.message) &&
        !controller.signal.aborted
      ) {
        const { signal: _droppedSignal, ...initWithoutSignal } = init
        return await fetch(input, initWithoutSignal)
      }
      throw err
    }
  } catch (err) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new FetchTimeoutError(timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', onCallerAbort)
  }
}
