import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const userFacingFiles = [
  "apps/web/components/main-explorer/main-explorer.tsx",
  "apps/web/components/main-explorer/explorer-controls.tsx",
  "apps/web/components/main-explorer/series-selector.tsx",
  "apps/web/components/main-explorer/chart-frame.tsx",
  "apps/web/components/main-explorer/explorer-table.tsx",
  "apps/web/components/main-explorer/period-summary.tsx",
  "apps/web/components/single-year/single-year-snapshot.tsx",
  "apps/web/components/single-year/snapshot-headline-cards.tsx",
  "apps/web/components/single-year/snapshot-treemap.tsx",
  "apps/web/components/single-year/every-100-gel.tsx",
  "apps/web/components/single-year/spending-petals.tsx",
  "apps/web/components/single-year/budget-field.tsx",
  "apps/web/components/single-year/single-year-ranking.tsx",
];

const forbiddenFragments = [
  "\uFFFD",
  "Ã",
  "Â",
  "áƒ",
  "TODO",
  "FIXME",
  "Lorem",
  "lorem",
  "[object Object]",
  "console.log",
];

describe("v1 user-facing copy sanity", () => {
  it("does not contain common encoding, placeholder, or debug fragments", () => {
    const failures: string[] = [];

    for (const relativeFile of userFacingFiles) {
      const absoluteFile = path.join(repoRoot, relativeFile);
      const text = readFileSync(absoluteFile, "utf8");

      for (const fragment of forbiddenFragments) {
        if (text.includes(fragment)) {
          failures.push(`${relativeFile} contains ${JSON.stringify(fragment)}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
