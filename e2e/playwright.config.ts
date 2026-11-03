// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - e2e/playwright.config.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The page is the real build (dist/, made with the Fleet card switched on) served by the real scripts/serve_static.py, so the Content-Security-Policy
// and the same-origin paths are the ones of a deployment. The two services behind it do not exist: every test answers their paths itself (tests/fakes.ts),
// and a path it did not answer reaches the proxy, finds nothing and shows up as a failed request.
// The browser is the Chromium that belongs to the exact version of @playwright/test pinned in package.json and package-lock.json.
import { defineConfig } from "@playwright/test";
import * as path from "path";

const port = Number(process.env.E2E_PORT || 4173);
const python = process.env.PYTHON || (process.platform === "win32" ? "py -3" : "python3");
const dist = path.join(__dirname, "..", "dist");
const script = path.join(__dirname, "..", "scripts", "serve_static.py");

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    screenshot: "only-on-failure",
    trace: "off",
    contextOptions: { reducedMotion: "reduce" },
    actionTimeout: 10_000,
  },
  webServer: {
    command: `${python} "${script}" --dir "${dist}" --port ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
