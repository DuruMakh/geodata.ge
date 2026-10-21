import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The router hooks are stubbed; the page itself is the real one.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {} }),
  usePathname: () => "/",
}));

// The page's state comes from the address hash, which a server render does not have: this stands in for it.
const address = vi.hoisted(() => ({ hash: "" }));
vi.mock("../../components/explorer-shell/use-hash-state", () => ({
  useHashState: <D, S>(data: D, parse: (hash: string, data: D) => S) => ({ state: parse(address.hash, data), update: (change: (previous: S) => S) => change(parse(address.hash, data)) }),
}));

import { defaultSocialState, serializeSocialHash } from "../../lib/explorer/social";
import { renderSocialTopicPage, socialTopicMetadata } from "../../lib/pages/social";
import { loadSocialWorkbookSources } from "../../lib/pages/social-places";
import { renderPageMarkup } from "../helpers/render-localized";

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; address.hash = ""; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const latest = (html: string) => text(html.match(/<p data-testid="social-latest"[^>]*>(.*?)<\/p>/)?.[1] ?? "");
const page = async (locale: "ka" | "en") => renderPageMarkup(locale, await renderSocialTopicPage(locale, "funded-pension"));
const jsonLd = (html: string) => JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/)![1].replace(/&quot;/g, '"').replace(/\\u003c/g, "<"));

describe("the funded pension page", () => {
  it("opens on the savings heading with the one latest line, no tabs and the Pension Fund as its source", async () => {
    const html = await page("en");
    expect(latest(html)).toBe("2025: 8.24 billion GEL in pension savings");
    expect(html).toContain('data-testid="social-funded-pension"');
    expect(html).toContain('data-heading="savings"');
    expect(text(html)).toContain("Savings, end of year");
    expect(html).toContain("Source: Pension Fund of Georgia");
    // The % of GDP switch belongs to the money headings only, and the page opens on a money heading: the switch is the page's only one.
    expect(html).toContain('data-testid="social-measure-gdp"');
    expect(text(html.replace(/<script[\s\S]*?<\/script>/g, ""))).not.toContain("Social Service Agency");
    expect(text(html)).not.toContain("Employers · employers");
  });

  it("lists the return with its own unit in the % of GDP view, and the money rows with theirs", async () => {
    const FUNDED = "social.funded_pension.";
    address.hash = serializeSocialHash({ ...defaultSocialState("funded-pension"), view: "gdp", selectedIds: [`${FUNDED}savings.amount`] }, "funded-pension");
    const html = await page("en");
    expect(html).toContain('data-view="gdp"');
    const headings = [...html.matchAll(/data-testid="series-heading"[^>]*>([^<]*)</g)].map(match => match[1]);
    expect(headings).toEqual(["Savings, end of year · % of GDP", "Money in and out · % of GDP", "Members", "Employers", "Return · %"]);
  });

  it("styles no row of the table as a total, while the payments table keeps its total row", async () => {
    const FUNDED = "social.funded_pension.";
    const totalRows = async (section: "funded-pension" | "social-payments", selectedIds: string[]) => {
      address.hash = serializeSocialHash({ ...defaultSocialState(section), mode: "table", selectedIds }, section);
      const html = renderPageMarkup("en", await renderSocialTopicPage("en", section));
      return { table: html.includes('data-testid="explorer-table"'), totals: html.match(/<tr class="border-t-2 border-\[var\(--ink\)\]"/g)?.length ?? 0 };
    };
    // Total fund assets sums nothing the page lists, so it is a row like the others even with the heading's first row selected.
    expect(await totalRows("funded-pension", [`${FUNDED}savings.amount`, `${FUNDED}net_assets.amount`])).toEqual({ table: true, totals: 0 });
    expect(await totalRows("funded-pension", [`${FUNDED}contributions.amount`, `${FUNDED}interest.amount`])).toEqual({ table: true, totals: 0 });
    expect(await totalRows("social-payments", ["social.payments.total.amount", "social.payments.pension.amount"])).toEqual({ table: true, totals: 1 });
  });

  it("offers the % of GDP switch on the money headings only", async () => {
    const FUNDED = "social.funded_pension.";
    const switchOn = async (selectedIds: string[]) => {
      address.hash = serializeSocialHash({ ...defaultSocialState("funded-pension"), selectedIds }, "funded-pension");
      return (await page("en")).includes('data-testid="social-measure-gdp"');
    };
    expect(await switchOn([`${FUNDED}savings.amount`])).toBe(true);
    expect(await switchOn([`${FUNDED}interest.amount`])).toBe(true);
    for (const id of ["members", "left", "paid_persons", "employers", "return"]) expect(await switchOn([`${FUNDED}${id}`]), id).toBe(false);
  });

  it("says the same in Georgian", async () => {
    const html = await page("ka");
    expect(latest(html)).toBe("2025: 8.24 მლრდ ლარი საპენსიო დანაზოგში");
    expect(html).toContain("წყარო: საქართველოს საპენსიო ფონდი");
  });

  it("names the Pension Fund and Geostat in the Dataset markup, not the Social Service Agency", async () => {
    const data = jsonLd(await page("en"));
    expect(data.provider.map((agency: { name: string }) => agency.name)).toEqual(["Pension Fund of Georgia", "National Statistics Office of Georgia (Geostat)"]);
    expect(data.temporalCoverage).toContain("2019");
    // Its own technique and keywords; the SSA pages' stay SSA-only.
    expect(data.measurementTechnique).toContain("Pension Fund of Georgia");
    expect(data.keywords).toContain("funded pension");
    const payments = jsonLd(renderPageMarkup("en", await renderSocialTopicPage("en", "social-payments")));
    expect(payments.measurementTechnique).not.toContain("Pension Fund");
    expect(JSON.stringify(payments.keywords)).not.toContain("funded pension");
  });

  it("has a title and a description of its own in both languages", async () => {
    const en = await socialTopicMetadata("en", "funded-pension"), ka = await socialTopicMetadata("ka", "funded-pension");
    expect(String(en.title)).toContain("Funded pension in Georgia");
    expect(String(en.description)).toContain("funded pension scheme");
    expect(String(ka.title)).toContain("დაგროვებითი პენსია");
  });
});

describe("the Excel sources", () => {
  it("offers the six Pension Fund documents under their archived lower-case paths, and leaves the SSA list as it was", async () => {
    const { ssa, pensionFund } = await loadSocialWorkbookSources("en");
    expect(pensionFund.map(source => source.sourceId).sort()).toEqual(["pension_fund_ifrs_2020", "pension_fund_ifrs_2022", "pension_fund_ifrs_2023", "pension_fund_ifrs_2024", "pension_fund_ifrs_2025", "pension_fund_report_2025"]);
    expect(pensionFund.map(source => source.downloadHref.split("/").at(-1)).sort()).toEqual(["2020-ifrs.pdf", "2022-ifrs-ge.pdf", "2023-ifrs-ge.pdf", "2024-ifrs-ge.pdf", "2025-ifrs.pdf", "annual_rep_2025_geo.pdf"]);
    expect(pensionFund.every(source => source.downloadHref.startsWith("/downloads/methodology/social-protection/files/"))).toBe(true);
    expect(ssa.every(source => source.sourceId.startsWith("ssa_"))).toBe(true);
    expect(ssa).toHaveLength(25);
  });
});
