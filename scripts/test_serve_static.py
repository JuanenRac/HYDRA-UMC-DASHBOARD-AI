#!/usr/bin/env python3
# =============================================================================
# HYDRA-UMC-DASHBOARD-AI - scripts/test_serve_static.py
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0-or-later - see LICENSE
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


class ContentSecurityPolicyTests(unittest.TestCase):
    def test_the_default_policy_allows_only_the_page_itself(self) -> None:
        from serve_static import build_csp

        policy = build_csp()
        self.assertIn("script-src 'self'", policy)
        self.assertNotIn("unsafe-inline", policy.split("style-src")[0])  # no inline script
        self.assertIn("connect-src 'self';", policy)
        self.assertIn("object-src 'none'", policy)
        self.assertIn("frame-ancestors 'none'", policy)
        self.assertIn("base-uri 'self'", policy)

    def test_extra_origins_go_only_into_connect_src(self) -> None:
        from serve_static import build_csp

        policy = build_csp("default", ("http://127.0.0.1:8095", "https://data.example.org"))
        self.assertIn("connect-src 'self' http://127.0.0.1:8095 https://data.example.org;", policy)
        self.assertEqual(policy.count("http://127.0.0.1:8095"), 1)

    def test_off_custom_and_bad_origins(self) -> None:
        from serve_static import build_csp

        self.assertIsNone(build_csp("off"))
        self.assertEqual(build_csp("default-src 'none'"), "default-src 'none'")
        for bad in ("data.example.org", "http://a; script-src *", "http://a b"):
            with self.subTest(bad), self.assertRaises(ValueError):
                build_csp("default", (bad,))

    def _serve(self, **options):  # starts serve() on a free port in a thread and returns (url, stop)
        import functools
        from http.server import ThreadingHTTPServer

        from serve_static import QuietHandler, build_csp

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        (Path(tmp.name) / "index.html").write_text("<html></html>", encoding="utf-8")
        handler_class = type("H", (QuietHandler,), {"csp_policy": build_csp(**options)})
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(handler_class, directory=tmp.name))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        def stop() -> None:
            httpd.shutdown()
            thread.join(timeout=2)
            httpd.server_close()

        self.addCleanup(stop)
        return f"http://127.0.0.1:{httpd.server_address[1]}"

    def test_every_answer_carries_the_policy_and_off_sends_none(self) -> None:
        url = self._serve(setting="default", connect_origins=("http://127.0.0.1:8095",))
        with urllib.request.urlopen(url + "/", timeout=5) as response:
            self.assertIn("http://127.0.0.1:8095", response.headers.get("Content-Security-Policy"))
        with self.assertRaises(urllib.error.HTTPError) as caught:  # an error answer carries it too
            urllib.request.urlopen(url + "/missing", timeout=5)
        self.assertIsNotNone(caught.exception.headers.get("Content-Security-Policy"))
        caught.exception.close()
        off = self._serve(setting="off")
        with urllib.request.urlopen(off + "/", timeout=5) as response:
            self.assertIsNone(response.headers.get("Content-Security-Policy"))


if __name__ == "__main__":
    unittest.main()


