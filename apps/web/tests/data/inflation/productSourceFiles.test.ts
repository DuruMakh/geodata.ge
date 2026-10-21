import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INFLATION_PRODUCTS_RAW_ROOT, latestProductVintage, readVerifiedProductFiles } from "../../../lib/data/inflation/productSourceFiles";

const vintageDir = path.join(INFLATION_PRODUCTS_RAW_ROOT, "2026-09");
const expected = {
  "en/mom": [585750, "ec596f4daa4dfb3256387298268ba9824d808752fbb96e4e0a4e62bf3900900a"],
  "ka/mom": [582973, "835a70e49c5f46f6d632a9d350610d4053aff77b455f8db2472fa9b3def5672f"],
  "en/yoy": [602679, "1a9876bac321b40b1213f1e21978398c1c919d6a1c32bf6e481a77c7274fb0ff"],
  "ka/yoy": [601921, "5239bffbeb6549a9c455e1416ec5c627dbedd231f8426266d534ac33621f069c"],
} as const;

async function withCopy(run: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "product-sources-"));
  try {
    await fs.cp(vintageDir, dir, { recursive: true });
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("Geostat product source package", () => {
  it("verifies the four original files against the approved inventory", async () => {
    expect(await latestProductVintage()).toBe("2026-09");
    const files = await readVerifiedProductFiles(vintageDir);
    expect(files).toHaveLength(4);
    expect(files.map((file) => `${file.language}/${file.file_role}`).sort()).toEqual(Object.keys(expected).sort());
    for (const file of files) {
      const [bytes, hash] = expected[`${file.language}/${file.file_role}` as keyof typeof expected];
      expect(file.content.length).toBe(bytes);
      expect(createHash("sha256").update(file.content).digest("hex")).toBe(hash);
      expect(file.sha256).toBe(hash);
    }
  });

  it("rejects a changed workbook", async () => {
    await withCopy(async (dir) => {
      await fs.appendFile(path.join(dir, "en/products-mom.xlsx"), "changed");
      await expect(readVerifiedProductFiles(dir)).rejects.toThrow(/hash mismatch/);
    });
  });

  it("rejects a duplicate role and language", async () => {
    await withCopy(async (dir) => {
      const manifest = path.join(dir, "source-manifest.csv");
      const lines = (await fs.readFile(manifest, "utf8")).trimEnd().split(/\r?\n/);
      await fs.writeFile(manifest, `${lines.join("\n")}\n${lines[1]}\n`);
      await expect(readVerifiedProductFiles(dir)).rejects.toThrow(/exactly one/);
    });
  });

  it("rejects a manifest path outside the package", async () => {
    await withCopy(async (dir) => {
      const manifest = path.join(dir, "source-manifest.csv");
      const text = await fs.readFile(manifest, "utf8");
      await fs.writeFile(manifest, text.replace("en/products-mom.xlsx", "../escape.xlsx"));
      await expect(readVerifiedProductFiles(dir)).rejects.toThrow(/outside its package/);
    });
  });

  it("rejects a linked folder inside the package", async () => {
    await withCopy(async (dir) => {
      const original = path.join(dir, "en");
      const moved = path.join(dir, "linked-en");
      await fs.rename(original, moved);
      await fs.symlink(moved, original, "junction");
      await expect(readVerifiedProductFiles(dir)).rejects.toThrow(/symlink/);
    });
  });
});
