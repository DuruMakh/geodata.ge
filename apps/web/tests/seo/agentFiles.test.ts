import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../app/sitemap";

const llmsPath = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Fiscal.ge agent instructions", () => {
  it("publishes a concise guide with clear scope and unique public links", async () => {
    const content = await readFile(llmsPath, "utf8");

    expect(content.match(/^# Fiscal\.ge$/gm)).toHaveLength(1);
    expect(content).toMatch(/^# Fiscal\.ge\r?\n\r?\n> .+$/m);
    expect(content).toMatch(/\*\*When to use Fiscal\.ge:\*\* .+/);
    expect(content.indexOf("**When to use Fiscal.ge:**")).toBeLessThan(content.indexOf("## Core data"));
    expect(content).toContain("## Core data");
    expect(content).toContain("## Methodology and sources");
    expect(content).toContain("## Site navigation");
    expect(content).toMatch(/\[.+\]\(https:\/\/fiscal\.ge\/.+\)/);
    expect(content).toMatch(/annual/i);
    expect(content).toMatch(/no public API/i);
    expect(content).toMatch(/do not invent values/i);

    const targets = [...content.matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]+)\)/g)].map((match) => match[1]);
    expect(targets).not.toHaveLength(0);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("links only to public sitemap pages and the sitemap document", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const content = await readFile(llmsPath, "utf8");
    const targets = [...content.matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]+)\)/g)].map((match) => match[1]!);
    const htmlTargets = targets.filter((target) => new URL(target).pathname !== "/sitemap.xml");
    const sitemapTargets = (await sitemap()).map((entry) => entry.url);

    expect(htmlTargets.every((target) => sitemapTargets.includes(target))).toBe(true);
    expect(targets.filter((target) => new URL(target).pathname === "/sitemap.xml")).toEqual([
      "https://fiscal.ge/sitemap.xml",
    ]);
  });
});
