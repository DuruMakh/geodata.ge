import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  // Opt-in only, and deliberately not keyed off CI. Measured 2026-08-27 over 204
  // tests: against a production server 4 workers is 2.3x faster (415s -> 180s)
  // and passed three consecutive runs clean, but against `next dev` — which is
  // what webServer starts locally — concurrent on-demand compilation stretches a
  // single response to 22s against the 30s test timeout, so a cold run fails
  // non-deterministically. 8 workers is both slower than 4 and loses focus
  // assertions. So: default 1, and raise it only when serving a real build.
  //   PW_WORKERS=4 npx playwright test
  workers: Number(process.env.PW_WORKERS) || 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    // Local runs use the preinstalled Edge; CI installs bundled Chromium.
    ...(process.env.CI ? {} : { channel: "msedge" }),
  },
  webServer: {
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
    url: "http://localhost:3100",
  },
});
