import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { serializeBomCsv, serializeBomCsvRows } from "../../lib/data/csvEscape";
import { readPackageFile, readVerifiedPackageFile } from "../../lib/data/sourcePackage";

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

  it("rejects a file reached through a linked folder that leads outside the package", async () => {
    const { dir } = await fixture();
    const outside = await mkdtemp(path.join(tmpdir(), "outside-"));
    roots.push(outside);
    await writeFile(path.join(outside, "secret.csv"), "secret", "utf8");
    // A junction needs no elevation on Windows; elsewhere the type is ignored.
    await symlink(outside, path.join(dir, "official"), "junction");
    await expect(readPackageFile(dir, "official/secret.csv")).rejects.toThrow(/symlink/i);
  });

  it("reads a nested file and a name that merely starts with two dots", async () => {
    const { dir } = await fixture();
    await mkdir(path.join(dir, "official"));
    await writeFile(path.join(dir, "official", "nested.csv"), "nested", "utf8");
    await writeFile(path.join(dir, "..data.csv"), "dots", "utf8");
    expect((await readPackageFile(dir, "official/nested.csv")).toString("utf8")).toBe("nested");
    expect((await readPackageFile(dir, "..data.csv")).toString("utf8")).toBe("dots");
  });

  it("rejects a folder", async () => {
    const { dir } = await fixture();
    await mkdir(path.join(dir, "official"));
    await expect(readPackageFile(dir, "official")).rejects.toThrow(/not a regular file/i);
  });
});

describe("serializeBomCsv", () => {
  it("writes a BOM, escapes cells and keeps the caller's line ending", () => {
    const rows = [{ year: 2025, value: "1,5" }];
    expect(serializeBomCsv(["year", "value"], rows)).toBe('\uFEFFyear,value\n2025,"1,5"\n');
    expect(serializeBomCsv(["year", "value"], rows, "\r\n")).toBe('\uFEFFyear,value\r\n2025,"1,5"\r\n');
  });

  it("starts with the UTF-8 BOM bytes", () => {
    expect([...Buffer.from(serializeBomCsvRows([["year"]]), "utf8").subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("writes a missing cell as empty", () => {
    expect(serializeBomCsv(["year", "note"], [{ year: 2025 }])).toBe("\uFEFFyear,note\n2025,\n");
    expect(serializeBomCsvRows([["year", "note"], [2025, null]])).toBe("\uFEFFyear,note\n2025,\n");
  });
});
