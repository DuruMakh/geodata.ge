import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { validateMessages } from "../../lib/i18n/validation";

// Keys chosen through a lookup table rather than a literal call (the workbook's level names).
const LOOKUP_KEYS = ["levelCountry", "levelRegion", "levelMunicipality"];

async function sourceFiles(): Promise<string[]> {
  const found: string[] = [];
  for (const dir of ["components/demography", "lib/explorer", "lib/pages"]) {
    let names: string[] = [];
    try {
      names = await readdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const name of names) {
      if (/\.tsx?$/.test(name) && (dir === "components/demography" || /demography/.test(path.basename(name)))) found.push(path.join(dir, name));
    }
  }
  return found;
}

describe("demography messages", () => {
  test("Georgian and English hold the same keys and parameters, and only demography keys", async () => {
    const [ka, en] = await Promise.all([getMessages("ka", ["demography"]), getMessages("en", ["demography"])]);
    expect(validateMessages(ka, en)).toEqual([]);
    expect(Object.keys(ka).every((key) => key.startsWith("demography."))).toBe(true);
  });

  test("every key the demography code asks for exists", async () => {
    const en = await getMessages("en", ["demography"]);
    const used = new Set<string>(LOOKUP_KEYS);
    for (const file of await sourceFiles()) {
      const code = await readFile(file, "utf8");
      for (const match of code.matchAll(/\bt\(\s*"([A-Za-z0-9]+)"/g)) used.add(match[1]!);
      for (const match of code.matchAll(/"demography\.([A-Za-z0-9]+)"/g)) used.add(match[1]!);
    }
    expect([...used].filter((key) => !Object.hasOwn(en, `demography.${key}`))).toEqual([]);
  });

  test("the sidebar labels exist in both languages", async () => {
    for (const locale of ["ka", "en"] as const) {
      const common = await getMessages(locale, ["common"]);
      expect(common["common.dataDemography"]?.trim()).toBeTruthy();
      expect(common["common.demographyPopulation"]?.trim()).toBeTruthy();
    }
  });
});