class UpstreamTokenTests(unittest.TestCase):
    """The Bearer token of a service is presented by the proxy, only on the calls of the dashboard."""

    def setUp(self) -> None:
        import functools
        import json
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        from serve_static import QuietHandler

        seen: list[tuple[str, str, str | None]] = []
        self.seen = seen

        class Upstream(BaseHTTPRequestHandler):
            def log_message(self, format, *args):  # noqa: A002, ANN001, ANN002
                pass

            def _reply(self) -> None:
                if self.command == "POST":
                    self.rfile.read(int(self.headers.get("Content-Length", "0")))
                seen.append((self.command, self.path, self.headers.get("Authorization")))
                payload = json.dumps({"ok": True}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            do_GET = do_POST = _reply  # noqa: N815

        self.upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
        threading.Thread(target=self.upstream.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{self.upstream.server_address[1]}"
        self._tmpdir = tempfile.TemporaryDirectory()
        (Path(self._tmpdir.name) / "index.html").write_text("<html></html>", encoding="utf-8")
        handler_class = type(
            "TokenProxyingHandler",
            (QuietHandler,),
            {"proxy_routes": {"/api/datalake": url, "/api/anomaly": url}, "proxy_tokens": {"/api/datalake": "lake-token-1234567890", "/api/anomaly": "detector-token-1234"}},
        )
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(handler_class, directory=self._tmpdir.name))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def tearDown(self) -> None:
        for server in (self.httpd, self.upstream):
            server.shutdown()
            server.server_close()
        self._tmpdir.cleanup()

    def _call(self, method: str, path: str) -> None:
        request = urllib.request.Request(f"{self.base}{path}", data=b"{}" if method == "POST" else None, method=method, headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(request).read()
        except urllib.error.HTTPError as error:
            error.read()

    def test_the_calls_of_the_dashboard_carry_the_token_of_their_service(self) -> None:
        self._call("GET", "/api/datalake/query?sourceId=a")
        self._call("GET", "/api/datalake/series?kind=vibration")
        self._call("GET", "/api/anomaly/stats")
        self._call("POST", "/api/anomaly/detect")
        self.assertEqual(
            [(m, p, a) for m, p, a in self.seen],
            [
                ("GET", "/query?sourceId=a", "Bearer lake-token-1234567890"),
                ("GET", "/series?kind=vibration", "Bearer lake-token-1234567890"),
                ("GET", "/stats", "Bearer detector-token-1234"),
                ("POST", "/detect", "Bearer detector-token-1234"),
            ],
        )

    def test_nothing_else_carries_a_token_so_the_proxy_cannot_change_what_a_service_holds(self) -> None:
        self._call("POST", "/api/anomaly/baseline/fit")
        self._call("POST", "/api/anomaly/drift/observe")
        self._call("POST", "/api/datalake/ingest")
        self._call("POST", "/api/datalake/retention/apply")
        self._call("GET", "/api/datalake/retention")
        self._call("GET", "/api/anomaly/detect")
        self.assertTrue(self.seen)
        self.assertTrue(all(auth is None for _m, _p, auth in self.seen), self.seen)

    def test_a_path_that_only_starts_like_an_allowed_one_gets_no_token(self) -> None:
        self._call("GET", "/api/datalake/query/../retention")
        self._call("GET", "/api/datalake/queryx")
        self._call("POST", "/api/anomaly/detect/fit")
        self.assertTrue(all(auth is None for _m, _p, auth in self.seen), self.seen)

    def test_the_browser_never_receives_the_token(self) -> None:
        with urllib.request.urlopen(f"{self.base}/api/datalake/stats") as response:
            self.assertNotIn("lake-token", str(response.headers))
            self.assertNotIn("lake-token", response.read().decode())


class UpstreamTokenSettingsTests(unittest.TestCase):
    def test_tokens_come_from_the_names_the_services_read_or_from_a_file(self) -> None:
        from serve_static import read_upstream_tokens

        with tempfile.TemporaryDirectory() as folder:
            token_file = Path(folder) / "detector.token"
            token_file.write_text("from-a-file-1234567890\nsecond line ignored\n", encoding="utf-8")
            tokens = read_upstream_tokens({"HYDRA_UMC_DATALAKE_TOKEN": "  lake-token  ", "HYDRA_UMC_ANOMALY_TOKEN_FILE": str(token_file)})
        self.assertEqual(tokens, {"/api/datalake": "lake-token", "/api/anomaly": "from-a-file-1234567890"})

    def test_the_read_token_wins_over_the_general_one_and_nothing_set_is_nothing(self) -> None:
        from serve_static import read_upstream_tokens

        self.assertEqual(read_upstream_tokens({"HYDRA_UMC_DATALAKE_READ_TOKEN": "read-one", "HYDRA_UMC_DATALAKE_TOKEN": "write-one"}), {"/api/datalake": "read-one"})
        self.assertEqual(read_upstream_tokens({}), {})

    def test_a_token_with_a_line_break_or_a_missing_file_is_refused(self) -> None:
        from serve_static import read_upstream_tokens

        with self.assertRaises(SystemExit):
            read_upstream_tokens({"HYDRA_UMC_ANOMALY_TOKEN": "a\nb"})
        with self.assertRaises(SystemExit):
            read_upstream_tokens({"HYDRA_UMC_ANOMALY_TOKEN_FILE": "/definitely/not/here"})

    def test_tokens_are_not_presented_by_a_server_that_is_open_to_the_network(self) -> None:
        from serve_static import serve

        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "index.html").write_text("<html></html>", encoding="utf-8")
            with self.assertRaises(SystemExit) as caught:
                serve(Path(folder), "0.0.0.0", 0, upstream_tokens={"/api/anomaly": "t" * 20})
            self.assertIn("loopback", str(caught.exception))
