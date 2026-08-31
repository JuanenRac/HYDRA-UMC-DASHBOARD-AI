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

    def test_refuses_to_serve_a_directory_with_no_index_html(self) -> None:
        empty_dir = Path(self._tmpdir.name) / "empty"
        empty_dir.mkdir()
        with self.assertRaises(SystemExit):
            serve(empty_dir, "127.0.0.1", 0)


if __name__ == "__main__":
    unittest.main()
