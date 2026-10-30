#!/usr/bin/env node
/**
 * Takes the screenshots of the README: the dashboard in a real browser (headless Microsoft Edge) against the real HYDRA-UMC-DATALAKE and HYDRA-UMC-ANOMALY-DETECTOR
 * started on this computer in a throw-away folder, fed with made-up vibration samples (a steady tone, then the same tone with an extra one). Nothing real is behind them.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 *
 *   npm run build                                the dashboard built (dist/)
 *   node tools/make_screenshots.mjs              writes images/screenshots/<name>.png at 1920x1080
 *   node tools/make_screenshots.mjs --out DIR    writes them in DIR instead, to look at them before they replace the ones in the repository
 *
 * It needs Edge (the one Windows has), the two sibling repositories HYDRA-UMC-DATALAKE and HYDRA-UMC-ANOMALY-DETECTOR with their Python environments (.venv), and
 * Playwright, which it takes from PLAYWRIGHT_DIR (a folder that has node_modules/@playwright/test). Ports 8095, 8097 and 8115 must be free.
 * It takes no mouse or keyboard of the desktop: the browser has no window. Everything it starts is stopped at the end and its folder is deleted.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const root = path.resolve(repo, "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? path.join(repo, "e2e"), "package.json"));
const { chromium } = require("@playwright/test");
const outIndex = process.argv.indexOf("--out");
const out = path.resolve(outIndex > 0 ? process.argv[outIndex + 1] : path.join(repo, "images", "screenshots"));
fs.mkdirSync(out, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const portFree = port => new Promise(resolve => { const probe = net.createServer(); probe.once("error", () => resolve(false)); probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true))); });
const venvPython = dir => path.join(dir, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
const datalakeDir = path.join(root, "HYDRA-UMC-DATALAKE");
const anomalyDir = path.join(root, "HYDRA-UMC-ANOMALY-DETECTOR");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "hydra-dash-shots-"));
const children = [];
const start = (command, args, options) => { const child = spawn(command, args, { stdio: "ignore", ...options }); children.push(child); return child; };
for (const port of [8095, 8097, 8115]) if (!(await portFree(port))) throw new Error(`port ${port} must be free`);

const SAMPLE_MS = 1;          // one sample per millisecond: 1000 Hz
const T0 = Date.now() - 10 * 60 * 1000;   // ten minutes ago: the panels look at the latest hour
const tone = (index, extra) => 4 * Math.sin(2 * Math.PI * 50 * index / 1000) + (extra ? 3 * Math.sin(2 * Math.PI * 210 * index / 1000) : 0) + 0.25 * Math.sin(index * 12.9898) ;
let browser;
try {
  start(venvPython(datalakeDir), ["-m", "hydra_umc_datalake.main", "--db", path.join(work, "datalake.sqlite3"), "--port", "8095"], { cwd: datalakeDir, env: { ...process.env, PYTHONPATH: "src" } });
  for (let tries = 0; tries < 80; tries += 1) { try { await fetch("http://127.0.0.1:8095/health"); break; } catch { await sleep(250); } }
  // 1280 healthy samples to learn from, then 192 samples of which the last window carries an extra tone
  const post = (index, extra) => fetch("http://127.0.0.1:8095/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: "robot-1", kind: "vibration", timestamp: T0 + index * SAMPLE_MS, fields: { value: Math.round(tone(index, extra) * 1000) / 1000 } }) });
  for (let index = 0; index < 1472; index += 1) { const reply = await post(index, index >= 1408); if (!reply.ok) throw new Error(`ingest refused: ${reply.status}`); }
  start(venvPython(anomalyDir), ["-m", "hydra_umc_anomaly_detector.main", "--port", "8097", "--datalake-url", "http://127.0.0.1:8095", "--source-id", "robot-1", "--kind", "vibration", "--field", "value",
    "--window-size", "64", "--train-start", String(T0), "--train-end", String(T0 + 1279 * SAMPLE_MS)], { cwd: anomalyDir, env: { ...process.env, PYTHONPATH: "src" } });
  for (let tries = 0; tries < 80; tries += 1) { try { const stats = await (await fetch("http://127.0.0.1:8097/stats")).json(); if (stats.fitted) break; } catch { /* not up yet */ } await sleep(250); }
  start(process.platform === "win32" ? "py" : "python3", [...(process.platform === "win32" ? ["-3"] : []), path.join(repo, "scripts", "serve_static.py"), "--port", "8115"], { cwd: repo });
  for (let tries = 0; tries < 80; tries += 1) { try { await fetch("http://127.0.0.1:8115/"); break; } catch { await sleep(250); } }

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "en-US" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8115/");
  await page.waitForTimeout(1500);
  await page.getByLabel("Kind").first().fill("vibration");   // the Trend Summary starts with another kind of series
  const submits = page.locator("form button[type=submit]");
  for (let index = 0; index < await submits.count(); index += 1) { await submits.nth(index).click(); await page.waitForTimeout(2500); }
  // the time stamps of the samples carry the date of the day it is taken: the pictures keep the numbers only
  await page.evaluate(() => { for (const element of document.querySelectorAll("*")) if (element.children.length === 0 && /^at \d{1,2}\/\d{1,2}\/\d{4}/.test(element.textContent ?? "")) element.style.visibility = "hidden"; });
  await page.mouse.move(960, 1075);
  await page.screenshot({ path: path.join(out, "dashboard.png"), fullPage: false });
  console.log("wrote", path.join(out, "dashboard.png"));
} finally {
  await browser?.close();
  for (const child of children) try { child.kill(); } catch { /* already gone */ }
  await sleep(500);
  fs.rmSync(work, { recursive: true, force: true });
}
