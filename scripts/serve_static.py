#!/usr/bin/env python3
# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - scripts/serve_static.py
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================
"""Real gap found auditing the ecosystem against actual CM5 hardware: this
project builds a real, deployable static SPA (`npm run build` -> dist/),
but nothing on the CM5 ever served it - unlike HYDRA-UMC-STUDIO, which
gets folded into HYDRA-UMC-SERVER's own public/, this dashboard talks
directly to HYDRA-UMC-DATALAKE/HYDRA-UMC-ANOMALY-DETECTOR by their own
configured base URLs (see vite.config.ts's own comment) - it needs no
backend of its own, just a real static file server on its own port.

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
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        pass  # quiet by default, same reasoning as this ecosystem's other services


def serve(directory: Path, addr: str, port: int) -> None:
    if not (directory / "index.html").is_file():
        raise SystemExit(
            f"error: {directory} has no index.html - run 'npm run build' first "
            "(or point --dir at the real dist/ output)."
        )
    handler = functools.partial(QuietHandler, directory=str(directory))
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
    args = parser.parse_args()

    serve(args.dir.resolve(), args.addr, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
