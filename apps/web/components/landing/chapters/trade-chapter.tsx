import type { TradeChapter as TradeChapterModel } from "../../../lib/landing/chapters/types";
import { ButterflyChart, type ButterflyLabels } from "./butterfly-chart";
import { billions, decimals } from "./chart-format";
import { StatCard } from "./stat-card";
import { TradeLinesChart, type TradeLinesLabels } from "./trade-lines-chart";

// Chapter 09: the ten largest trading partners (exports left, imports right) beside the exports and imports lines
// since the first year, with three number cards below: the turnover, the balance and the largest export product's
// share. 7/5 columns from 1000px; the cards are three columns from 700px.

type StatText = { label: string; note: string };

export type TradeLabels = {
  butterfly: ButterflyLabels;
  lines: TradeLinesLabels;
  turnover: StatText;
  balance: StatText;
  product: StatText;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The cards' notes, each with the year. The balance note follows the data (imports over exports, or exports over
 * imports); the product note names the largest export product from the data and the second one when there is one.
 */
export function tradeNotes(data: TradeChapterModel, t: Translate) {
  const { year, topProduct, secondProduct } = data;
  const deficit = data.balanceUsd < 0;
  return {
    turnover: t("landing.trade.turnover.note", { year, exports: billions(data.exportsUsd, 1), imports: billions(data.importsUsd, 1) }),
    balance: t(deficit ? "landing.trade.balance.noteDeficit" : "landing.trade.balance.noteSurplus", {
      year,
      times: decimals(deficit ? data.importsUsd / data.exportsUsd : data.exportsUsd / data.importsUsd, 1),
    }),
    product:
      t("landing.trade.product.note", { year, product: topProduct.label, usd: billions(topProduct.usd, 2) }) +
      (secondProduct ? ` ${t("landing.trade.product.second", { product: secondProduct.label, usd: billions(secondProduct.usd, 2) })}` : ""),
  };
}

export function TradeChapter({ data, labels }: { data: TradeChapterModel; labels: TradeLabels }) {
  if (!data.partners.length) throw new Error("Trade chapter: no partners");
  if (!data.years.length) throw new Error("Trade chapter: no yearly series");
  const unit = labels.butterfly.unit;
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-10 min-[1000px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1000px]:gap-12">
        <ButterflyChart year={data.year} partners={data.partners} labels={labels.butterfly} />
        <TradeLinesChart data={{ years: data.years, exports: data.exports, imports: data.imports }} labels={labels.lines} />
      </div>
      <div className="mt-12 grid grid-cols-1 gap-[22px] min-[700px]:grid-cols-3 min-[700px]:gap-8">
        <StatCard label={labels.turnover.label} value={billions(data.turnoverUsd, 1)} unit={unit} note={labels.turnover.note} />
        <StatCard label={labels.balance.label} value={billions(data.balanceUsd, 1)} unit={unit} note={labels.balance.note} />
        <StatCard label={labels.product.label} value={decimals(data.topProduct.share * 100, 1)} unit="%" note={labels.product.note} />
      </div>
    </>
  );
}
