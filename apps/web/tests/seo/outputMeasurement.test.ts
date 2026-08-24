import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { measureSeoOutput } from "../../scripts/measure-seo-output";

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe("measureSeoOutput", () => {
  test("measures route bytes and deduplicates font preload bytes", () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "seo-output-"));
    fixtures.push(fixtureRoot);

    const appDir = path.join(fixtureRoot, ".next", "server", "app", "explorer");
    const mediaDir = path.join(fixtureRoot, ".next", "static", "media");
    mkdirSync(appDir, { recursive: true });
    mkdirSync(mediaDir, { recursive: true });

    writeFileSync(
      path.join(appDir, "expenditure.html"),
      `<link rel=preload href=a.woff2 as=font><link rel=preload href=b.woff2 as=font><link rel=preload href=a.woff2 as=font>${"x".repeat(3)}`,
    );
    writeFileSync(path.join(appDir, "expenditure.rsc"), "r".repeat(40));
    writeFileSync(path.join(mediaDir, "a.woff2"), Buffer.alloc(10));
    writeFileSync(path.join(mediaDir, "b.woff2"), Buffer.alloc(20));

    expect(measureSeoOutput(fixtureRoot, ["/explorer/expenditure"])).toEqual([
      {
        route: "/explorer/expenditure",
        htmlBytes: 120,
        rscBytes: 40,
        fontPreloadCount: 2,
        fontPreloadBytes: 30,
      },
    ]);
  });
});
