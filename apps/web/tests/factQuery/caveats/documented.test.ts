// apps/web/tests/factQuery/caveats/documented.test.ts
//
// The catalogue cannot grow without its documentation growing with it. This
// checks that every registered code is MENTIONED, not that the sentence beside
// it is right - a test can prove the former, never the latter. The prose stays
// a review responsibility.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { serviceMessage } from "../../../lib/factQuery/localization";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";

const DOC_PATH = path.join(process.cwd(), "..", "..", "docs", "data-methodology", "ai-grounding-and-caveats.md");

let doc: string;
let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  doc = await readFile(DOC_PATH, "utf8");
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" });
});

describe("caveat catalogue documentation", () => {
  it("documents every registered caveat code", () => {
    const undocumented = CAVEAT_RULES.filter((rule) => !doc.includes(rule.code)).map((rule) => rule.code);
    expect(undocumented).toEqual([]);
  });

  it("gives each code its own section, not just a table row", () => {
    const withoutSection = CAVEAT_RULES.filter((rule) => !doc.includes(`### \`${rule.code}\``)).map((rule) => rule.code);
    expect(withoutSection).toEqual([]);
  });

  it("reproduces both message texts verbatim", () => {
    // A paraphrase here would let the documented meaning drift away from what
    // a consumer actually receives.
    for (const rule of CAVEAT_RULES) {
      expect(doc, `${rule.code} messageKa`).toContain(serviceMessage(snapshot, "ka", rule.messageKey));
      expect(doc, `${rule.code} messageEn`).toContain(serviceMessage(snapshot, "en", rule.messageKey));
    }
  });

  it("records each code's severity and owner document", () => {
    for (const rule of CAVEAT_RULES) {
      expect(doc, `${rule.code} methodologyRef`).toContain(rule.methodologyRef);
    }
    expect(doc).toContain("**Severity:** severe");
    expect(doc).toContain("**Severity:** note");
  });

  it("records each code's comparison effect", () => {
    // The axis that decides whether a growth figure is published at all. It was
    // previously a hand-kept list of one inside compare.ts, documented nowhere,
    // and it was incomplete.
    for (const rule of CAVEAT_RULES) {
      const section = doc.slice(doc.indexOf(`### \`${rule.code}\``));
      expect(section.slice(0, 400), `${rule.code} comparison effect`).toContain(
        `**Comparison effect:** \`${rule.comparisonEffect}\``,
      );
    }
  });

  it("states the registered code count so a silent addition is visible", () => {
    expect(doc).toContain(`${CAVEAT_RULES.length} codes are registered.`);
  });

  it("documents no code that is not registered", () => {
    const registered = new Set(CAVEAT_RULES.map((rule) => rule.code));
    const documented = Array.from(doc.matchAll(/^### `([a-z0-9_]+)`$/gm)).map((match) => match[1]!);

    expect(documented.length).toBe(CAVEAT_RULES.length);
    for (const code of documented) expect(registered.has(code)).toBe(true);
  });
});
