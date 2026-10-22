import fs from "node:fs";
import path from "node:path";
import { stripPersonalNumbers } from "./privacy";

export type RegistryClient = { getJson(path: string): Promise<unknown> };
export type RegistryStats = { looked_up: number; found: number; not_found: number; failed: number; skipped: number; stopped: boolean };

const API_BASE = "https://api.companyinfo.ge/api/";
const USER_AGENT = "fiscal.ge-procurement-collection/1.0 (+https://fiscal.ge)";
const MIN_INTERVAL_MS = 2_000;
const RETRY_WAITS_MS = [10_000, 30_000];
const MAX_CONSECUTIVE_FAILURES = 10;

/**
 * One request at a time to companyinfo.ge, starting at least two seconds apart. A server error, rate limit or
 * network error is retried after 10 s and then 30 s; a 404 answers null.
 */
export function politeClient(fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>, now: () => number): RegistryClient {
  let lastStart = -Infinity;
  async function attempt(url: string): Promise<{ retry: boolean; value?: unknown; error?: Error }> {
    const wait = lastStart + MIN_INTERVAL_MS - now();
    if (wait > 0) await sleep(wait);
    lastStart = now();
    try {
      const response = await fetchImpl(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
      if (response.status === 404) return { retry: false, value: null };
      if (response.ok) return { retry: false, value: await response.json() };
      const error = new Error(`${url} answered HTTP ${response.status}`);
      return { retry: response.status >= 500 || response.status === 429, error };
    } catch (error) {
      return { retry: true, error: error as Error };
    }
  }
  return {
    async getJson(requestPath) {
      const url = `${API_BASE}${requestPath}`;
      for (let i = 0; ; i += 1) {
        const result = await attempt(url);
        if (!result.error) return result.value;
        if (!result.retry || i >= RETRY_WAITS_MS.length) throw result.error;
        await sleep(RETRY_WAITS_MS[i]);
      }
    },
  };
}

function appendStatus(dataDir: string, code: string, status: string, retrievedAt: string) {
  const file = path.join(dataDir, "registry", "status.csv");
  if (!fs.existsSync(file)) fs.writeFileSync(file, "﻿code,status,retrieved_at\n");
  fs.appendFileSync(file, `${code},${status},${retrievedAt}\n`);
}

/** Codes whose latest lookup answered "not found", so a re-run does not ask for them again. */
function previouslyNotFound(dataDir: string): Set<string> {
  const file = path.join(dataDir, "registry", "status.csv");
  const latest = new Map<string, string>();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split("\n").slice(1)) {
      const [code, status] = line.split(",");
      if (code) latest.set(code, status);
    }
  }
  return new Set([...latest].filter(([, status]) => status === "not_found").map(([code]) => code));
}

/**
 * Looks up each company code not yet saved or found missing: its internal id, then its record, saved to registry/raw/{code}.json with
 * every personal number removed. An answer that is neither an id nor empty is a failure, not "not found". Stops after
 * ten failed codes in a row, so a broken service is not hammered.
 */
export async function collectRegistry(dataDir: string, codes: string[], client: RegistryClient, log: (line: string) => void): Promise<RegistryStats> {
  const rawDir = path.join(dataDir, "registry", "raw");
  fs.mkdirSync(rawDir, { recursive: true });
  const stats: RegistryStats = { looked_up: 0, found: 0, not_found: 0, failed: 0, skipped: 0, stopped: false };
  const notFound = previouslyNotFound(dataDir);
  let failuresInRow = 0;
  for (const code of codes) {
    const target = path.join(rawDir, `${code}.json`);
    if (fs.existsSync(target) || notFound.has(code)) {
      stats.skipped += 1;
      continue;
    }
    stats.looked_up += 1;
    const retrievedAt = new Date().toISOString();
    try {
      const internalId = await client.getJson(`getcorporation/${code}`);
      if (internalId !== null && typeof internalId !== "number") throw new Error(`unexpected answer to getcorporation/${code}: ${typeof internalId}`);
      const record = internalId === null ? null : await client.getJson(`corporations/${internalId}`);
      if (record === null || record === undefined) {
        stats.not_found += 1;
        appendStatus(dataDir, code, "not_found", retrievedAt);
      } else {
        fs.writeFileSync(`${target}.part`, JSON.stringify({ code, retrieved_at: retrievedAt, internal_id: internalId, record: stripPersonalNumbers(record) }));
        fs.renameSync(`${target}.part`, target);
        stats.found += 1;
        appendStatus(dataDir, code, "found", retrievedAt);
      }
      failuresInRow = 0;
    } catch (error) {
      stats.failed += 1;
      failuresInRow += 1;
      appendStatus(dataDir, code, "failed", retrievedAt);
      log(`${code}: ${(error as Error).message}`);
      if (failuresInRow >= MAX_CONSECUTIVE_FAILURES) {
        stats.stopped = true;
        break;
      }
    }
    if (stats.looked_up % 100 === 0) log(`${stats.looked_up} looked up: ${JSON.stringify(stats)}`);
  }
  return stats;
}
