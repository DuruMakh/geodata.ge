import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INFLATION_PRODUCTS_RAW_ROOT, latestProductVintage, readVerifiedProductFiles } from "../../../lib/data/inflation/productSourceFiles";

const vintageDir = path.join(INFLATION_PRODUCTS_RAW_ROOT, "2026-08");
const expected = {
  "en/mom": [583143, "26d9b429229cbad2ad6ee2bbefd5e86f52d4482d49abdcc14e270d4a956dcf20"],
  "ka/mom": [580426, "7154963abfe05c0f8e5edd953ef0fb91274fde4911ce0a45eac7f3efc02bbd9c"],
  "en/yoy": [599891, "ec9cd520693db0479f7fd576f0d2f4cfa65c9c9ba607c46ec7679e13b900faf9"],
  "ka/yoy": [599155, "c4f87ab0b44d94538d7a0783371c28d639359977d8d00d12dcf588fa4b9390df"],
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
    expect(await latestProductVintage()).toBe("2026-08");
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
