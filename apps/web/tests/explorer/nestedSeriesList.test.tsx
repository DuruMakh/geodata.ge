import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { FlatSeriesPanel, type FlatSeriesRow } from "../../components/explorer-shell/flat-series-panel";
import { toggleId } from "../../lib/explorer/selection";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Messages } from "../../lib/i18n/types";

// A total with two nested parts, then a second top-level row: the shape of the topic explorers' lists.
const rows: FlatSeriesRow[] = [
  { id: "total", label: "Total", color: "#000", value: "10" },
  { id: "a", label: "Alpha", color: "#111", value: "6", parentId: "total" },
  { id: "b", label: "Beta", color: "#222", value: "4", parentId: "total" },
  { id: "c", label: "Gamma", color: "#333", value: "3" },
];
let messages: Messages = {};
beforeAll(async () => { messages = await getMessages("en", ["controls"]); });

const nesting = { selectedLabel: "Nested", expansionLabel: (label: string) => `Parts of ${label}` };
function render(props: Partial<Parameters<typeof FlatSeriesPanel>[0]>) {
  return renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages}>
      <FlatSeriesPanel rows={rows} selectedIds={["total"]} onSelectionChange={() => {}} caption="2025 · units" searchPlaceholder="Search" downloadAction={null} totalId="total" pinTotal nesting={nesting} {...props} />
    </I18nProvider>,
  );
}
const listed = (html: string) => [...html.matchAll(/data-testid="series-row" data-series-id="([^"]+)"/g)].map(match => match[1]);
const status = (html: string) => html.match(/data-testid="series-status"[^>]*>(.*?)<\/span><\/div>/)![1].replace(/<[^>]+>/g, "");

describe("FlatSeriesPanel with nesting", () => {
  it("lists the top-level rows with a caret column and keeps a parent closed while none of its parts is ticked", () => {
    const html = render({});
    expect(listed(html)).toEqual(["total", "c"]);
    expect(html).toContain('aria-label="Parts of Total"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("opens a parent whose part is ticked and indents its parts", () => {
    const html = render({ selectedIds: ["a"] });
    expect(listed(html)).toEqual(["total", "a", "b", "c"]);
    expect(html).toContain('<div class="ml-4"><div data-testid="series-row" data-series-id="a" data-level="item" data-parent-id="total"');
  });

  it("counts and bulk-selects the top-level rows and counts nested ticks apart", () => {
    const html = render({ selectedIds: ["total", "a", "b"] });
    expect(status(html)).toBe("Series 1 / 2 · Nested 2");
    // Only nested rows ticked: the bulk control offers to clear, and reads mixed.
    const nestedOnly = render({ selectedIds: ["a"] });
    expect(status(nestedOnly)).toBe("Series 0 / 2 · Nested 1");
    expect(nestedOnly).toContain('data-state="mixed"');
    expect(render({ selectedIds: ["total", "c"] })).toContain('data-state="true"');
  });

  it("opens a parent while a search matches one of its parts, showing only the matching parts and the pinned total", () => {
    const html = render({ query: "beta", onQueryChange: () => {} });
    expect(listed(html)).toEqual(["total", "b"]);
    expect(listed(render({ query: "gamma", onQueryChange: () => {} }))).toEqual(["total", "c"]);
  });

  it("follows a controlled caret state over the ticked-part rule", () => {
    expect(listed(render({ selectedIds: ["a"], nesting: { ...nesting, expanded: { total: false }, onExpandedChange: () => {} } }))).toEqual(["total", "c"]);
    expect(listed(render({ nesting: { ...nesting, expanded: { total: true }, onExpandedChange: () => {} } }))).toEqual(["total", "a", "b", "c"]);
  });

  it("draws no caret column when no row has parts", () => {
    const html = render({ rows: rows.map(({ parentId: _parentId, ...row }) => row) });
    expect(html).not.toContain("aria-expanded");
    expect(listed(html)).toEqual(["total", "a", "b", "c"]);
  });
});

describe("toggleId in list order", () => {
  const order = ["total", "a", "b", "c"];
  it("inserts an id at its place in the list", () => {
    expect(toggleId(["total", "c"], "a", order)).toEqual(["total", "a", "c"]);
  });
  it("removes an id that is selected", () => {
    expect(toggleId(["total", "a"], "total", order)).toEqual(["a"]);
  });
});
