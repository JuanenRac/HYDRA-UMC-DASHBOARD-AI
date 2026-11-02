# Language-model sentence, Fleet card and embedded mode

Three additions, all **off by default**. With the default build the page shows what it always showed and makes no request for any of them.

## 1. The sentence of a local language model (`VITE_COGNITIVE_ENABLED=true`)

The Trend Summary can ask the language model of HYDRA-UMC-COGNITIVE-NODE (`POST /narrative`, see its `docs/NARRATIVE.md`) for its sentence. What goes out
is only the identifiers of the series and the numbers of the summary (count, minimum, maximum, average, latest, direction) and the language of the reader;
the node builds the prompt itself.

**The numeric verifier.** Before a sentence of a model is shown, every number written in it must be one of the five figures of the summary, to the decimals
it is written with (`2.8` for `2.75` is a rounding, `3.1` is not; a decimal comma and thousands separators are read; a sign is checked; full-width digits
are read as the digits they are). The identifiers of the series are not numbers. A number that matches none, a digit of another writing system or a
number that cannot be read sends the reader to the statistical sentence, with a line that says why (the model did not answer, or it wrote a number that is
not in the summary). The label says "AI, numbers checked" only for a sentence that passed.

What it does **not** do: it reads digits, not words ("three thousand", a Chinese numeral), and it does not check that the sentence is true, only that its
figures are the figures of the summary. A model that writes a wrong word for the direction is not caught by it.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_COGNITIVE_ENABLED` | `false` | only the exact word `true` switches it on |
| `VITE_COGNITIVE_URL` | `/api/cognitive` (standalone), `/api/ai/cognitive-node` (behind HYDRA-UMC-SERVER) | where the node is reached from; the session is sent only to a same-origin address |
| `VITE_COGNITIVE_TIMEOUT_MS` | `20000` | 1000 to 120000 |

Served on its own, `scripts/serve_static.py` forwards `/api/cognitive` to the node (`--cognitive URL`, default `http://127.0.0.1:8096`) and **only** `POST
/narrative`: any other method or path under that prefix is a `403`. It presents `HYDRA_UMC_COGNITIVE_NODE_TOKEN` (or `..._FILE`) on that call only.

## 2. The Fleet card (`VITE_FLEET_ENABLED=true`)

A table of every series the anomaly detector follows, from `GET /fleet` of the detector (see its `docs/API.md`, "Fleet view and maintenance proposals"): the
last score, the drift (the recent mean score over the healthy reference) and the state, worst first: sustained drift, drifting, anomalous, normal, no data
yet. The card says how many maintenance proposals the detector has sent for a series; it does not decide on them. A detector with the fleet view off
(`404`), a refused session, a timeout and an answer that cannot be read each get a sentence in the language of the reader; a row that cannot be read is left
out and counted.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_FLEET_ENABLED` | `false` | only the exact word `true` shows the card |
| `VITE_FLEET_REFRESH_MS` | `15000` | 5000 to 3600000; `0` refreshes only when the button is pressed |

## 3. Embedded in STUDIO (`?embed=1`)

Served by HYDRA-UMC-SERVER at `/dashboard-ai` the page shares the origin, and therefore the login, of STUDIO. With `?embed=1` it leaves out its own
heading and posts `{ "type": "hydra-dashboard-ai:height", "height": <pixels> }` to its parent, **to the origin of the page itself** and never to `*`, so the
frame can follow its height. Outside a frame, or without `?embed=1`, nothing of this runs.

### Contract for the other side (not done here)

* **HYDRA-UMC-STUDIO** adds a panel with `<iframe src="/dashboard-ai/?embed=1">`, listens for the message above (checking `event.origin === location.origin`
  and `event.source` against its frame) and sets the height of the frame.
* **HYDRA-UMC-SERVER** must let that frame exist: its answer for `/dashboard-ai` needs `frame-ancestors 'self'` (and no `X-Frame-Options: DENY`), and its
  relay needs two routes the page already asks for: `GET /api/ai/anomaly-detector/fleet` and `POST /api/ai/cognitive-node/narrative` (same roles as the other
  AI routes; `narrative` forwards only that call). Until they exist, the Fleet card shows "the detector has the fleet view switched off" (a `404`) and the
  language-model sentence falls back to the statistical one, both behind the server; served on its own they work.
* `scripts/serve_static.py` itself keeps `frame-ancestors 'none'`: it is a different origin from STUDIO, so framing it would not share the login anyway.
