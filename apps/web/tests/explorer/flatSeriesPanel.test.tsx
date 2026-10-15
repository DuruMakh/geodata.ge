import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { FlatSeriesPanel, type FlatSeriesRow } from "../../components/explorer-shell/flat-series-panel";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Messages } from "../../lib/i18n/types";

const rows: FlatSeriesRow[] = [
  { id: "total", label: "Total", color: "#000", value: "10" },
  { id: "a", label: "Alpha", color: "#111", value: "6" },
  { id: "b", label: "Beta", color: "#222", value: "4" },
];
let messages: Messages = {};
beforeAll(async () => { messages = await getMessages("en", ["controls"]); });
const noMatches = () => messages["controls.noMatches"];

function render(props: Partial<Parameters<typeof FlatSeriesPanel>[0]>) {
  return renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages}>
      <FlatSeriesPanel rows={rows} selectedIds={["total"]} onSelectionChange={() => {}} caption="2025 · units" searchPlaceholder="Search" downloadAction={null} totalId="total" {...props} />
    </I18nProvider>,
  );
}

describe("FlatSeriesPanel", () => {
  it("keeps a pinned total visible while a search matches nothing, and says so", () => {
    const html = render({ pinTotal: true, query: "zzz", onQueryChange: () => {} });
    expect(html.match(/data-testid="series-row"/g) ?? []).toHaveLength(1);
    expect(html).toContain("Total");
    expect(html).toContain(noMatches());
  });

  it("hides every row when nothing matches and the total is not pinned", () => {
    const html = render({ query: "zzz", onQueryChange: () => {} });
    expect(html.match(/data-testid="series-row"/g) ?? []).toHaveLength(0);
    expect(html).toContain(noMatches());
  });

  it("wraps labels by default and clamps them when wrapLabel is off", () => {
    expect(render({})).not.toContain("line-clamp-2");
    expect(render({ wrapLabel: false })).toContain("line-clamp-2");
  });

  it("wraps itself in the series aside when given a label", () => {
    expect(render({ asideLabel: "Series" })).toMatch(/<aside aria-label="Series"/);
    expect(render({})).not.toContain("<aside");
  });

  it("prints each heading once, above the first shown row of its group, and hides a group the search empties", () => {
    const grouped: FlatSeriesRow[] = [
      { id: "a", label: "Alpha", color: "#111", value: "6", heading: "Groups" },
      { id: "b", label: "Beta", color: "#222", value: "4", heading: "Groups" },
      { id: "c", label: "Gamma", color: "#333", value: "2", heading: "Single" },
    ];
    const headings = (html: string) => [...html.matchAll(/<p role="presentation" data-testid="series-heading"[^>]*>([^<]*)<\/p>/g)].map(match => match[1]);
    const all = render({ rows: grouped, totalId: undefined, selectedIds: [] });
    expect(headings(all)).toEqual(["Groups", "Single"]);
    expect(all.indexOf("Groups")).toBeLessThan(all.indexOf("Alpha"));
    expect(all.indexOf("Single")).toBeGreaterThan(all.indexOf("Beta"));
    expect(all.indexOf("Single")).toBeLessThan(all.indexOf("Gamma"));
    // Searching "Beta" keeps its group's label above it; the group with no match loses its label.
    expect(headings(render({ rows: grouped, totalId: undefined, selectedIds: [], query: "Beta", onQueryChange: () => {} }))).toEqual(["Groups"]);
    expect(headings(render({ rows: grouped, totalId: undefined, selectedIds: [], query: "Gamma", onQueryChange: () => {} }))).toEqual(["Single"]);
  });

  it("renders exactly as before when no row has a heading", () => {
    expect(render({})).not.toContain("series-heading");
  });
});
