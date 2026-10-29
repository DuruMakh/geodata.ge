import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Every chart page that can switch to a yearly table also carries that table in its HTML, hidden, so crawlers read the numbers.
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const sourceFiles = (dir: string) => (readdirSync(resolve(process.cwd(), dir), { recursive: true }) as string[])
  .map((file) => `${dir}/${file.replaceAll("\\", "/")}`)
  .filter((file) => /\.tsx?$/.test(file));

describe("crawl table coverage", () => {
  it("every explorer that switches between chart and table renders the table's crawl copy", () => {
    const switchers = sourceFiles("components").filter((file) => {
      const source = read(file);
      return source.includes("<ExplorerTable") && source.includes("<ModeTabs");
    });
    expect(switchers.length).toBeGreaterThanOrEqual(47);
    expect(switchers.filter((file) => !read(file).includes("crawlCopy="))).toEqual([]);
  });
});
