import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// DESIGN.md §7.17: every chart on the site carries the share button, and the picture library loads only on click.
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const sourceFiles = (dir: string) => (readdirSync(resolve(process.cwd(), dir), { recursive: true }) as string[])
  .map((file) => `${dir}/${file.replaceAll("\\", "/")}`)
  .filter((file) => /\.tsx?$/.test(file));

describe("chart share coverage", () => {
  it("every chart panel has a share button", () => {
    const panels = sourceFiles("components").filter((file) => read(file).includes('data-testid="chart-panel"'));
    expect(panels.length).toBeGreaterThan(40);
    for (const file of panels) expect(read(file), file).toContain("<ChartShareButton");
  });

  it("every file that draws a chart has one, inside a chart panel or not", () => {
    const drawers = [...sourceFiles("components"), ...sourceFiles("lib/pages")].filter((file) => /<(EditorialLineChart|StackedColumnChart|PopulationPyramid|RegionMap|MunicipalityMap)\b/.test(read(file)));
    for (const file of drawers) expect(read(file), file).toContain("<ChartShareButton");
  });

  it("the region map, municipality map and pyramid pages have one", () => {
    for (const file of ["components/regional-economies/regional-economies-index.tsx", "components/municipalities/municipalities-index.tsx", "components/demography/age-sex-section.tsx", "components/demography/age-sex-explorer.tsx"]) {
      expect(read(file), file).toContain("<ChartShareButton");
    }
  });

  it("the picture library is only loaded on demand", () => {
    for (const file of [...sourceFiles("components"), ...sourceFiles("lib"), ...sourceFiles("app")]) expect(read(file), file).not.toMatch(/from ["']modern-screenshot["']/);
    expect(read("lib/explorer/chartPicture.client.ts")).toContain('import("modern-screenshot")');
  });
});
