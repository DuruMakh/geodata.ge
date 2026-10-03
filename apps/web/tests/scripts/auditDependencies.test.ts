import { describe, expect, it } from "vitest";
import { evaluateAudit } from "../../scripts/audit-dependencies";

const advisory = { name: "braces", url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", severity: "high" };
function fixture() {
  const names = ["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"];
  const versions = ["3.0.3", "4.0.8", "3.3.1", "16.3.8", "16.3.8"];
  const vulnerabilities: Record<string, { name: string; severity: string; nodes: string[]; via: (string | typeof advisory)[] }> = {};
  const packages: Record<string, { version: string; dev: boolean }> = {};
  for (const [i, name] of names.entries()) {
    vulnerabilities[name] = { name, severity: "high", nodes: [`node_modules/${name}`], via: i === 0 ? [{ ...advisory }] : [names[i - 1]!] };
    packages[`node_modules/${name}`] = { version: versions[i]!, dev: true };
  }
  return { report: { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { high: 5, critical: 0 } } }, lock: { packages } };
}
const now = new Date("2026-10-03T12:00:00Z");

describe("temporary braces audit exception", () => {
  it("allows only the approved advisory and its current dev-only lint ancestors", () => {
    const { report, lock } = fixture();
    expect(evaluateAudit(report, lock, now)).toEqual({ allowed: Object.keys(report.vulnerabilities), blocked: [] });
  });

  it("keeps another high advisory on the same package and all its parents blocking", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.braces!.via.push({ ...advisory, url: "https://github.com/advisories/GHSA-other" });
    expect(evaluateAudit(report, lock, now).blocked).toEqual(Object.keys(report.vulnerabilities));
  });

  it("keeps an unrelated high advisory blocking", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.other = { name: "other", severity: "high", nodes: ["node_modules/other"], via: [{ ...advisory, name: "other" }] };
    report.metadata.vulnerabilities.high++;
    expect(evaluateAudit(report, lock, now).blocked).toEqual(["other"]);
  });

  it("never exempts critical findings", () => {
    const { report, lock } = fixture();
    for (const value of Object.values(report.vulnerabilities)) value.severity = "critical";
    report.vulnerabilities.braces!.via = [{ ...advisory, severity: "critical" }];
    report.metadata.vulnerabilities.high = 0;
    report.metadata.vulnerabilities.critical = 5;
    expect(evaluateAudit(report, lock, now).blocked).toContain("braces");
  });

  it.each(["2026-11-02T00:00:00Z", "2026-12-01T00:00:00Z"])("expires at %s", date => {
    const { report, lock } = fixture();
    expect(evaluateAudit(report, lock, new Date(date)).blocked).toHaveLength(5);
  });

  it.each(["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"])("rejects production use of %s", name => {
    const { report, lock } = fixture();
    lock.packages[`node_modules/${name}`]!.dev = false;
    expect(evaluateAudit(report, lock, now).blocked).toContain(name);
  });

  it("requires the reviewed braces version and exact package path", () => {
    const { report, lock } = fixture();
    lock.packages["node_modules/braces"]!.version = "3.0.4";
    expect(evaluateAudit(report, lock, now).blocked).toHaveLength(5);
    lock.packages["node_modules/braces"]!.version = "3.0.3";
    report.vulnerabilities.braces!.nodes.push("node_modules/other/node_modules/braces");
    expect(evaluateAudit(report, lock, now).blocked).toHaveLength(5);
  });

  it.each(["micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"])("requires reassessment when %s changes version", name => {
    const { report, lock } = fixture();
    lock.packages[`node_modules/${name}`]!.version = "new-version";
    expect(evaluateAudit(report, lock, now).blocked).toContain(name);
  });

  it("rejects new parents, missing references and cycles", () => {
    for (const via of [["new-parent"], ["braces"]]) {
      const { report, lock } = fixture();
      report.vulnerabilities.braces!.via = via;
      expect(evaluateAudit(report, lock, now).blocked).toHaveLength(5);
    }
  });

  it("retains the existing moderate threshold and accepts a clean audit after remediation", () => {
    const { report, lock } = fixture();
    report.vulnerabilities = { other: { name: "other", severity: "moderate", nodes: ["node_modules/other"], via: [{ ...advisory, name: "other", severity: "moderate" }] } };
    report.metadata.vulnerabilities.high = 0;
    expect(evaluateAudit(report, lock, now)).toEqual({ allowed: [], blocked: [] });
    report.vulnerabilities = {};
    expect(evaluateAudit(report, lock, new Date("2026-12-01"))).toEqual({ allowed: [], blocked: [] });
  });

  it.each([null, {}, { error: { code: "ENOAUDIT" } }, { auditReportVersion: 1 }, { auditReportVersion: 2, vulnerabilities: {} }])("fails closed on malformed/error audit output: %j", report => {
    expect(() => evaluateAudit(report, fixture().lock, now)).toThrow();
  });

  it("rejects missing advisory details and inconsistent severe counts", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.braces!.via = [];
    expect(() => evaluateAudit(report, lock, now)).toThrow();
    const other = fixture();
    other.report.metadata.vulnerabilities.high = 0;
    expect(() => evaluateAudit(other.report, other.lock, now)).toThrow();
  });

  it("rejects an audit that understates an advisory's severity", () => {
    const { report, lock } = fixture();
    report.vulnerabilities = { other: { name: "other", severity: "moderate", nodes: ["node_modules/other"], via: [{ ...advisory, name: "other", severity: "critical" }] } };
    report.metadata.vulnerabilities.high = 0;
    expect(() => evaluateAudit(report, lock, now)).toThrow();
  });
});
