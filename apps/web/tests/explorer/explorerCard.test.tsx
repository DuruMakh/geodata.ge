import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sparkline } from "../../components/ui/sparkline";
import { CARD_GRID_CLASS, ExplorerCard, leadSpan } from "../../components/explorer-groups/explorer-card";
import type { RegionSpread } from "../../lib/explorer/regionSpread";
import type { HubCardModel } from "../../lib/explorer/hubCards";

const SERIES = [27.2, 27.2, 26.7, 26.4, 23.0, 21.9, 21.7, 21.6, 19.2, 17.6, 18.5, 20.6, 17.3, 16.4, 13.9, 13.9];
const card = (extra: Partial<HubCardModel> = {}): HubCardModel => ({
  index: "01", title: "Unemployment rate", description: "Share of the labour force without a job.", href: "/explorer/unemployment/overview",
  comingSoon: false, series: SERIES, seriesColor: "#1E1B16", footer: null,
  latest: { value: "13.9%", period: "2025", caption: "of labour force" }, years: "2010–2025", ...extra,
});
const html = (props: Partial<Parameters<typeof ExplorerCard>[0]> = {}) =>
  renderToStaticMarkup(<ExplorerCard card={card()} locale="en" regionCount={11} {...props} />);
const count = (markup: string, token: RegExp) => (markup.match(token) ?? []).length;
const text = (markup: string) => markup.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");

const SPREAD: RegionSpread = {
  points: [{ x: 10, key: true }, { x: 40, key: false }, { x: 90, key: true }], georgiaX: 60, georgiaLabel: "Georgia 13.9%",
  low: { name: "Shida Kartli", value: "7.0%" }, high: { name: "Tbilisi", value: "17.5%" }, lowX: 10, value: "7.0–17.5%", caption: "11 regions · 2025",
};

describe("leadSpan", () => {
  it("follows the prototype rule: whole row, two columns, or two by two", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(leadSpan)).toEqual(["lead3", "lead2", "lead2x2", "lead3", "lead2", "lead2x2", "lead3", "lead2"]);
  });
});

describe("CARD_GRID_CLASS", () => {
  it("is one column on phones, two from 768px and three from 1101px", () => {
    expect(CARD_GRID_CLASS).toContain("grid-cols-1");
    expect(CARD_GRID_CLASS).toContain("min-[768px]:grid-cols-2");
    expect(CARD_GRID_CLASS).toContain("min-[1101px]:grid-cols-3");
    expect(CARD_GRID_CLASS).not.toContain("899");
  });
});

