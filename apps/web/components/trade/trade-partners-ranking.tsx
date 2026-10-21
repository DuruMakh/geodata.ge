"use client";
import { useState } from "react";
import type { TradeChartIndicator } from "../../lib/data/tradeOverview/types";
import type { TradePartnersModel } from "../../lib/explorer/tradePartners";
import type { TradeProductRankingRow } from "../../lib/explorer/tradeProducts";
import type { TradePartnersTab } from "../../lib/explorer/tradePartnersState";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExternalRanking } from "../external/external-ranking";

export function TradePartnersRanking({ model, tab, measure, pageSize, services: serviceDataset = false }: { model: Pick<TradePartnersModel, "range" | "unit"> & { ranking: readonly TradeProductRankingRow[]; missingRanking: readonly TradeProductRankingRow[] }; tab: TradePartnersTab | "products"; measure: TradeChartIndicator; pageSize?: number; services?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const { messages } = useI18n();
  const t = (key: string) => message(messages, `trade.partners.${key}`);
  const p = (key: string) => message(messages, `trade.products.${key}`);
  const services = serviceDataset || tab === "types";
  const composition = tab === "categories";
  const balance = measure === "trade.balance", showAll = tab === "groups" || tab === "types" || composition || expanded;
  const signed = balance || ((tab === "products" || composition) && model.ranking.some(row => row.valueUsd! < 0));
  const complete = [...model.ranking, ...model.missingRanking], pageCount = pageSize ? Math.ceil(complete.length / pageSize) : 1;
  const rows = showAll ? pageSize ? complete.slice(page * pageSize, (page + 1) * pageSize) : model.ranking : model.ranking.slice(0, 10);
  const title = message(messages, composition ? "trade.composition.rankingTitle" : services ? tab === "countries" ? "trade.services.countryRankingTitle" : "trade.services.rankingTitle" : tab === "products" ? "trade.products.rankingTitle" : "trade.partners.rankingTitle", { measure: message(messages, `trade.${composition ? "composition." : services ? "services." : ""}indicator.${measure}`), kind: t(tab === "countries" ? "countries" : "groups"), year: model.range.end });
  const shareRow = (item: TradeProductRankingRow) => ({ entityId: item.entityId, label: item.label, valueUsd: item.valueUsd, share: item.shareOfNational, rank: item.rank, color: item.color });
  const listed = showAll && !pageSize ? [...model.ranking, ...model.missingRanking] : rows;
  const note = composition ? message(messages, "trade.composition.shareNote") : services ? message(messages, balance ? "trade.services.balanceRankingNote" : "trade.services.shareNote") : tab === "products" || measure === "trade.domestic_exports" || measure === "trade.reexports" ? p("shareNote") : t(balance ? "balanceRankingNote" : "shareNote");
  const itemLabel = composition ? message(messages, "trade.composition.category") : tab === "types" ? message(messages, "trade.services.type") : tab === "products" ? p("series") : t(tab === "countries" ? "country" : "group");
  return <ExternalRanking
    testId="trade-partners" data={{ "end-year": model.range.end, "has-share": String(!balance) }}
    title={title} itemLabel={itemLabel} shareLabel={composition ? message(messages, "trade.composition.share") : services ? message(messages, "trade.services.share") : t("share")} shareShortLabel={t("shareShort")} note={note} empty={t("noRanking")}
    rows={listed.map(shareRow)} other={null} unit={model.unit} signed={signed} barMax={Math.max(...model.ranking.map(row => Math.abs(row.valueUsd!)), 1)}
    showShare={!balance} rankLabel={t("rank")} unavailableLabel={t("unavailable")}
    footer={<>
      {!showAll && (model.ranking.length > 10 || model.missingRanking.length > 0) ? <button type="button" data-testid="trade-partners-show-all" onClick={() => setExpanded(true)} className={`mt-4 ${tab === "products" ? "min-h-11 " : "max-[768px]:min-h-11 "}cursor-pointer text-[12px] font-semibold text-[var(--accent)] underline underline-offset-4`}>{tab === "products" ? p("showAll") : t("showAll")}</button> : null}
      {showAll && pageSize && pageCount > 1 ? <nav aria-label={p("rankingPages")} className="mt-4 flex items-center justify-between gap-4 text-xs"><button type="button" data-testid="trade-products-ranking-previous" disabled={page === 0} onClick={() => setPage(page - 1)} className="min-h-11 cursor-pointer disabled:opacity-35">{p("previous")}</button><span>{page + 1} / {pageCount}</span><button type="button" data-testid="trade-products-ranking-next" disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)} className="min-h-11 cursor-pointer disabled:opacity-35">{p("next")}</button></nav> : null}
    </>} />;
}
