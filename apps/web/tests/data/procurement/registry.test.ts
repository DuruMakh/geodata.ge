import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { collectRegistry, politeClient, type RegistryClient } from "../../../lib/data/procurement/registry";

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "procurement-registry-"));
const quiet = () => undefined;

/** A fake service: getcorporation/{code} answers the internal id, corporations/{id} answers the record. */
function fakeClient(ids: Record<string, unknown>, records: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const client: RegistryClient = {
    async getJson(requestPath) {
      calls.push(requestPath);
      const [kind, key] = requestPath.split("/");
      if (kind === "getcorporation") return ids[key] ?? null;
      return records[key] ?? null;
    },
  };
  return { client, calls };
}

test("a company already saved is not asked for again", async () => {
  const dataDir = tempDir();
  fs.mkdirSync(path.join(dataDir, "registry", "raw"), { recursive: true });
  fs.writeFileSync(path.join(dataDir, "registry", "raw", "111111111.json"), "{}");
  const { client, calls } = fakeClient({});
  expect(await collectRegistry(dataDir, ["111111111"], client, quiet)).toMatchObject({ skipped: 1, looked_up: 0 });
  expect(calls).toEqual([]);
});

test("a found company is saved without any personal number in its record", async () => {
  const dataDir = tempDir();
  const record = { name: "Alpha", persons: [{ person: { name: "A. Person", personalNumber: "01019067930" } }] };
  const { client, calls } = fakeClient({ "111111111": 647006 }, { "647006": record });
  expect(await collectRegistry(dataDir, ["111111111"], client, quiet)).toMatchObject({ looked_up: 1, found: 1 });
  expect(calls).toEqual(["getcorporation/111111111", "corporations/647006"]);
  const saved = fs.readFileSync(path.join(dataDir, "registry", "raw", "111111111.json"), "utf8");
  expect(saved).not.toContain("01019067930");
  expect(JSON.parse(saved)).toMatchObject({ code: "111111111", internal_id: 647006, record: { name: "Alpha", persons: [{ person: { name: "A. Person", personalNumber: null } }] } });
  expect(fs.readFileSync(path.join(dataDir, "registry", "status.csv"), "utf8")).toMatch(/^﻿code,status,retrieved_at\n111111111,found,/);
});

test("a code the service does not know is recorded as not found", async () => {
  const dataDir = tempDir();
  const { client } = fakeClient({});
  expect(await collectRegistry(dataDir, ["999999999"], client, quiet)).toMatchObject({ not_found: 1, found: 0 });
  expect(fs.existsSync(path.join(dataDir, "registry", "raw", "999999999.json"))).toBe(false);
});

test("ten failures in a row stop the run and leave the rest for next time", async () => {
  const dataDir = tempDir();
  const calls: string[] = [];
  const failing: RegistryClient = { async getJson(requestPath) { calls.push(requestPath); throw new Error("HTTP 500"); } };
  const codes = Array.from({ length: 11 }, (_, i) => String(100000000 + i));
  expect(await collectRegistry(dataDir, codes, failing, quiet)).toMatchObject({ failed: 10, stopped: true });
  expect(calls).toHaveLength(10);
  expect(calls).not.toContain("getcorporation/100000010");
});

test("the polite client waits two seconds between requests and retries a server error twice", async () => {
  let clock = 0;
  const starts: number[] = [];
  const answers = [500, 500, 200, 404];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    starts.push(clock);
    expect(String(input)).toMatch(/^https:\/\/api\.companyinfo\.ge\/api\//);
    expect(new Headers(init?.headers).get("user-agent")).toBe("fiscal.ge-procurement-collection/1.0 (+https://fiscal.ge)");
    const status = answers.shift()!;
    return new Response(status === 200 ? "647006" : "", { status });
  }) as typeof fetch;
  const client = politeClient(fetchImpl, async ms => { clock += ms; }, () => clock);
  expect(await client.getJson("getcorporation/111111111")).toBe(647006);
  expect(await client.getJson("getcorporation/222222222")).toBeNull();
  expect(starts).toHaveLength(4);
  for (let i = 1; i < starts.length; i += 1) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(2000);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(10000);
  expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(30000);
});

test("the polite client gives up after three failed attempts", async () => {
  let clock = 0;
  let attempts = 0;
  const fetchImpl = (async () => { attempts += 1; return new Response("", { status: 503 }); }) as typeof fetch;
  const client = politeClient(fetchImpl, async ms => { clock += ms; }, () => clock);
  await expect(client.getJson("metadata")).rejects.toThrow("503");
  expect(attempts).toBe(3);
});
