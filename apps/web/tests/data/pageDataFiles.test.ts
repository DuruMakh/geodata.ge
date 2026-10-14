import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPageDataFiles, pageDataFile, writePageDataFiles } from "../../lib/data/pageDataFiles";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "page-data-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("page data files", () => {
  it("name a file by a hash of its content, so new content gets a new name", () => {
    const first = pageDataFile("inflation-products", [{ k: "a", v: [1] }]);
    expect(first.fileName).toMatch(/^inflation-products\.[0-9a-f]{16}\.json$/);
    expect(first.url).toBe(`/page-data/${first.fileName}`);
    expect(pageDataFile("inflation-products", [{ k: "a", v: [1] }])).toEqual(first);
    expect(pageDataFile("inflation-products", [{ k: "a", v: [2] }]).fileName).not.toBe(first.fileName);
  });

  it("replace earlier versions under their prefix only, and the check refuses a stale or extra file", async () => {
    const dir = path.join(root, "public", "page-data");
    const old = pageDataFile("inflation-products", [1]);
    await writePageDataFiles("inflation-", [old]);
    await writeFile(path.join(dir, "other-topic.0000000000000000.json"), "[]");
    const current = [pageDataFile("inflation-products", [2]), pageDataFile("inflation-category-mom", [3])];
    await expect(checkPageDataFiles("inflation-", current)).rejects.toThrow(/stale/);
    await writePageDataFiles("inflation-", current);
    expect((await readdir(dir)).sort()).toEqual([...current.map((file) => file.fileName), "other-topic.0000000000000000.json"].sort());
    await expect(checkPageDataFiles("inflation-", current)).resolves.toBeUndefined();
    await writeFile(path.join(dir, current[0]!.fileName), "[9]");
    await expect(checkPageDataFiles("inflation-", current)).rejects.toThrow(/does not match/);
  });
});
