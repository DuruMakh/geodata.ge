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

  it("prints each heading once, before the first listed row under it, and drops one whose rows a search hides", () => {
    const grouped: FlatSeriesRow[] = [rows[0], { ...rows[1], heading: "Size" }, { ...rows[2], heading: "Size" }, { id: "c", label: "Gamma", color: "#333", value: "1", heading: "Industry" }];
    const html = render({ rows: grouped });
    expect(html.match(/data-testid="series-heading"/g) ?? []).toHaveLength(2);
    expect(html).toMatch(/role="presentation"[^>]*>Size<\/p>/);
    // Each heading names a group holding its rows, so a screen reader announces it.
    expect(html.match(/role="group" aria-label="Size"[^>]*>.*?<\/p>(.*?)role="group" aria-label="Industry"/)?.[1]).toMatch(/Alpha.*Beta/);
    expect(html).toMatch(/role="group" aria-label="Industry"[^>]*>.*Gamma/);
    expect(html.indexOf(">Size<")).toBeLessThan(html.indexOf("Alpha"));
    expect(html.indexOf("Beta")).toBeLessThan(html.indexOf(">Industry<"));
    expect(html.indexOf(">Industry<")).toBeLessThan(html.indexOf("Gamma"));
    const searched = render({ rows: grouped, pinTotal: true, query: "gam", onQueryChange: () => {} });
    expect(searched).not.toContain(">Size<");
    expect(searched).toContain(">Industry<");
    // Nested lists print headings on their top-level rows too.
    expect(render({ rows: grouped, nesting: { selectedLabel: "Sub", expansionLabel: label => label } }).match(/data-testid="series-heading"/g) ?? []).toHaveLength(2);
  });

  it("renders a list without headings as before", () => {
    expect(render({})).not.toContain("series-heading");
  });
});
