import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Every chart page that can switch to a yearly table also carries that table in its HTML, hidden, so crawlers read the numbers.
const RULE = "Every <ExplorerTable> outside explorer-table.tsx takes crawlCopy={<mode> === \"line\"} (or crawlCopy={crawlCopy} in a helper that passes it on), one per table; see DESIGN.md §8.4 Table Mode.";
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const sourceFiles = (dir: string) => (readdirSync(resolve(process.cwd(), dir), { recursive: true }) as string[])
  .map((file) => `${dir}/${file.replaceAll("\\", "/")}`)
  .filter((file) => /\.tsx?$/.test(file));
const count = (source: string, pattern: string) => source.split(pattern).length - 1;
// Files that render an ExplorerTable but are not switched between chart and table, so they need no crawl copy.
// None today: every such file in components/ has a ModeTabs. Add a file here with a one-line reason, never silently.
const NOT_MODE_SWITCHED: Record<string, string> = {};

describe("crawl table coverage", () => {
  const tableFiles = sourceFiles("components").filter((file) => file !== "components/main-explorer/explorer-table.tsx" && read(file).includes("<ExplorerTable") && !(file in NOT_MODE_SWITCHED));

  it("every file that renders an ExplorerTable carries one crawlCopy prop per table", () => {
    expect(tableFiles.length, `${RULE} Expected at least 47 table files.`).toBeGreaterThanOrEqual(47);
    // One crawlCopy prop per table: a file that renders two tables cannot pass on the strength of one.
    expect(tableFiles.filter((file) => count(read(file), "<ExplorerTable") !== count(read(file), "crawlCopy=")), `${RULE} These files differ in tables and crawlCopy props.`).toEqual([]);
  });

  it("every crawlCopy value is one of the accepted forms", () => {
    const accepted = /^crawlCopy=\{(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)? === "line"|crawlCopy)\}/;
    const offending = tableFiles.flatMap((file) => read(file).split("crawlCopy=").slice(1)
      .map((rest) => `crawlCopy=${rest}`)
      .filter((value) => !accepted.test(value))
      .map((value) => `${file}: ${value.slice(0, 60).split("\n")[0]}`));
    expect(offending, `${RULE} These crawlCopy values are not an accepted form.`).toEqual([]);
  });

  it("the exemption list names only files that still render a table and have no ModeTabs", () => {
    for (const file of Object.keys(NOT_MODE_SWITCHED)) {
      expect(read(file).includes("<ExplorerTable") && !read(file).includes("<ModeTabs"), `${file} no longer qualifies for an exemption (${RULE})`).toBe(true);
    }
  });
});
