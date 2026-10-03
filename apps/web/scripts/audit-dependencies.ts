import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

// User-approved 2026-10-03; scope and removal procedure: docs/deployment.md.
const ADVISORY = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const EXPIRES = Date.parse("2026-11-02T00:00:00Z");
const LINT_CHAIN = new Map([
  ["braces", "3.0.3"], ["micromatch", "4.0.8"], ["fast-glob", "3.3.1"],
  ["@next/eslint-plugin-next", "16.3.8"], ["eslint-config-next", "16.3.8"],
]);
const SEVERITY: Record<string, number> = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
type Advisory = { name: string; url: string; severity: string };
type Vulnerability = { name: string; severity: string; nodes: string[]; via: (string | Advisory)[] };
type Lock = { packages: Record<string, { dev?: boolean; version?: string }> };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function evaluateAudit(raw: unknown, lock: Lock, now = new Date()): { allowed: string[]; blocked: string[] } {
  if (!isRecord(raw) || raw.error || raw.auditReportVersion !== 2 || !isRecord(raw.vulnerabilities) ||
    !isRecord(raw.metadata) || !isRecord(raw.metadata.vulnerabilities)) throw new Error("Invalid npm audit report");
  const vulnerabilities = raw.vulnerabilities as Record<string, Vulnerability>;
  for (const [name, value] of Object.entries(raw.vulnerabilities)) {
    if (!isRecord(value) || value.name !== name || !["info", "low", "moderate", "high", "critical"].includes(String(value.severity)) ||
      !Array.isArray(value.nodes) || value.nodes.length === 0 || !value.nodes.every(node => typeof node === "string") ||
      !Array.isArray(value.via) || value.via.length === 0 || !value.via.every(via => typeof via === "string" ||
        (isRecord(via) && typeof via.name === "string" && typeof via.url === "string" && typeof via.severity === "string"))) {
      throw new Error(`Invalid npm audit finding: ${name}`);
    }
  }
  for (const value of Object.values(vulnerabilities)) {
    for (const via of value.via) {
      const severity = typeof via === "string" ? vulnerabilities[via]?.severity : via.severity;
      if (severity !== undefined && (SEVERITY[severity] === undefined || SEVERITY[severity]! > SEVERITY[value.severity]!)) {
        throw new Error(`Understated npm audit severity: ${value.name}`);
      }
    }
  }
  for (const severity of ["high", "critical"]) {
    const count = Object.values(vulnerabilities).filter(value => value.severity === severity).length;
    if (raw.metadata.vulnerabilities[severity] !== count) throw new Error("Inconsistent npm audit severity counts");
  }
  function excepted(name: string, seen = new Set<string>()): boolean {
    const value = vulnerabilities[name];
    if (!value || value.severity !== "high" || !LINT_CHAIN.has(name) || seen.has(name) || now.getTime() >= EXPIRES) return false;
    if (!value.nodes.every(node => node === `node_modules/${name}` && lock.packages[node]?.dev === true &&
      lock.packages[node]?.version === LINT_CHAIN.get(name))) return false;
    const next = new Set([...seen, name]);
    return value.via.every(via => typeof via === "string" ? excepted(via, next) :
      name === "braces" && via.name === "braces" && via.severity === "high" && via.url === ADVISORY);
  }
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const [name, value] of Object.entries(vulnerabilities)) {
    if (value.severity !== "high" && value.severity !== "critical") continue;
    (excepted(name) ? allowed : blocked).push(name);
  }
  return { allowed, blocked };
}

function main(): number {
  const audit = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm",
    ["audit", "--json", "--audit-level=high", "--include=dev", "--fetch-retries=0", "--fetch-timeout=30000"],
    { encoding: "utf8", shell: process.platform === "win32", timeout: 90_000, maxBuffer: 10 * 1024 * 1024 });
  try {
    if (audit.error || (audit.status !== 0 && audit.status !== 1)) throw new Error("npm audit could not complete");
    const report: unknown = JSON.parse(audit.stdout);
    console.log(JSON.stringify(report, null, 2));
    const lock: Lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const result = evaluateAudit(report, lock);
    for (const name of result.allowed) console.log(`TEMPORARY ACCEPTED RISK: ${ADVISORY} via ${name}; expires 2026-11-02 UTC`);
    for (const name of result.blocked) console.error(`BLOCKING SECURITY FINDING: ${name}`);
    return result.blocked.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Dependency audit failed");
    return 1;
  }
}

if (path.basename(process.argv[1] ?? "") === "audit-dependencies.ts") process.exitCode = main();
