import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { ExternalRanking, type ExternalRankingRow } from "../../components/external/external-ranking";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Messages } from "../../lib/i18n/types";

let messages: Messages = {};
beforeAll(async () => { messages = await getMessages("en", ["external"]); });

const rows: ExternalRankingRow[] = [
  { entityId: "a", label: "Alpha", valueUsd: 4_000_000, share: 0.4, rank: 1, color: "#123456" },
  { entityId: "b", label: "Beta", valueUsd: -1_000_000, share: -0.1, rank: 2, color: "#654321" },
];
const other: ExternalRankingRow = { entityId: "other", label: "Other", valueUsd: 500_000, share: 0.05, rank: null, color: "#999999" };
const base = { testId: "trade-partners", title: "Ranking", itemLabel: "Country", shareLabel: "Share", note: "of the total", empty: "Nothing to rank" };

function render(props: Partial<Parameters<typeof ExternalRanking>[0]> = {}) {
  return renderToStaticMarkup(<I18nProvider locale="en" messages={messages}><ExternalRanking {...base} rows={rows} other={other} {...props} /></I18nProvider>);
}

describe("ExternalRanking", () => {
  it("renders today's markup by default", () => {
    expect(render()).toMatchSnapshot();
  });

  it("draws bars from a centre zero axis when signed", () => {
    expect(render({ signed: true })).toContain('data-testid="trade-partners-zero-axis"');
    expect(render()).not.toContain("zero-axis");
  });

  it("drops the share column when asked", () => {
    const html = render({ showShare: false, other: null });
    expect(html.match(/<th class="py-2/g) ?? []).toHaveLength(3);
  });

  it("heads the unavailable rows once, also when they come first", () => {
    const missing: ExternalRankingRow = { entityId: "m", label: "Missing", valueUsd: null, share: null, rank: null, color: "#000" };
    const after = render({ rows: [rows[0], missing], other: null, unavailableLabel: "Unavailable" });
    expect(after.match(/Unavailable/g) ?? []).toHaveLength(1);
    expect(after.match(/data-testid="trade-partners-unavailable-row"/g) ?? []).toHaveLength(1);
    const first = render({ rows: [missing, { ...missing, entityId: "n" }], other: null, unavailableLabel: "Unavailable" });
    expect(first.match(/Unavailable/g) ?? []).toHaveLength(1);
    expect(first.indexOf("Unavailable")).toBeLessThan(first.indexOf("trade-partners-unavailable-row"));
  });
});
