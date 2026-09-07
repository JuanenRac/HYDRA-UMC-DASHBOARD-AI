# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - External Content Safety Contract
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================

# External Content Safety Contract

HYDRA-UMC-DASHBOARD-AI is a browser client for HYDRA-UMC-DATALAKE and
HYDRA-UMC-ANOMALY-DETECTOR. Their HTTP responses, environment-provided URLs,
and any future AI-provider output cross a trust boundary. JSON that parses is
not automatically considered valid application data.

## Enforced client-side rules

- `datalakeClient.ts` accepts only arrays of complete telemetry points. Every
  `sourceId`, `kind`, and `field` must be a non-empty string of at most 128
  characters with no C0/C1 control characters; `timestamp` must be a safe
  integer and `value` must be finite.
- `anomalyClient.ts` requires a boolean `fitted` value, a boolean `anomalous`
  value, and finite numeric `score` / `worstBinFreqHz` values. A malformed
  response becomes an `AnomalyApiError` before a React panel uses it.
- `aiProvider.ts` accepts only a non-empty narrative of at most 2,000
  characters. It rejects control characters and bidirectional-format controls
  that could obscure displayed text, trims accepted output, and falls back to
  the locally calculated statistical narrative if a provider fails or returns
  invalid output.
- React renders the narrative as a text node; the project does not use
  `dangerouslySetInnerHTML` for service or provider content.

## Deployment boundary

`VITE_DATALAKE_URL` and `VITE_ANOMALY_URL` are compiled into the browser
bundle by Vite. They must name reachable HTTP(S) services and must never
contain API keys, passwords, bearer tokens, or other secrets. The two clients
reject non-HTTP(S) URLs and URLs containing embedded credentials before making
a request. Authentication, TLS termination, CORS policy, and network
segmentation belong at the deployed HYDRA-UMC-SERVER/reverse-proxy boundary;
this dashboard must remain a read-oriented client.

## Failure behaviour

Malformed sibling-service responses are surfaced as visible panel errors. A
malformed or unavailable AI-provider response instead preserves the real
statistical result through the clearly labelled `statistical-fallback` path.
Neither path silently converts unknown data into a valid operational result.

## Verification

Run the standard non-versioning check:

```bash
./build-test.sh
# or build-test.bat on Windows
```

The Vitest suite includes real local HTTP round trips that assert malformed
Datalake points, malformed anomaly verdicts, unsafe identifiers, and unsafe
provider narratives are rejected.
