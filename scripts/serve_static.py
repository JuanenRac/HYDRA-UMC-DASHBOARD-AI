#!/usr/bin/env python3
# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - scripts/serve_static.py
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0-or-later - see LICENSE
# =============================================================================
"""Real gap found auditing the ecosystem against actual CM5 hardware: this
project builds a real, deployable static SPA (`npm run build` -> dist/),
but nothing on the CM5 ever served it - unlike HYDRA-UMC-STUDIO, which
gets folded into HYDRA-UMC-SERVER's own public/, this dashboard calls
HYDRA-UMC-DATALAKE and HYDRA-UMC-ANOMALY-DETECTOR from the browser, and
neither service sends CORS headers, so this server also forwards two
same-origin path prefixes to them: /api/datalake/* to the DATALAKE and
/api/anomaly/* to the ANOMALY-DETECTOR (loopback by default). Only GET and POST
are forwarded, only to those two fixed upstreams, and nothing else is proxied.

Deliberately plain stdlib (`http.server`), not a second Node runtime on
the CM5 just to serve pre-built static files - same "prefer stdlib"
reasoning as every other internal service this ecosystem installs.
No SPA client-side routing exists in this app (no react-router - checked
against src/App.tsx and package.json before writing this), so this is
intentionally a plain static file server, not a SPA-fallback-to-index.html
server - a request for a path with no matching file is a real 404, not
silently rewritten to index.html.
"""
from __future__ import annotations

import argparse
import functools
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_PROXY_BODY_BYTES = 4 * 1024 * 1024

# The services can ask for a Bearer token of their own (the data lake for its reads, the anomaly detector for what it
# scores). In this standalone mode the proxy presents it, so the page never holds it. It is presented only on the calls
# the dashboard makes and nothing else: an ordinary read of the data lake, the status of the detector and the scoring
# of a window. Everything else (fitting the baseline, the writes of the data lake, its retention) goes out without
# the token and the service refuses it, so this server cannot be used to change what the services hold.
TOKEN_ALLOWED_CALLS: dict[str, frozenset[tuple[str, str]]] = {
    "/api/datalake": frozenset({("GET", p) for p in ("/query", "/aggregate", "/stats", "/stats/range", "/series", "/health")}),
    "/api/anomaly": frozenset({("GET", "/stats"), ("POST", "/detect")}),
}
# The names the services themselves read, each one also as <NAME>_FILE (a file whose first line is the token).
TOKEN_ENVIRONMENT: dict[str, tuple[str, ...]] = {
    "/api/datalake": ("HYDRA_UMC_DATALAKE_READ_TOKEN", "HYDRA_UMC_DATALAKE_TOKEN"),
    "/api/anomaly": ("HYDRA_UMC_ANOMALY_TOKEN",),
}


def read_upstream_tokens(environ: dict[str, str] | None = None) -> dict[str, str]:
    """The tokens to present, by proxy prefix, from the environment (or, for NAME_FILE, from the first line of a file).
    A token with a control character or a line break is refused: it could split a header."""
    env = os.environ if environ is None else environ
    tokens: dict[str, str] = {}
    for prefix, names in TOKEN_ENVIRONMENT.items():
        for name in names:
            value = (env.get(name) or "").strip()
            path = (env.get(name + "_FILE") or "").strip()
            if not value and path:
                try:
                    value = Path(path).read_text(encoding="utf-8").splitlines()[0].strip()
                except (OSError, IndexError) as error:
                    raise SystemExit(f"error: cannot read the token file {path} ({name}_FILE): {error}")
            if not value:
                continue
            if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
                raise SystemExit(f"error: the token of {name} has a control character")
            tokens[prefix] = value
            break
    return tokens

