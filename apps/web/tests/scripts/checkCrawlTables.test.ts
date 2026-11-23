import { describe, expect, it } from "vitest";
import { crawlWrappers } from "../../scripts/check-crawl-tables";

const table = (label: string) => `<table><caption>${label}</caption><thead><tr><th>Category</th><th>2024</th></tr></thead><tbody><tr><th>A</th><td>1</td></tr></tbody></table>`;
const block = (inner: string) => `<div data-testid="crawl-tables" class="crawl-tables"><p>Data table</p><div role="region" aria-label="Data table: T">${inner}</div></div>`;
const page = (body: string) => `<html><head><title>T</title><style>p{color:red}</style></head><body>${body}</body></html>`;

describe("crawlWrappers (npm run crawl:check)", () => {
  it("reads a block's first tables and its folded rest apart", () => {
    const [wrapper, ...more] = crawlWrappers(page(`<main><h1>Title</h1>${block(`${table("First")}<details><summary tabindex="-1">The rest of the data</summary>${table("Rest")}</details>`)}</main>`));
    expect(more).toEqual([]);
    expect(wrapper!.first).toContain("<caption>First</caption>");
    expect(wrapper!.first).not.toContain("Rest");
    expect(wrapper!.rest.startsWith("<details>")).toBe(true);
    expect(wrapper!.rest).toContain("<caption>Rest</caption>");
    expect(wrapper!.hiddenBy).toBeNull();
  });

  it("does not count an empty wrapper, and reads every block of a page", () => {
    const html = page(`${block(table("One"))}<div data-testid="crawl-tables" class="crawl-tables"></div><section>${block(table("Two"))}</section>`);
    expect(crawlWrappers(html).map((wrapper) => /<caption>(\w+)/.exec(wrapper.first)![1])).toEqual(["One", "Two"]);
  });

  it.each([
    ["the old hidden wrapper", `<div hidden="" data-testid="crawl-tables" class="crawl-tables"><p>D</p><div role="region">${table("T")}</div></div>`, "hidden"],
    ["a hidden ancestor", `<section hidden="">${block(table("T"))}</section>`, "hidden"],
    ["an aria-hidden ancestor", `<div aria-hidden="true"><div>${block(table("T"))}</div></div>`, 'aria-hidden="true"'],
    ["an inert ancestor", `<div inert="">${block(table("T"))}</div>`, "inert"],
    ["an ancestor styled display:none", `<div style="color:red;display:none">${block(table("T"))}</div>`, "display:none"],
    ["a closed details ancestor", `<details><summary>More</summary>${block(table("T"))}</details>`, "a closed <details>"],
  ])("names what keeps a block from a reader: %s", (_name, body, reason) => {
    expect(crawlWrappers(page(body)).map((wrapper) => wrapper.hiddenBy)).toEqual([reason]);
  });

  it("is kept after a hidden sibling, inside an open details, and beside void and self-closed tags", () => {
    const html = page(`<div hidden="">gone</div><img src="a.png"><br/><svg><path d="M0 0"/></svg><details open=""><summary>S</summary>${block(table("T"))}</details>`);
    expect(crawlWrappers(html).map((wrapper) => wrapper.hiddenBy)).toEqual([null]);
  });

  it("counts what a reader keeps before the first tables end: text, a separator per cell and each link's address, not hidden or drawn parts", () => {
    const withReader = (before: string) => crawlWrappers(page(`${before}${block(`${table("T")}<details><summary>R</summary>${table("U")}</details>`)}`))[0]!.readerEnd;
    const base = withReader("");
    expect(withReader(`<p>${"x".repeat(100)}</p>`)).toBe(base + 102);
    expect(withReader(`<div hidden="">${"x".repeat(100)}</div><svg><text>${"y".repeat(50)}</text></svg>`)).toBe(base);
    expect(withReader(`<a href="/en/explorer">All data</a>`)).toBe(base + 2 + "All data".length + "https://fiscal.ge/en/explorer".length + 4);
    // The folded rest comes after the first tables: it adds nothing to where they end.
    expect(crawlWrappers(page(block(table("T"))))[0]!.readerEnd).toBe(base);
  });
});
