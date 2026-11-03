// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - e2e/tests/fakes.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// Fake HYDRA-UMC-DATALAKE and HYDRA-UMC-ANOMALY-DETECTOR: the paths the page asks (same origin, through the proxy of the static server) are answered here
// with made-up numbers. Nothing real is behind them.
import { test as base, expect, Page } from "@playwright/test";

export const LOCALES: Record<string, { locale: string; fleetTitle: string }> = {
  en: { locale: "en-US", fleetTitle: "Fleet" },
  es: { locale: "es-ES", fleetTitle: "Flota" },
  de: { locale: "de-DE", fleetTitle: "Flotte" },
  fr: { locale: "fr-FR", fleetTitle: "Flotte" },
  it: { locale: "it-IT", fleetTitle: "Flotta" },
  ja: { locale: "ja-JP", fleetTitle: "フリート" },
  zh: { locale: "zh-CN", fleetTitle: "机群" },
  pt: { locale: "pt-PT", fleetTitle: "Frota" },
};

export const SERIES = [
  { sourceId: "robot-1", kind: "motor_temp", field: "value", windowsScored: 12, lastScore: 0.21, lastTimestamp: 1_700_000_000_000, anomalous: false, threshold: 1.0, driftRatio: 1.1, drifted: false, driftSustained: false, driftSince: null, proposalsSent: 0 },
  { sourceId: "robot-2", kind: "vibration", field: "value", windowsScored: 40, lastScore: 1.8, lastTimestamp: 1_700_000_100_000, anomalous: true, threshold: 1.0, driftRatio: 2.4, drifted: true, driftSustained: true, driftSince: 1_699_990_000_000, proposalsSent: 1 },
];

/** Answer the paths of the two services. Returns what the page asked, so a test can look at it. */
export async function fakeServices(page: Page) {
  const asked: string[] = [];
  await page.route("**/api/datalake/**", async (route) => {
    const url = new URL(route.request().url());
    asked.push(`datalake ${url.pathname}`);
    if (url.pathname.endsWith("/query")) {
      const now = Date.now();
      const points = Array.from({ length: 24 }, (_, i) => ({
        sourceId: "robot-1", kind: "motor_temp", field: "value", timestamp: now - (24 - i) * 60_000, value: 40 + (i % 6) + i / 8,
      }));
      await route.fulfill({ json: points });
      return;
    }
    await route.fulfill({ status: 404, json: { error: "not part of this test" } });
  });
  await page.route("**/api/anomaly/**", async (route) => {
    const url = new URL(route.request().url());
    asked.push(`anomaly ${route.request().method()} ${url.pathname}`);
    if (url.pathname.endsWith("/fleet")) {
      await route.fulfill({ json: { series: SERIES, driftRatioLimit: 2, maintenanceMode: "propose" } });
      return;
    }
    if (url.pathname.endsWith("/stats")) {
      await route.fulfill({ json: { fitted: true } });
      return;
    }
    if (url.pathname.endsWith("/detect")) {
      await route.fulfill({ json: { anomalous: false, score: 0.3, threshold: 1.0, worstBinFreqHz: 50 } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: "not part of this test" } });
  });
  return asked;
}

/** A test that fails on any console error, page error or failed request of the page itself. */
export const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ""}`));
    await use(problems);
  },
});

export { expect };
