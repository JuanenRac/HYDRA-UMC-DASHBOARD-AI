# Remaining useful life card

The dashboard can show an estimate of the days left until the trend of the anomaly scores of one source reaches a limit. It is a reading card: it asks, it shows, it changes nothing.

## Switch

The card needs two yeses and is **off by default**. The build must allow it, and the running server must have the option open. With the default build there is no card on the page and the page calls neither `POST /rul` nor the server's setting. A build allows it at build time (Vite inlines these values):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_RUL_ENABLED` | `false` | only the exact word `true` allows the card (the server must also have it open, see below) |
| `VITE_RUL_URL` | the anomaly URL of the page | base URL of the detector that answers `POST /rul` |
| `VITE_RUL_SOURCE_ID`, `VITE_RUL_KIND`, `VITE_RUL_FIELD` | `robot-1`, `anomaly_score`, `value` | the series of scores read from the data lake (the detector in continuous mode writes its scores there) |
| `VITE_RUL_LIMIT` | `1` | the score that counts as worn out |
| `VITE_RUL_POINTS` | `200` | how many of the newest samples are sent (1 to 1000) |
| `VITE_RUL_WARN_DAYS` | `30` | warning when the earliest plausible day is within this many days |
| `VITE_RUL_CRITICAL_DAYS` | `7` | critical within this many days (never above the warning value) |
| `VITE_RUL_TIMEOUT_MS` | `5000` | time limit of the request to the detector |

## The server must have it open

With the build allowing the card, the page reads `GET /api/rul/config` of the server it is served from, once when it opens and with the session of STUDIO (the token is sent only to that same origin). The answer is `{ "enabled": bool, "maxPoints": number, "timeoutMs": number }`: whether the server has the option `rul.enabled` open (Server Admin, or `HYDRA_UMC_RUL=1` on the server) and the limits of its relay. The card is shown only for a clear `enabled: true`; the number of points sent is never above `maxPoints` and the time limit is never below `timeoutMs`.

Every other outcome leaves the card out and the rest of the page working: the server has it closed, has no such route (an older server or a page served on its own), refuses the session, fails, does not answer within a few seconds or answers anything that is not exactly those three fields. While the answer is awaited there is no card either. Nothing is shown to explain a missing card, because a closed option is the normal state.

A value that is missing or unusable (not a number, zero, negative, too large) falls back to its default. The form on the card can change the source, the kind, the field and the limit for one estimate.

## What the card does

1. Reads the newest samples of the series from HYDRA-UMC-DATALAKE (`GET /series` and `GET /query`, read-only).
2. Sends them to the detector as `POST /rul` with `{"points": [{"t": seconds, "score": number}], "limit": number}`.
3. Shows the answer.

The detector fits a Theil-Sen line (the median of the pairwise slopes), so a few wild samples do not move the trend, and gives a range from the 25th to the 75th percentile of those slopes.

| State | What the card shows |
|---|---|
| `estimated` | "About N days left", the range "Likely between L and H days" (or "At the earliest in L days" when the gentlest plausible trend does not rise), the slope per day, the current value of the trend and the number of samples |
| `insufficient_data` | "Not enough data yet to estimate", with the number of samples (the detector needs `--rul-min-points`, 8 by default) |
| `not_rising` | "The trend does not rise: no limit is approaching" |
| `limit_reached` | "The trend has already reached the limit", shown as critical |

A small chart draws the scores that were sent. The card always says that it is an estimate of a trend, not a promise.

## Warnings

The earliest plausible day (`daysLow`, else `daysToLimit`) decides, so a warning is not hidden by a lucky median. At or below `VITE_RUL_WARN_DAYS` the card shows a warning; at or below `VITE_RUL_CRITICAL_DAYS` it shows a critical notice. A trend that does not rise and a lack of data raise nothing.

## Failures

Every failure is shown inside the card and the rest of the page keeps working (the card also sits in its own error boundary):

| Failure | Text |
|---|---|
| the detector answers 404 | the detector has the remaining-useful-life route switched off (`--rul`) |
| no answer within the time limit | the detector did not answer in time |
| connection refused or lost | the detector or the data lake cannot be reached |
| 401 or 403 | the session was refused; sign in again in STUDIO |
| another error status | the service answered with an error, with its message |
| an answer that is not a valid estimate | the detector sent an answer that cannot be used |
| no samples in the data lake | the data lake holds no score samples for this source |

## Requirements and limits

* The detector must run with `--rul` (or `"rul": true` in its detector configuration). Without it the route answers 404 and the card says so.
* Served by HYDRA-UMC-SERVER the page reads through the relay of that server, which opens `POST /rul` to operators only while its option is on, and the same option decides whether the card appears. Served on its own (`scripts/serve_static.py`, no server behind it) there is no setting to read, so the card does not appear even when the build allows it.
* The estimate is only as good as the series: it assumes a roughly linear trend of the scores and says nothing about a sudden failure.
* Nothing here has been verified against a real machine; the tests use a simulated data lake and a simulated detector.

## Languages

The texts of the card are in English, Spanish, German, French, Italian, Japanese, Chinese and European Portuguese. The language is the one of the browser; an unknown one shows English.