# The Content-Security-Policy of the dashboard page. The page loads its own scripts only (no inline script, no
# plugin), keeps inline styles because the UI sets style attributes, and may call only its own origin (the two
# same-origin proxy prefixes) plus the origins the deployment adds with --connect-src for VITE_DATALAKE_URL /
# VITE_ANOMALY_URL. `--csp off` sends no policy (a front proxy that sets it itself); any other value is used as
# the complete policy.
CSP_DIRECTIVES = (
    ("default-src", ("'self'",)),
    ("script-src", ("'self'",)),
    ("style-src", ("'self'", "'unsafe-inline'")),
    ("img-src", ("'self'", "data:")),
    ("font-src", ("'self'", "data:")),
    ("object-src", ("'none'",)),
    ("base-uri", ("'self'",)),
    ("form-action", ("'self'",)),
    ("frame-ancestors", ("'none'",)),
)


def build_csp(setting: str = "default", connect_origins: tuple[str, ...] = ()) -> str | None:
    """The policy header value for a --csp setting: None for "off", the setting itself when it is a custom
    policy, else the default with connect-src limited to this origin and the given ones."""
    value = (setting or "default").strip()
    if value.lower() == "off":
        return None
    if value.lower() != "default":
        return value
    for origin in connect_origins:
        if not origin or any(ch in origin for ch in " ;,'\"") or "://" not in origin:
            raise ValueError(f"--connect-src needs plain origins such as http://127.0.0.1:8095, got {origin!r}")
    directives = [f"{name} {' '.join(sources)}" for name, sources in CSP_DIRECTIVES]
    directives.insert(5, "connect-src " + " ".join(("'self'", *connect_origins)))
    return "; ".join(directives)
UPSTREAM_TIMEOUT_SECONDS = 10.0