describe("ExplorerCard", () => {
  it("renders a series card as a link with its title, index, value, one line chart and years", () => {
    const markup = html();
    expect(markup).toContain('href="/en/explorer/unemployment/overview"');
    expect(text(markup)).toContain("|01|");
    expect(markup).toContain("Unemployment rate");
    expect(text(markup)).toContain("|13.9%|of labour force · 2025|");
    expect(text(markup)).toContain("2010–2025");
    expect(count(markup, /<svg/g)).toBe(2); // the corner arrow and the chart
    expect(count(markup, /<path[^>]*stroke="#1E1B16"/g)).toBeGreaterThan(0);
    expect(markup).not.toContain("Share of the labour force");
  });

  it("links Georgian and English cards to their own language", () => {
    expect(html({ locale: "ka" })).toContain('href="/explorer/unemployment/overview"');
    expect(html({ locale: "en" })).toContain('href="/en/explorer/unemployment/overview"');
  });

  it("names the link by its title and describes it by the value and footer, with decorative charts", () => {
    const markup = html();
    const labelledby = /aria-labelledby="([^"]+)"/.exec(markup)![1];
    expect(new RegExp(`<h3[^>]*id="${labelledby}"`).test(markup)).toBe(true);
    const describedby = /aria-describedby="([^"]+)"/.exec(markup)![1].split(" ");
    expect(describedby).toHaveLength(2);
    for (const id of describedby) expect(markup).toContain(`id="${id}"`);
    expect(count(markup, /<svg[^>]*aria-hidden="true"/g)).toBe(2);
    expect(markup).toMatch(/<span[^>]*aria-hidden="true"[^>]*data-testid="explorer-card-graphic"/);
  });

  it("gives two cards on one page different ids", () => {
    const both = renderToStaticMarkup(<><ExplorerCard card={card()} locale="en" regionCount={11} /><ExplorerCard card={card()} locale="en" regionCount={11} /></>);
    const ids = [...both.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adds ' · annual data' to the footer only when there is no period", () => {
    expect(text(html({ card: card({ latest: { value: "5.2", period: "" } }) }))).toContain("2010–2025 · annual data");
    expect(text(html())).not.toContain("annual data");
    expect(text(html({ locale: "ka", card: card({ latest: { value: "5.2", period: "" } }) }))).toContain("2010–2025 · წლიური მონაცემები");
  });

  it("shows no value row when the page has no latest value", () => {
    const markup = html({ card: card({ latest: null, series: null, seriesColor: null }) });
    expect(markup).not.toContain("13.9%");
    expect(markup).toContain("2010–2025");
  });

  it("shows the description, a larger area chart and first and last year on a lead card", () => {
    const markup = html({ lead: "lead3" });
    expect(markup).toContain("Share of the labour force without a job.");
    expect(text(markup)).toContain("|2010|");
    expect(text(markup)).toContain("|2025|");
    expect(count(markup, /<svg/g)).toBe(2);
    expect(markup).toMatch(/<path[^>]*fill="var\(--tint\)"/);
    // the last value is the end label of the lead chart
    expect(count(markup, /13\.9%/g)).toBeGreaterThanOrEqual(2);
  });

  it("lays out each lead span in its own grid cells", () => {
    expect(html({ lead: "lead3" })).toContain("col-span-full");
    expect(html({ lead: "lead2" })).toContain("min-[1101px]:col-span-2");
    const big = html({ lead: "lead2x2" });
    expect(big).toContain("min-[1101px]:col-span-2");
    expect(big).toContain("min-[1101px]:row-span-2");
  });

  it("draws the region spread for a Regions page, with Georgia's dashed marker and both extremes", () => {
    const markup = html({
      card: card({ title: "Unemployment by region", href: "/explorer/unemployment/regions", series: null, seriesColor: null, latest: null }),
      spread: SPREAD,
    });
    expect(count(markup, /data-testid="region-spread-dot"/g)).toBe(3);
    expect(markup).toContain("Shida Kartli 7.0%");
    expect(markup).toContain("Tbilisi 17.5%");
    expect(text(markup)).toContain("|7.0–17.5%|11 regions · 2025|Georgia 13.9%|");
    expect(markup).toContain("left:60%");
    expect(count(markup, /<svg/g)).toBe(1); // the arrow only
  });

  it("shows the map text for a Regions page without a spread, and keeps its link", () => {
    const markup = html({ card: card({ href: "/explorer/wages/regions", series: null, seriesColor: null, latest: null }) });
    expect(text(markup)).toContain("Map and list · 11 regions");
    expect(count(markup, /<svg/g)).toBe(2); // arrow and the map icon
    expect(text(html({ locale: "ka", card: card({ href: "/explorer/wages/regions", series: null, seriesColor: null, latest: null }) }))).toContain("რუკა და სია · 11 რეგიონი");
  });

  it("keeps an empty graphic band for a page with neither series nor regions", () => {
    const markup = html({ card: card({ href: "/explorer/trade/partners", series: null, seriesColor: null, latest: null }) });
    expect(markup).not.toContain("Map and list");
    expect(count(markup, /<svg/g)).toBe(1);
    expect(markup).toContain('data-testid="explorer-card-graphic"');
  });

  it("renders the unemployment-by-age card as one bar per age band, young bands marked", () => {
    const bands = ["15–19", "20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65+"];
    const markup = html({
      card: card({
        href: "/explorer/unemployment/age", series: null, seriesColor: null,
        graphic: { kind: "bars", bars: bands.map((label, index) => ({ label, value: 40 - index * 3, accent: index < 3 })), first: "15–19", last: "65+" },
      }),
    });
    expect(count(markup, /data-testid="card-bar"/g)).toBe(11);
    expect(count(markup, /data-testid="card-bar"[^>]*data-accent="true"/g)).toBe(3);
    expect(markup).toContain("height:100%");
    expect(text(markup)).toContain("|15–19|65+|");
  });

  it("renders a pair graphic as labelled bars scaled to the page's maximum", () => {
    const markup = html({
      card: card({
        href: "/explorer/unemployment/gender", series: null, seriesColor: null,
        graphic: { kind: "pair", max: 20, rows: [{ label: "Men", value: 15.8, text: "15.8%", accent: true }, { label: "Women", value: 11.4, text: "11.4%", accent: false }] },
      }),
    });
    expect(text(markup)).toContain("|Men|");
    expect(text(markup)).toContain("|15.8%|");
    expect(markup).toContain("width:79%");
    expect(markup).toContain("width:57%");
    // One grid for all rows: the value column fits the widest value, and a value never wraps from its unit.
    expect(markup).toContain("grid-cols-[minmax(0,1fr)_max-content]");
    for (const [tag] of markup.matchAll(/<b[^>]*data-testid="card-pair-value"[^>]*>/g)) expect(tag).toContain("whitespace-nowrap");
    expect(count(markup, /data-testid="card-pair-value"/g)).toBe(2);
  });

  it("makes a card without a link a plain, disabled block with a coming-soon badge", () => {
    const markup = html({ card: card({ href: null, comingSoon: true }) });
    expect(markup).not.toContain("<a ");
    expect(markup).not.toContain("aria-disabled");
    expect(markup).toContain("Coming soon");
  });
});

