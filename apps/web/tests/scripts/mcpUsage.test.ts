import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DECISION_SUFFIX, lastDays, main, parseArguments, parseHash, report, totals } from "../../scripts/mcp-usage";

// The script itself is never run against Upstash here: only its day keys,
// argument and reply parsing, report and its refusal to start without
// credentials.
describe("mcp:usage", () => {
  it("lists the last N UTC days, newest first, across a month boundary", () => {
    expect(lastDays(3, new Date("2026-11-01T00:30:00Z"))).toEqual(["2026-11-01", "2026-10-31", "2026-10-30"]);
  });

  it("reads --days and --namespace, and rejects everything else", () => {
    expect(parseArguments([])).toEqual({ days: 7, namespace: "production" });
    expect(parseArguments(["--days", "30", "--namespace", "preview"])).toEqual({ days: 30, namespace: "preview" });
    for (const bad of [["--days", "0"], ["--days", "91"], ["--days", "x"], ["--days"], ["--namespace", "staging"], ["--all"]]) {
      expect(() => parseArguments(bad)).toThrow(/Usage/);
    }
  });

  it("turns an HGETALL reply into counts and drops what it cannot read", () => {
    expect([...parseHash(["ping|ok|-|-|other", "3", "tools/list|ok|-|-|anthropic", 12, "bad", "x", "zero", "0"])]).toEqual([["ping|ok|-|-|other", 3], ["tools/list|ok|-|-|anthropic", 12]]);
    expect(parseHash(null).size).toBe(0);
    expect(parseHash([]).size).toBe(0);
  });

  it("sums days and flags the Stage 2 decision when any tool's Anthropic key_day refusals are non-zero", () => {
    const monday = parseHash(["ping|ok|-|-|other", "3", "query_national|error|rate_limited|key_day|other", "9"]);
    const tuesday = parseHash(["ping|ok|-|-|other", "2", "query_municipal|error|rate_limited|key_day|anthropic", "4", "initialize|error|rate_limited|key_day|anthropic", "1"]);
    expect(totals([monday, tuesday]).get("ping|ok|-|-|other")).toBe(5);

    const quiet = report([{ day: "2026-10-28", counts: monday }]);
    expect(quiet).toContain("2026-10-28  (12 counted requests)");
    expect(quiet).toContain("All 1 days  (12 counted requests)");
    // Per-minute refusals and requests refused before the limiter never reach the tally, so the sums are not traffic totals.
    expect(quiet).toMatch(/Per-minute refusals and requests refused before the limiter are not counted/);
    expect(quiet).not.toContain("DECISION NEEDED");
    expect(report([{ day: "2026-10-28", counts: monday }, { day: "2026-10-29", counts: tuesday }])).toContain(`DECISION NEEDED: 5 x *${DECISION_SUFFIX}`);
  });

  it("refuses to start without the Upstash read-only credentials, before any request", async () => {
    const saved = { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_READ_ONLY_TOKEN };
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_READ_ONLY_TOKEN;
    try {
      await expect(main(["--days", "1"])).rejects.toThrow(/KV_REST_API_URL and KV_REST_API_READ_ONLY_TOKEN/);
      process.env.KV_REST_API_URL = "http://evil.example";
      process.env.KV_REST_API_READ_ONLY_TOKEN = "t";
      await expect(main([])).rejects.toThrow(/upstash\.io/);
    } finally {
      if (saved.url !== undefined) process.env.KV_REST_API_URL = saved.url; else delete process.env.KV_REST_API_URL;
      if (saved.token !== undefined) process.env.KV_REST_API_READ_ONLY_TOKEN = saved.token; else delete process.env.KV_REST_API_READ_ONLY_TOKEN;
    }
  });

  it("exits non-zero with that message when run with no credentials", () => {
    const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const env = { ...process.env };
    delete env.KV_REST_API_URL;
    delete env.KV_REST_API_READ_ONLY_TOKEN;
    const result = spawnSync(process.execPath, [tsxCli, path.join("scripts", "mcp-usage.ts"), "--days", "1"], { cwd: process.cwd(), encoding: "utf8", env });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("KV_REST_API_READ_ONLY_TOKEN");
    expect(result.stdout).toBe("");
  }, 30_000);
});
