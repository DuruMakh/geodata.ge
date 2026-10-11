import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkFunctionSizes, functionTraceBytes } from "../../scripts/check-function-size";

let next: string;
beforeAll(async () => {
  // A miniature .next: one route trace listing two files and the shared server trace listing one.
  next = await mkdtemp(path.join(os.tmpdir(), "function-size-"));
  await mkdir(path.join(next, "server/app/page-dir"), { recursive: true });
  await writeFile(path.join(next, "a.bin"), Buffer.alloc(10));
  await writeFile(path.join(next, "b.bin"), Buffer.alloc(20));
  await writeFile(path.join(next, "shared.bin"), Buffer.alloc(5));
  await writeFile(path.join(next, "server/app/page-dir/page.js.nft.json"), JSON.stringify({ version: 1, files: ["../../../a.bin", "../../../b.bin", "../../../shared.bin"] }));
  await writeFile(path.join(next, "next-server.js.nft.json"), JSON.stringify({ version: 1, files: ["shared.bin"] }));
});
afterAll(async () => { await rm(next, { recursive: true, force: true }); });

describe("server function size guard", () => {
  it("sums each traced file once, counting the shared server trace", async () => {
    expect(await functionTraceBytes(path.join(next, "server/app/page-dir/page.js.nft.json"))).toBe(35);
    expect(await functionTraceBytes(path.join(next, "server/app/page-dir/page.js.nft.json"), [path.join(next, "shared.bin")])).toBe(35);
  });

  it("lists the largest functions and rejects one over the limit", async () => {
    const report = await checkFunctionSizes(next, 100);
    expect(report[0]).toMatchObject({ trace: path.join("server", "app", "page-dir", "page.js.nft.json"), bytes: 35 });
    await expect(checkFunctionSizes(next, 30)).rejects.toThrow(/page-dir/);
  });
});
