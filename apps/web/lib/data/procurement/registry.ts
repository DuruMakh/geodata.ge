import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { serializeBomCsvRows } from "../csvEscape";
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
 * every personal number removed. An answer that is neither an id nor empty (null or empty text) is a failure, not "not found". Stops after
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
      const answer = await client.getJson(`getcorporation/${code}`);
      // The service answers an empty text, not 404, for a code it does not have.
      const internalId = answer === "" ? null : answer;
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

type SavedRecord = {
  code: string;
  retrieved_at: string;
  internal_id: number;
  record: {
    corporation: { name: string | null; registrationDate: { date: string } | null; address: string | null };
    legalFormKa: string | null;
    status: string | null;
    corporationAffiliations: {
      personId: number;
      personName: string | null;
      personIdNumber: string | null;
      personNationality: string | null;
      exPerson: boolean;
      role: string | null;
      share: number | null;
      date: string | null;
    }[];
  };
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "April 5, 2019" (the service's date format) as 2019-04-05; anything else is kept as it came. */
function isoDate(text: string | null): string | null {
  const match = text?.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  const month = match ? MONTHS.indexOf(match[1]) + 1 : 0;
  if (!match || month === 0) return text;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/**
 * Writes registry/companies.csv.gz (one row per saved company) and registry/links.csv.gz (one row per person or
 * company linked to it, current or former). A linked Georgian company keeps its 9-digit code; no other ID number of
 * a linked person or company is written.
 */
export async function flattenRegistry(dataDir: string): Promise<{ companies: number; links: number }> {
  const registryDir = path.join(dataDir, "registry");
  const rawDir = path.join(registryDir, "raw");
  const companies: (string | number | boolean | null)[][] = [];
  const links: (string | number | boolean | null)[][] = [];
  for (const name of fs.readdirSync(rawDir).filter(file => file.endsWith(".json")).sort()) {
    const saved = JSON.parse(fs.readFileSync(path.join(rawDir, name), "utf8")) as SavedRecord;
    const { corporation } = saved.record;
    companies.push([saved.code, saved.internal_id, corporation.name, saved.record.legalFormKa, corporation.registrationDate?.date.slice(0, 10) ?? null, saved.record.status, corporation.address, saved.retrieved_at]);
    for (const link of saved.record.corporationAffiliations ?? []) {
      const companyCode = /^\d{9}$/.test(link.personIdNumber ?? "") ? link.personIdNumber : null;
      links.push([saved.code, link.role, link.personId, link.personName, companyCode, link.share, isoDate(link.date), link.exPerson, link.personNationality, saved.retrieved_at]);
    }
  }
  fs.writeFileSync(path.join(registryDir, "companies.csv.gz"), gzipSync(serializeBomCsvRows([["company_code", "internal_id", "name", "legal_form", "registered", "status", "address", "retrieved_at"], ...companies])));
  fs.writeFileSync(path.join(registryDir, "links.csv.gz"), gzipSync(serializeBomCsvRows([["company_code", "role", "person_id", "person_name", "linked_company_code", "share", "date", "former", "nationality", "retrieved_at"], ...links])));
  return { companies: companies.length, links: links.length };
}
