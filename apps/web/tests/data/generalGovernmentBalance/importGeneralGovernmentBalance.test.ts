import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { loadGeneralGovernmentBalanceFacts } from "../../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";

const temporaryDirectories: string[] = [];

async function writeCanonicalMutation(
  transform: (content: string) => string,
): Promise<string> {
  const sourcePath = path.resolve(
    process.cwd(),
    "../../data/imports/general-government-balance-annual-1995-2031.csv",
  );
  const directory = await mkdtemp(path.join(tmpdir(), "general-government-balance-"));
  temporaryDirectories.push(directory);
  const fixturePath = path.join(directory, "facts.csv");
  await writeFile(fixturePath, transform(await readFile(sourcePath, "utf8")), "utf8");
  return fixturePath;
}

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("loadGeneralGovernmentBalanceFacts", () => {
  it("loads exactly one fact for every 1995-2031 year", async () => {
    const rows = await loadGeneralGovernmentBalanceFacts(
      "../../data/imports/general-government-balance-annual-1995-2031.csv",
    );
    expect(rows).toHaveLength(37);
    expect(rows[0]?.year).toBe(1995);
    expect(rows.at(-1)?.year).toBe(2031);
    expect(rows.filter((row) => row.status === "actual")).toHaveLength(31);
    expect(rows.filter((row) => row.status === "projection")).toHaveLength(6);
  });

  it("rejects duplicate years", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/duplicate-year.csv",
      ),
    ).rejects.toThrow("Duplicate general-government balance year");
  });

  it("rejects percentage and nominal values with different signs", async () => {
    await expect(
      loadGeneralGovernmentBalanceFacts(
        "tests/fixtures/general-government-balance/sign-mismatch.csv",
      ),
    ).rejects.toThrow("sign mismatch");
  });

  it("rejects a different source ID across an otherwise complete canonical file", async () => {
    const fixturePath = await writeCanonicalMutation((content) =>
      content.replaceAll(
        "source.imf_weo_april_2026_general_government_balance",
        "source.other_reviewed_dataset",
      ),
    );

    await expect(loadGeneralGovernmentBalanceFacts(fixturePath)).rejects.toThrow();
  });

  it("rejects changed transformation text across an otherwise complete canonical file", async () => {
    const fixturePath = await writeCanonicalMutation((content) =>
      content.replaceAll(
        "IMF billion GEL multiplied by 1,000,000,000; signed value preserved.",
        "Changed transformation.",
      ),
    );

    await expect(loadGeneralGovernmentBalanceFacts(fixturePath)).rejects.toThrow();
  });

  it("rejects an unexpected canonical CSV column", async () => {
    const fixturePath = await writeCanonicalMutation((content) =>
      content
        .split("\n")
        .map((line) => (line ? `${line},unexpected` : line))
        .join("\n"),
    );

    await expect(loadGeneralGovernmentBalanceFacts(fixturePath)).rejects.toThrow();
  });
});
