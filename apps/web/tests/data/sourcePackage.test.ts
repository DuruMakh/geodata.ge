import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { serializeBomCsv, serializeBomCsvRows } from "../../lib/data/csvEscape";
import { readVerifiedPackageFile } from "../../lib/data/sourcePackage";

const roots: string[] = [];
afterAll(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "package-"));
  roots.push(dir);
  const body = "payload";
  await writeFile(path.join(dir, "source.csv"), body, "utf8");
  return { dir, expected: { sha256: createHash("sha256").update(body).digest("hex"), bytes: body.length } };
}

describe("readVerifiedPackageFile", () => {
  it("returns the verified bytes and their hash, in either hash case", async () => {
    const { dir, expected } = await fixture();
    const file = await readVerifiedPackageFile(dir, "source.csv", { ...expected, sha256: expected.sha256.toUpperCase() }, "test mismatch");
    expect(file.bytes.toString("utf8")).toBe("payload");
    expect(file.sha256).toBe(expected.sha256);
  });

  it("rejects a size mismatch and a hash mismatch with the caller's message", async () => {
    const { dir, expected } = await fixture();
    await expect(readVerifiedPackageFile(dir, "source.csv", { ...expected, bytes: 1 }, "test mismatch")).rejects.toThrow("test mismatch");
    await expect(readVerifiedPackageFile(dir, "source.csv", { ...expected, sha256: "0".repeat(64) }, "test mismatch")).rejects.toThrow("test mismatch");
  });

  it("rejects a path that leaves the package", async () => {
    const { dir, expected } = await fixture();
    await expect(readVerifiedPackageFile(dir, "../escape.csv", expected, "test mismatch")).rejects.toThrow(/outside/i);
    await expect(readVerifiedPackageFile(dir, path.join(dir, "source.csv"), expected, "test mismatch")).rejects.toThrow(/outside/i);
  });

  it("rejects a symlink", async (context) => {
    const { dir, expected } = await fixture();
    try {
      await symlink(path.join(dir, "source.csv"), path.join(dir, "link.csv"));
    } catch {
      // Windows refuses symlinks without Developer Mode or elevation; the check
      // still runs everywhere the platform can create one, including CI.
      context.skip();
    }
    await expect(readVerifiedPackageFile(dir, "link.csv", expected, "test mismatch")).rejects.toThrow(/symlink/i);
  });
});

describe("serializeBomCsv", () => {
  it("writes a BOM, escapes cells and keeps the caller's line ending", () => {
    const rows = [{ year: 2025, value: "1,5" }];
    expect(serializeBomCsv(["year", "value"], rows)).toBe('﻿year,value\n2025,"1,5"\n');
    expect(serializeBomCsv(["year", "value"], rows, "\r\n")).toBe('﻿year,value\r\n2025,"1,5"\r\n');
  });

  it("writes a missing cell as empty", () => {
    expect(serializeBomCsv(["year", "note"], [{ year: 2025 }])).toBe("﻿year,note\n2025,\n");
    expect(serializeBomCsvRows([["year", "note"], [2025, null]])).toBe("﻿year,note\n2025,\n");
  });
});
