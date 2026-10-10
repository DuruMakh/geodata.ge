import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { PopulationPyramid, PyramidTable } from "../../components/demography/population-pyramid";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { annualAgeFacts, annualPyramid, type Pyramid } from "../../lib/explorer/demographyAgeSex";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";

const GEORGIAN = /\p{Script=Georgian}/u;
let now: Pyramid;
let then: Pyramid;
let wrap: (node: ReactNode) => string;

beforeAll(async () => {
  const [{ facts }, presentation] = await Promise.all([
    loadServedDemographyData(),
    getPresentation("en", ["demography", "common", "controls", "format"], []),
  ]);
  const annual = annualAgeFacts(facts);
  now = annualPyramid(annual, 2026);
  then = annualPyramid(annual, 2004);
  wrap = (node) => renderToStaticMarkup(<I18nProvider {...presentation}>{node}</I18nProvider>);
});

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe("population pyramid", () => {
  it("draws 18 named rows, one tab stop, the 65+ band and no outline", () => {
    const html = wrap(<PopulationPyramid pyramid={now} year={2026} compare={null} measure="share" ariaLabel="Georgia, 1 January 2026" testId="pyramid" />);
    expect(html).toContain('data-testid="pyramid"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Georgia, 1 January 2026"');
    expect(count(html, /role="img"/g)).toBe(18);
    expect(html).toContain('aria-label="0–4: men 106,170, women 97,930, total 204,100 (5.2%)"');
    expect(html).toContain("65+ · 18.1%");
    expect(count(html, /tabindex="0"/g)).toBe(1);
    expect(html).not.toContain('data-testid="pyramid-outline');
    expect(html).toContain("Men");
    expect(html).toContain("Women");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("with a comparison year, draws its outline and names both years", () => {
    const html = wrap(<PopulationPyramid pyramid={now} year={2026} compare={{ pyramid: then, year: 2004 }} measure="share" ariaLabel="Georgia" testId="pyramid" />);
    expect(count(html, /data-testid="pyramid-outline-left"/g)).toBe(1);
    expect(count(html, /data-testid="pyramid-outline-right"/g)).toBe(1);
    expect(html).toMatch(/data-testid="pyramid-legend"[\s\S]*2026[\s\S]*2004/);
    expect(html).not.toMatch(GEORGIAN);
  });

  it("prints persons in the header when the measure is persons", () => {
    const html = wrap(<PopulationPyramid pyramid={now} year={2026} compare={null} measure="persons" ariaLabel="Georgia" testId="pyramid" />);
    expect(html).toContain("1,887,646");
    expect(html).toContain("2,053,457");
  });
});

describe("pyramid table", () => {
  it("lists 85+ first, then a total row", () => {
    const html = wrap(<PyramidTable pyramid={now} year={2026} compare={null} caption="Georgia, 2026" />);
    expect(html).toContain("<table");
    expect(html.indexOf(">85+<")).toBeLessThan(html.indexOf(">0–4<"));
    expect(html).toMatch(/>Total<[\s\S]*3,941,103/);
    const youngest = html.slice(html.indexOf(">0–4<"), html.indexOf("</tr>", html.indexOf(">0–4<")));
    expect([...youngest.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((cell) => cell[1])).toEqual(["106,170", "97,930", "204,100", "5.2%"]);
    expect(html).toContain(">Age<");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("repeats the number columns under the comparison year", () => {
    const html = wrap(<PyramidTable pyramid={now} year={2026} compare={{ pyramid: then, year: 2004 }} caption="Georgia" />);
    expect(count(html, />Men</g)).toBe(2);
    expect(html).toContain(">2004<");
    expect(html).toContain("3,937,716");
  });
});
