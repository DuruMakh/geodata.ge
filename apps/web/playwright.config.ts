import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    // Local runs use the preinstalled Edge; CI installs bundled Chromium.
    ...(process.env.CI ? {} : { channel: "msedge" }),
  },
  webServer: {
    command: "npm run dev -- --hostname 0.0.0.0 --port 3100",
    // Never reuse a leftover server when a data source is pinned: a stale
    // csv-mode dev server on the port would silently masquerade as a db run.
    reuseExistingServer: !process.env.CI && !process.env.GEODATA_DATA_SOURCE,
    timeout: 120_000,
    url: "http://localhost:3100",
  },
});
