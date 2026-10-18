#!/usr/bin/env python3
# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - scripts/test_serve_static.py
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================
"""Real end-to-end tests for serve_static.py's real ThreadingHTTPServer,
using stdlib `unittest` (not pytest) deliberately - this is otherwise a
pure JS/TS repo (Vitest is its real test runner for src/), so this one
Python script stays runnable with `python3 -m unittest` and adds no new
toolchain requirement for the rest of the project."""
from __future__ import annotations

import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from serve_static import serve


class ServeStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.directory = Path(self._tmpdir.name)
        (self.directory / "index.html").write_text("<html>real dashboard</html>", encoding="utf-8")
        (self.directory / "app.js").write_text("console.log('real');", encoding="utf-8")

        self.server_thread = None
        self.port = None
        self._start_server()

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def _start_server(self) -> None:
        import functools
        from http.server import ThreadingHTTPServer
        from serve_static import QuietHandler

        handler = functools.partial(QuietHandler, directory=str(self.directory))
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        self.server_thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.server_thread.start()

        def stop() -> None:
            self.httpd.shutdown()
            # Real Windows-specific quirk found live: without joining
            # before the interpreter starts finalizing, this daemon
            # thread's own selector.select() can still be mid-poll on a
            # socket the interpreter is simultaneously tearing down,
            # producing a spurious WinError 10038 traceback and, in the
            # worst case, a "could not acquire lock ... at interpreter
            # shutdown" fatal error - never seen on the real Linux
            # deployment target, but a real, fixable race on this dev
            # machine regardless.
            self.server_thread.join(timeout=2)
            self.httpd.server_close()

        self.addCleanup(stop)

    def _get(self, path: str) -> tuple[int, str]:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=5) as resp:
                return resp.status, resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            with e:
                return e.code, e.read().decode("utf-8")

    def test_serves_index_html_at_root(self) -> None:
        status, body = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn("real dashboard", body)

    def test_serves_a_real_asset(self) -> None:
        status, body = self._get("/app.js")
        self.assertEqual(status, 200)
        self.assertIn("console.log", body)

    def test_missing_file_is_a_real_404_not_index_html(self) -> None:
        # No SPA fallback: this app has no client-side routing (see
        # serve_static.py's own module docstring for why that was
        # actually checked, not assumed).
        status, body = self._get("/does-not-exist")
        self.assertEqual(status, 404)
        self.assertNotIn("real dashboard", body)

    def test_a_directory_without_an_index_is_not_listed(self) -> None:
        # the built assets/ folder has no index.html: it used to be listed file by file
        (self.directory / "assets").mkdir()
        (self.directory / "assets" / "secret-name.js").write_text("x", encoding="utf-8")
        status, body = self._get("/assets/")
        self.assertEqual(status, 404)
        self.assertNotIn("secret-name.js", body)
        # the file itself is still served
        self.assertEqual(self._get("/assets/secret-name.js")[0], 200)

    def test_responses_carry_the_hardening_headers(self) -> None:
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/", timeout=5) as resp:
            self.assertEqual(resp.headers.get("X-Content-Type-Options"), "nosniff")
            self.assertEqual(resp.headers.get("X-Frame-Options"), "DENY")
            self.assertEqual(resp.headers.get("Referrer-Policy"), "no-referrer")

    def test_a_path_outside_the_served_directory_is_never_served(self) -> None:
        outside = Path(self._tmpdir.name).parent / "outside-the-root.txt"
        outside.write_text("do not serve", encoding="utf-8")
        self.addCleanup(lambda: outside.unlink(missing_ok=True))
        for path in ("/../outside-the-root.txt", "/%2e%2e/outside-the-root.txt", "/..%2foutside-the-root.txt"):
            status, body = self._get(path)
            self.assertNotEqual(status, 200, path)
            self.assertNotIn("do not serve", body, path)

    def test_a_client_that_sends_nothing_is_dropped_instead_of_holding_a_thread(self) -> None:
        import socket
        import time

        from serve_static import QuietHandler

        original = QuietHandler.timeout
        QuietHandler.timeout = 0.3
        self.addCleanup(lambda: setattr(QuietHandler, "timeout", original))
        with socket.create_connection(("127.0.0.1", self.port), timeout=5) as client:
            started = time.monotonic()
            self.assertEqual(client.recv(1), b"")  # sends nothing; the server closes by itself
            self.assertLess(time.monotonic() - started, 3)

    def test_refuses_to_serve_a_directory_with_no_index_html(self) -> None:
        empty_dir = Path(self._tmpdir.name) / "empty"
        empty_dir.mkdir()
        with self.assertRaises(SystemExit):
            serve(empty_dir, "127.0.0.1", 0)


class ProxyTests(unittest.TestCase):
    """The two same-origin prefixes reach their upstream; nothing else does."""

    def setUp(self) -> None:
        import functools
        import json
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        from serve_static import QuietHandler

        seen: list[tuple[str, str, bytes]] = []
        self.seen = seen

        class Upstream(BaseHTTPRequestHandler):
            def log_message(self, format, *args):  # noqa: A002, ANN001, ANN002
                pass

            def _reply(self, body: bytes = b"") -> None:
                seen.append((self.command, self.path, body))
                payload = json.dumps({"path": self.path}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_GET(self) -> None:  # noqa: N802
                self._reply()

            def do_POST(self) -> None:  # noqa: N802
                self._reply(self.rfile.read(int(self.headers.get("Content-Length", "0"))))

        self.upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
        threading.Thread(target=self.upstream.serve_forever, daemon=True).start()
        upstream_url = f"http://127.0.0.1:{self.upstream.server_address[1]}"

        self._tmpdir = tempfile.TemporaryDirectory()
        (Path(self._tmpdir.name) / "index.html").write_text("<html></html>", encoding="utf-8")
        handler_class = type(
            "TestProxyingHandler",
            (QuietHandler,),
            {"proxy_routes": {"/api/datalake": upstream_url, "/api/anomaly": upstream_url}},
        )
        self.httpd = ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(handler_class, directory=self._tmpdir.name)
        )
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def tearDown(self) -> None:
        for server in (self.httpd, self.upstream):
            server.shutdown()
            server.server_close()
        self._tmpdir.cleanup()

    def test_get_is_forwarded_without_the_prefix(self) -> None:
        with urllib.request.urlopen(f"{self.base}/api/datalake/query?sourceId=a&limit=5") as response:
            self.assertEqual(response.status, 200)
        self.assertEqual(self.seen[0][:2], ("GET", "/query?sourceId=a&limit=5"))

    def test_post_body_is_forwarded(self) -> None:
        request = urllib.request.Request(
            f"{self.base}/api/anomaly/detect", data=b'{"window":[1,2]}', method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request) as response:
            self.assertEqual(response.status, 200)
        self.assertEqual(self.seen[0], ("POST", "/detect", b'{"window":[1,2]}'))

    def test_post_elsewhere_is_refused_and_a_dead_upstream_is_a_502(self) -> None:
        request = urllib.request.Request(f"{self.base}/other", data=b"{}", method="POST")
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(request)
        self.assertEqual(caught.exception.code, 405)
        self.assertEqual(self.seen, [])

        self.upstream.shutdown()
        self.upstream.server_close()
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(f"{self.base}/api/datalake/stats")
        self.assertEqual(caught.exception.code, 502)
        # tearDown shuts it down again: serve_forever has ended, so restart-proof it
        self.upstream.shutdown = lambda: None  # type: ignore[method-assign]
        self.upstream.server_close = lambda: None  # type: ignore[method-assign]


if __name__ == "__main__":
    unittest.main()