describe("ExplorerCard for assistive technology and edge cases", () => {
  const describedText = (markup: string) => {
    const ids = /aria-describedby="([^"]+)"/.exec(markup)![1].split(" ");
    return ids.map((id) => text(new RegExp(`id="${id}"[^>]*>(.*?)</span>`).exec(markup)![1])).join(" / ");
  };

  it("describes a pair card by its rows, since the band is hidden", () => {
    const markup = html({
      card: card({
        series: null, seriesColor: null, latest: null,
        graphic: { kind: "pair", max: 20, rows: [{ label: "Men", value: 15.8, text: "15.8%", accent: true }, { label: "Women", value: 11.4, text: "11.4%", accent: false }] },
      }),
    });
    expect(describedText(markup)).toContain("Men 15.8%, Women 11.4%");
  });

  it("describes a bars card by its first and last band, and a spread card by its extremes", () => {
    const bars = html({ card: card({ series: null, seriesColor: null, graphic: { kind: "bars", first: "15–19", last: "65+", bars: [{ label: "a", value: 3, accent: true }] } }) });
    expect(describedText(bars)).toContain("15–19, 65+");
    const spread = html({ card: card({ series: null, seriesColor: null, latest: null }), spread: SPREAD });
    expect(describedText(spread)).toContain("Shida Kartli 7.0%, Tbilisi 17.5%");
  });

  it("draws no NaN or infinite sizes for empty bars or a zero maximum", () => {
    const empty = html({ card: card({ series: null, seriesColor: null, graphic: { kind: "bars", first: "", last: "", bars: [] } }) });
    const zero = html({
      card: card({ series: null, seriesColor: null, graphic: { kind: "pair", max: 0, rows: [{ label: "Men", value: 0, text: "0%", accent: false }] } }),
    });
    for (const markup of [empty, zero]) expect(markup).not.toMatch(/NaN|Infinity/);
    expect(zero).toContain("width:0%");
  });

  it("places a split lead card's text in fixed rows, so a missing description or value keeps the rest in place", () => {
    const full = html({ lead: "lead3" });
    for (const row of [1, 2, 3, 4, 5]) expect(full).toContain(`min-[1101px]:row-start-${row}`);
    const bare = html({ lead: "lead3", card: card({ description: "", latest: null }) });
    expect(bare).toContain("min-[1101px]:row-start-2");
    expect(bare).not.toContain("min-[1101px]:row-start-3");
    expect(bare).not.toContain("min-[1101px]:row-start-4");
    expect(bare).toContain("min-[1101px]:row-start-5");
    expect(html({ lead: "lead2x2" })).not.toContain("row-start");
  });
});

describe("Sparkline", () => {
  // Pinned from the component before it learned `area` and `endDot`: the side KPIs and hub cards that do not ask for them
  // must keep drawing exactly this.
  it("renders exactly the same markup as before when the new props are not set", () => {
    expect(renderToStaticMarkup(<Sparkline values={[1, 3, null, 2, 5, 6]} color="#111" />)).toBe(
      '<svg aria-hidden="true" viewBox="0 0 64 16" width="64" height="16" class="mt-1.5 block"><path d="M1.0 15.0 L13.4 9.4" fill="none" stroke="#111" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"></path><path d="M38.2 12.2 L50.6 3.8 L63.0 1.0" fill="none" stroke="#111" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"></path></svg>',
    );
    expect(renderToStaticMarkup(<Sparkline values={[1, 3, 2, 5]} color="#111" width={200} height={34} fluidOnMobile />)).toBe(
      '<svg aria-hidden="true" viewBox="0 0 200 34" width="200" height="34" preserveAspectRatio="none" class="mt-1.5 block max-[768px]:w-full"><path d="M1.0 33.0 L67.0 17.0 L133.0 25.0 L199.0 1.0" fill="none" stroke="#111" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>',
    );
  });

  it("fills the area under each drawn run to the bottom edge, before the line", () => {
    const markup = renderToStaticMarkup(<Sparkline values={[1, 3, null, 2, 5, 6]} color="#111" area />);
    const areas = [...markup.matchAll(/<path d="([^"]+)"[^>]*fill="var\(--tint\)"/g)].map((match) => match[1]);
    expect(areas).toEqual(["M1.0 15.0 L13.4 9.4 L13.4 16 L1.0 16 Z", "M38.2 12.2 L50.6 3.8 L63.0 1.0 L63.0 16 L38.2 16 Z"]);
    expect(markup.indexOf("fill=\"var(--tint)\"")).toBeLessThan(markup.indexOf("stroke=\"#111\""));
  });

  it("marks the last drawn point with a ring and a dot that stay round when the chart is stretched", () => {
    const markup = renderToStaticMarkup(<Sparkline values={[1, 3, 2, 5]} color="#111" width={200} height={34} fluidOnMobile endDot />);
    expect(markup).toContain('d="M199.0 1.0 L199.0 1.0"');
    expect(markup.match(/vector-effect="non-scaling-stroke"/g)!.length).toBe(3);
    expect(markup).toContain('stroke="var(--accent)"');
    expect(markup).toContain("overflow:visible");
  });
});
