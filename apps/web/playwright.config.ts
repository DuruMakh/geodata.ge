import { defineConfig, devices } from "@playwright/test";

const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/browser",
  // Against `next dev` — what webServer starts locally — concurrent on-demand
  // compilation stretches a single response to 22s against the 30s test timeout,
  // so a cold parallel run fails non-deterministically. Against a production
  // server it is safe and much faster: measured 2026-09-06 over all 281 tests on
  // a prebuilt server, 264s at one worker against 116s at four, both 281/281.
  // (8 workers is slower than 4 and loses focus assertions — do not raise it.)
  //
  // PLAYWRIGHT_BASE_URL is only ever pointed at a server someone already built
  // and started, so that is the one case where the fast default is provably
  // safe. CI still defaults to 1: its runner has a fraction of the cores this
  // was measured on and nobody has measured four workers there. PW_WORKERS
  // overrides either way.
  //   npm run build && npm run start -- --port 3100
  //   CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
  workers: Number(process.env.PW_WORKERS) || (process.env.PLAYWRIGHT_BASE_URL ? 4 : 1),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: testBaseUrl,
    // Local runs use the preinstalled Edge; CI installs bundled Chromium.
    ...(process.env.CI ? {} : { channel: "msedge" }),
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    // CI tests the artifact that deploys, not `next dev`. Everything that differs
    // between the two is otherwise ungated: CSS layer ordering and minification
    // (globals.css relies on unlayered rules beating Tailwind's utilities layer),
    // the next/dynamic chunk split behind the hero, prerendered HTML, and
    // production-mode hydration. Locally `dev` stays the fast path.
    command: process.env.CI ? "npm run build && npm run start -- --port 3100" : "npm run dev -- --port 3100",
    // Never reuse a leftover server when a data source is pinned: a stale
    // csv-mode dev server on the port would silently masquerade as a db run.
    reuseExistingServer: !process.env.CI && !process.env.GEODATA_DATA_SOURCE,
    // The CI path builds before it serves; the dev path still starts in seconds.
    timeout: process.env.CI ? 300_000 : 120_000,
    url: testBaseUrl,
  },
});
