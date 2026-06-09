import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    channel: "msedge",
  },
  webServer: {
    command: "npm run dev -- --hostname 0.0.0.0 --port 3100",
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/geodata",
      DIRECT_URL: "postgresql://user:pass@localhost:5432/geodata",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://localhost:3100",
  },
});
