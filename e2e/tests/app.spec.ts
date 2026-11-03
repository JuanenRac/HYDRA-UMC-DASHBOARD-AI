// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - e2e/tests/app.spec.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
import AxeBuilder from "@axe-core/playwright";
import { test, expect, fakeServices, LOCALES } from "./fakes";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function serious(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} [${v.impact}] ${v.help}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test.describe("load", () => {
  test("the page loads with its panels, no console error, no page error and no failed request", async ({ page, problems }) => {
    const asked = await fakeServices(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "HYDRA-UMC-DASHBOARD-AI" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Trend Summary" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Anomaly Check" })).toBeVisible();
    await expect(page.getByTestId("fleet-table")).toBeVisible();
    expect(asked.some((a) => a.includes("/fleet"))).toBe(true);
    expect(problems).toEqual([]);
  });

  test("a trend summary is computed from the fake data lake and nothing else is asked", async ({ page, problems }) => {
    const asked = await fakeServices(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Fetch summary" }).click();
    await expect(page.getByTestId("trend-summary-result")).toBeVisible();
    await expect(page.getByTestId("trend-sparkline")).toBeVisible();
    expect(asked.filter((a) => a.startsWith("datalake")).every((a) => a.endsWith("/query"))).toBe(true);
    expect(problems).toEqual([]);
  });

  test("a service that is down is told, in a message, not in a crash", async ({ page }) => {
    await page.route("**/api/datalake/**", (route) => route.fulfill({ status: 503, body: "down" }));
    await page.route("**/api/anomaly/**", (route) => route.fulfill({ status: 503, body: "down" }));
    await page.goto("/");
    await page.getByRole("button", { name: "Fetch summary" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("languages", () => {
  for (const [lang, { locale, fleetTitle }] of Object.entries(LOCALES)) {
    test.describe(lang, () => {
      test.use({ locale });
      test(`the browser language ${locale} shows the Fleet card in ${lang}, with no key or placeholder left`, async ({ page, problems }) => {
        await fakeServices(page);
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 2, name: fleetTitle, exact: true })).toBeVisible();
        const text = await page.locator("main").innerText();
        expect(text).not.toMatch(/undefined|\[object|\{\w+\}|\bfleet[A-Z]\w+|\bcol[A-Z]\w+|\bstate[A-Z]\w+/);
        expect(problems).toEqual([]);
      });
    });
  }
});

test.describe("theme", () => {
  for (const scheme of ["dark", "light"] as const) {
    test(`the page keeps its dark theme under a ${scheme} system preference and stays readable`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await fakeServices(page);
      await page.goto("/");
      await expect(page.getByTestId("fleet-table")).toBeVisible();
      const look = await page.evaluate(() => ({
        scheme: getComputedStyle(document.documentElement).colorScheme,
        background: getComputedStyle(document.body).backgroundColor,
      }));
      expect(look.scheme).toContain("dark");
      const [r, g, b] = look.background.match(/\d+/g)!.map(Number);
      expect((r + g + b) / 3).toBeLessThan(110); // a dark background
      expect(await serious(page)).toEqual([]);
    });
  }
});

test.describe("accessibility", () => {
  for (const lang of ["en", "ja"]) {
    test(`axe finds no serious or critical violation (${lang}), with the results on screen`, async ({ browser }) => {
      const context = await browser.newContext({ locale: LOCALES[lang].locale, reducedMotion: "reduce" });
      const page = await context.newPage();
      await fakeServices(page);
      await page.goto("http://127.0.0.1:" + (process.env.E2E_PORT || 4173) + "/");
      await expect(page.getByTestId("fleet-table")).toBeVisible();
      await page.getByRole("button", { name: /Fetch summary/ }).click();
      await expect(page.getByTestId("trend-summary-result")).toBeVisible();
      expect(await serious(page)).toEqual([]);
      await context.close();
    });
  }

  test("the form can be filled and submitted from the keyboard alone", async ({ page }) => {
    await fakeServices(page);
    await page.goto("/");
    await page.getByLabel("Source ID").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("trend-summary-result")).toBeVisible();
  });
});