class QuietHandler(SimpleHTTPRequestHandler):
    # Seconds a client may stay silent before its connection is dropped, so a
    # client that connects and sends nothing cannot hold a handler thread forever.
    timeout = 15.0

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        pass  # quiet by default, same reasoning as this ecosystem's other services

    # prefix -> upstream base URL; set per server by serve()
    proxy_routes: dict[str, str] = {}
    # prefix -> Bearer token presented on the calls of TOKEN_ALLOWED_CALLS; set per server by serve()
    proxy_tokens: dict[str, str] = {}
    # the Content-Security-Policy sent with every answer; None sends none. serve() sets it from --csp.
    csp_policy: str | None = build_csp()

    def _proxy_target(self) -> str | None:
        for prefix, upstream in self.proxy_routes.items():
            if self.path == prefix or self.path.startswith(prefix + "/") or self.path.startswith(prefix + "?"):
                return upstream.rstrip("/") + (self.path[len(prefix):] or "/")
        return None

    def _token_for(self) -> str | None:
        """The token to present for this call, or None: only the calls the dashboard makes get one."""
        for prefix, token in self.proxy_tokens.items():
            if self.path == prefix or self.path.startswith(prefix + "/") or self.path.startswith(prefix + "?"):
                rest = self.path[len(prefix):] or "/"
                path = rest.split("?", 1)[0]
                if (self.command, path) in TOKEN_ALLOWED_CALLS.get(prefix, frozenset()):
                    return token
        return None

    def _forward(self, target: str, body: bytes | None) -> None:
        request = urllib.request.Request(target, data=body, method=self.command)
        content_type = self.headers.get("Content-Type")
        if content_type:
            request.add_header("Content-Type", content_type)
        token = self._token_for()
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:  # noqa: S310
                status, payload, upstream_type = response.status, response.read(MAX_PROXY_BODY_BYTES + 1), response.headers.get("Content-Type")
        except urllib.error.HTTPError as err:
            status, payload, upstream_type = err.code, err.read(MAX_PROXY_BODY_BYTES + 1), err.headers.get("Content-Type")
        except (urllib.error.URLError, TimeoutError, OSError):
            self.send_error(502, "Upstream service unavailable")
            return
        if len(payload) > MAX_PROXY_BODY_BYTES:
            self.send_error(502, "Upstream response too large")
            return
        self.send_response(status)
        self.send_header("Content-Type", upstream_type or "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        target = self._proxy_target()
        if target is None:
            super().do_GET()
            return
        self._forward(target, None)

    def do_POST(self) -> None:  # noqa: N802
        target = self._proxy_target()
        if target is None:
            self.send_error(405, "Method not allowed")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_PROXY_BODY_BYTES:
            self.send_error(413, "Request body too large")
            return
        self._forward(target, self.rfile.read(length))

    def end_headers(self) -> None:
        # the dashboard is only ever a page of its own: no sniffing of a file's type,
        # no framing by another site, no referrer sent to the services it calls
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        if self.csp_policy:
            self.send_header("Content-Security-Policy", self.csp_policy)
        super().end_headers()

    def list_directory(self, path):  # noqa: ANN001, ANN201
        # a directory without an index.html (the built assets/ folder) used to be
        # listed file by file; the dashboard has no use for that
        self.send_error(404, "File not found")
        return None


def serve(
    directory: Path,
    addr: str,
    port: int,
    datalake: str = "http://127.0.0.1:8095",
    anomaly: str = "http://127.0.0.1:8097",
    csp: str | None = "default",
    connect_origins: tuple[str, ...] = (),
    upstream_tokens: dict[str, str] | None = None,
    allow_tokens_off_loopback: bool = False,
) -> None:
    if upstream_tokens and addr not in ("127.0.0.1", "::1", "localhost") and not allow_tokens_off_loopback:
        # This server would let anyone who can reach it read the data lake and score windows as if signed in.
        raise SystemExit(
            "error: service tokens are set but --addr is not a loopback address; bind to 127.0.0.1 (behind HYDRA-UMC-SERVER "
            "at /dashboard-ai the page uses the session of STUDIO instead) or pass --allow-tokens-off-loopback."
        )
    if not (directory / "index.html").is_file():
        raise SystemExit(
            f"error: {directory} has no index.html - run 'npm run build' first "
            "(or point --dir at the real dist/ output)."
        )
    handler_class = type(
        "ProxyingHandler",
        (QuietHandler,),
        {
            "proxy_routes": {"/api/datalake": datalake, "/api/anomaly": anomaly},
            "proxy_tokens": dict(upstream_tokens or {}),
            "csp_policy": build_csp(csp or "default", connect_origins),
        },
    )
    handler = functools.partial(handler_class, directory=str(directory))
    server = ThreadingHTTPServer((addr, port), handler)
    print(f"[dashboard-ai] serving {directory} on http://{addr}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("[dashboard-ai] shutting down")


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve HYDRA-UMC-DASHBOARD-AI's built static SPA.")
    parser.add_argument("--dir", type=Path, default=Path(__file__).resolve().parents[1] / "dist",
                         help="Directory to serve (default: <repo>/dist, the real 'npm run build' output).")
    parser.add_argument("--addr", default="127.0.0.1", help="Address to bind (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8115, help="Port to bind (default: 8115).")
    parser.add_argument("--datalake", default="http://127.0.0.1:8095",
                         help="HYDRA-UMC-DATALAKE base URL behind /api/datalake (default: http://127.0.0.1:8095).")
    parser.add_argument("--anomaly", default="http://127.0.0.1:8097",
                         help="HYDRA-UMC-ANOMALY-DETECTOR base URL behind /api/anomaly (default: http://127.0.0.1:8097).")
    parser.add_argument("--csp", default=os.environ.get("HYDRA_DASHBOARD_CSP", "default"),
                         help='Content-Security-Policy: "default" (own scripts only, connections to this origin), "off" for none '
                              "(or HYDRA_DASHBOARD_CSP), or a complete policy used as given.")
    parser.add_argument("--connect-src", action="append", default=[], metavar="ORIGIN",
                         help="An extra origin the page may call (repeatable), for a build with VITE_DATALAKE_URL / VITE_ANOMALY_URL.")
    parser.add_argument("--allow-tokens-off-loopback", action="store_true",
                         help="Allow the service tokens (HYDRA_UMC_DATALAKE_READ_TOKEN, HYDRA_UMC_ANOMALY_TOKEN, each also as ..._FILE) "
                              "to be presented by a server bound to an address other than loopback. Off by default.")
    args = parser.parse_args()

    try:
        build_csp(args.csp, tuple(args.connect_src))
    except ValueError as error:
        parser.error(str(error))
    serve(args.dir.resolve(), args.addr, args.port, args.datalake, args.anomaly, args.csp, tuple(args.connect_src),
          read_upstream_tokens(), args.allow_tokens_off_loopback)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
