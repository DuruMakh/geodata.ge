"use client";

import { useMemo } from "react";
import { fillUnderWhiteText } from "../../lib/explorer/colors";
import { squarify } from "../../lib/explorer/treemapLayout";
import { formatAmountParts, formatShare, MISSING } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { shortAmount } from "../../lib/yearReview/findings";
import { buysView, changeView, whereView, type Grouping } from "../../lib/yearReview/yearView";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { SegmentedTabs } from "../ui/editorial";
import { withLari } from "../ui/lari";
import { BuysTreemap, TALL, type BuysTile } from "./buys-treemap";
import { ChangeBars, type ChangeBar } from "./change-bars";
import { ChartFoot, FOOT_NOTE, H3, H3_META, Section, type YearReviewSectionProps } from "./section";
import { RankingList, WaffleGrid, type RankRow } from "./waffle";
import { YearTag } from "./year-tag";

// Section 03, "Where the money goes" (spec §4): every 100 GEL of the chosen year as a grid with the ranking beside it
// and the same grid in the comparison year, what changed on the year before, and what general government buys.
// Hovering or pinning a category (spec §5) dims everything else in the part that draws it.

const PIN_HINT_ID = "year-review-pin-hint";

type Props = Pick<YearReviewSectionProps, "data" | "year" | "grouping" | "focus" | "pin" | "onFocus" | "onPin" | "onGrouping">;

/** Section 03 for the chosen year and grouping. */
export function WhereMoneyGoes({ data, year, grouping, focus, pin, onFocus, onPin, onGrouping }: Props) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const money = (value: number, signed = false) => {
    const parts = formatAmountParts(value, signed, locale, true);
    return `${parts.num} ${parts.unit}`;
  };
  const lari = text("yearReview.lari");
  const { years } = data.budget;
  const index = years.indexOf(year);
  // The views and the tall treemap layout follow the year and grouping only, not a hover.
  const { where, change, buys, tall } = useMemo(() => {
    const buys = buysView(data, year);
    return {
      where: whereView(data, grouping, year),
      change: changeView(data, grouping, year),
      buys,
      tall: squarify(buys.value.tiles.map((tile) => tile.value), 0, 0, TALL.width, TALL.height),
    };
  }, [data, grouping, year]);

  const categories = grouping === "fields" ? data.budget.fields : data.budget.institutions;
  const byId = new Map(categories.map((category) => [category.id, category]));
  const colorOf = (id: string) => byId.get(id)!.color;
  // A hovered or pinned category of another grouping, or from the treemap, leaves the grid and ranking as they are.
  const picked = focus !== null && byId.has(focus) ? focus : null;

  // Every 100 GEL: the grid, its note, and the ranking.
  const meta = `${text("yearReview.m04", { y: year })}${where.planned ? ` · ${text("yearReview.plan")}` : ""}`;
  const count = text(grouping === "fields" ? "yearReview.cnt.fn" : "yearReview.cnt.adm", { n: where.items.length });
  const zero = where.items.filter((item) => item.value > 0 && item.cells === 0).length;
  const negative = where.items.filter((item) => item.value < 0).length;
  const note = [
    text("yearReview.cellNote"),
    ...(zero > 0 ? [text(zero === 1 ? "yearReview.zeroNote1" : "yearReview.zeroNote", { n: zero })] : []),
    ...(negative > 0 ? [text("yearReview.negNote")] : []),
  ].join(" · ");
  const wafAria = text("yearReview.wafAria", {
    items: where.items.filter((item) => item.cells > 0).map((item) => `${item.label} — ${item.cells} ${lari}`).join(", "),
  });
  const vsPrevious = index > 0 ? text("yearReview.vsPrev", { y: years[index - 1]! }) : "";
  const planSaid = where.planned ? `, ${text("yearReview.plan")}` : "";
  const rows: RankRow[] = where.items.map((item) => {
    const share = formatShare(item.share);
    const growth = item.change === null ? null : formatShare(item.change, true);
    return {
      id: item.id,
      label: item.label,
      color: item.color,
      cells: item.value < 0 ? MISSING : item.cells === 0 ? "<1" : String(item.cells),
      sub: [money(item.value), share, ...(growth ? [growth] : []), ...(item.value < 0 ? [text("yearReview.negTag")] : [])].join(" · "),
      said: `${item.label}: ${money(item.value)}${planSaid}, ${share}${growth ? `, ${growth} ${vsPrevious}` : ""}`,
      spark: item.spark,
      sparkIndex: index,
      planned: where.planned,
    };
  });
  const listAria = text("yearReview.listAria", { y: year });

  // The comparison grid: the focused category's lari then and now, else (as on the board) the one that moved most.
  const tally = (ids: string[]) => ids.reduce((counts, id) => counts.set(id, (counts.get(id) ?? 0) + 1), new Map<string, number>());
  // Every category positive in the comparison year, with its cells: a small one has none and reads `<1`.
  const thenCount = tally(where.thenCells);
  const thenIndex = years.indexOf(where.thenYear);
  const thenOf = new Map(categories.filter((category) => (category.values[thenIndex] ?? 0) > 0).map((category) => [category.id, thenCount.get(category.id) ?? 0]));
  const nowOf = new Map(where.items.filter((item) => item.value > 0).map((item) => [item.id, item.cells]));
  const moved = (id: string) => Math.abs((nowOf.get(id) ?? 0) - (thenOf.get(id) ?? 0));
  const compared =
    picked ??
    categories
      .filter((category) => thenOf.has(category.id) && nowOf.has(category.id))
      .reduce<string | null>((best, category) => (best === null || moved(category.id) > moved(best) ? category.id : best), null);
  const [early, late] = where.thenYear < year ? [where.thenYear, year] : [year, where.thenYear];
  const cellsIn = (target: number, id: string) => (target === where.thenYear ? thenOf.get(id) : nowOf.get(id));
  const lariOf = (cells: number | undefined) => (
    <b className="whitespace-nowrap text-[30px] tracking-[-0.02em] tabular-nums">
      {cells === undefined ? MISSING : cells === 0 ? "<1" : cells}
      {cells === undefined ? null : <small className="ml-1 text-[15px] font-medium tracking-normal text-[var(--muted)]">{lari}</small>}
    </b>
  );

  const waffle = (still: boolean) => (
    <WaffleGrid
      cells={where.cells}
      colorOf={colorOf}
      focus={still ? null : picked}
      ariaLabel={wafAria}
      {...(still ? {} : { onFocus, onPin })}
    />
  );
  const ranking = (still: boolean) => (
    <RankingList
      rows={rows}
      focus={still ? null : picked}
      unit={lari}
      ariaLabel={listAria}
      {...(still ? {} : { pin, hintId: PIN_HINT_ID, onFocus, onPin })}
    />
  );
  const hundredHeading = text("yearReview.s1Exp");
  // One picture of the grid and the list, side by side as on a wide screen.
  const hundredPicture = (
    <div className="@container">
      <div className="grid grid-cols-[384px_minmax(0,1fr)] items-start gap-14">
        {waffle(true)}
        {ranking(true)}
      </div>
    </div>
  );

  // What changed: the facts and a bar per category; a category new this year has a note instead of a bar.
  const changed = change.none ? null : (() => {
    const { previousYear, rows: all, total, totalPct, topUp, topDown, upShare } = change;
    const barRows = all.filter((row): row is (typeof all)[number] & { delta: number } => row.delta !== null);
    const low = Math.min(0, ...barRows.map((row) => row.delta));
    const high = Math.max(0, ...barRows.map((row) => row.delta));
    const span = high - low || 1;
    const at = (delta: number) => ((delta - low) / span) * 98 + 1;
    const zeroAt = at(0);
    const bars: ChangeBar[] = barRows.map((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      amount: money(row.delta, true),
      pct: row.pct === null ? "" : formatShare(row.pct, true),
      left: Math.min(zeroAt, at(row.delta)),
      width: row.delta === 0 ? 0 : Math.max(0.5, Math.abs(at(row.delta) - zeroAt)),
    }));
    const up = all.find((row) => row.id === topUp);
    const down = all.find((row) => row.id === topDown);
    const facts = [
      { key: "yearReview.totalChg", name: money(total, true), detail: formatShare(totalPct, true) },
      ...(up && up.delta !== null
        ? [{
            key: "yearReview.topUp",
            name: up.label,
            detail: [money(up.delta, true), ...(upShare === null ? [] : [text("yearReview.ofTotalUp", { p: formatShare(upShare, false, 0) })])].join(" · "),
          }]
        : []),
      ...(down && down.delta !== null
        ? [{ key: "yearReview.topDown", name: down.label, detail: [money(down.delta, true), ...(down.pct === null ? [] : [formatShare(down.pct, true)])].join(" · ") }]
        : []),
    ];
    const notes = all.filter((row) => row.delta === null).map((row) => text("yearReview.newCat", { name: row.label, y: previousYear }));
    const heading = text("yearReview.s2", { y: previousYear });
    const ariaLabel = text("yearReview.chgAria", { a: year, b: previousYear });
    const chart = (still: boolean) => (
      <ChangeBars rows={bars} zero={zeroAt} focus={still ? null : picked} ariaLabel={ariaLabel} {...(still ? {} : { onFocus, onPin })} />
    );
    const basisLine = change.basis === "planVsActual" ? text("yearReview.planVsActual", { a: year, b: previousYear }) : text("yearReview.actual");
    return { previousYear, heading, facts, notes, chart, basis: change.basis, basisLine };
  })();

  // What the money buys: general government by economic type, in its nearest year.
  const { total: buysTotal, tiles } = buys.value;
  const typeYears = data.spendingTypes.years;
  const typeBefore = typeYears[typeYears.indexOf(buys.year) - 1];
  // A tile's name and figures are white on its fill, so a type whose colour is too light for them is drawn darker.
  const buysTiles: BuysTile[] = tiles.map((tile, position) => ({
    ...tile,
    color: fillUnderWhiteText(tile.color),
    tall: tall[position]!,
    amount: `${shortAmount(tile.value, messages)} · ${formatShare(tile.share)}`,
    change: tile.change === null || typeBefore === undefined ? null : text("yearReview.tmChg", { p: formatShare(tile.change, true), y: typeBefore }),
  }));
  const buysFocus = focus !== null && tiles.some((tile) => tile.id === focus) ? focus : null;
  const buysAria = text("yearReview.tmAria", { y: buys.year, items: tiles.map((tile) => `${tile.label} ${shortAmount(tile.value, messages)}`).join(", ") });
  const buysHeading = text("yearReview.tmH");
  const treemap = (still: boolean) => (
    <BuysTreemap tiles={buysTiles} focus={still ? null : buysFocus} ariaLabel={buysAria} {...(still ? {} : { onFocus })} />
  );

  return (
    <Section
      number="03"
      id="year-review-where"
      heading={text("yearReview.h04")}
      meta={meta}
      controls={
        <SegmentedTabs<Grouping>
          ariaLabel={text("yearReview.groupLabel")}
          value={grouping}
          onChange={onGrouping}
          options={[
            { value: "fields", label: text("yearReview.fn") },
            { value: "institutions", label: text("yearReview.adm") },
          ]}
        />
      }
    >
      <p id={PIN_HINT_ID} className="sr-only">{text("yearReview.pinHint")}</p>

      <div data-panel="hundred">
        <h3 className={`${H3} mt-7`}>
          {hundredHeading} <span className={H3_META}>{count}</span>
        </h3>
        <div className="mt-7 grid grid-cols-1 items-start gap-8 @min-[640px]:grid-cols-[minmax(0,300px)_minmax(0,1fr)] @min-[960px]:grid-cols-[minmax(0,384px)_minmax(0,1fr)] @min-[960px]:gap-14">
          <figure className="m-0 min-w-0">
            {waffle(false)}
            <figcaption className={`${FOOT_NOTE} mt-3`}>{note}</figcaption>
            <div className="mt-[30px] grid grid-cols-[120px_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border-t border-[var(--hairline)] pt-3.5 @min-[960px]:grid-cols-[150px_minmax(0,1fr)]">
              <p className="col-span-full font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{text("yearReview.thenK", { y: where.thenYear })}</p>
              <WaffleGrid cells={where.thenCells} colorOf={colorOf} focus={picked} then onFocus={onFocus} onPin={onPin} />
              {compared === null ? null : (
                <div data-then={compared}>
                  <p className="flex items-start gap-2 text-[13.5px] font-semibold leading-[1.35]">
                    <i className="mt-[5px] block size-2.5 flex-none rounded-[2px]" style={{ backgroundColor: colorOf(compared) }} />
                    <span>{byId.get(compared)!.label}</span>
                  </p>
                  <p className="mt-2 flex items-baseline gap-2.5 font-[family-name:var(--font-display)] font-semibold leading-none">
                    {lariOf(cellsIn(early, compared))}
                    <span aria-hidden="true" className="font-[family-name:var(--font-ui)] text-lg text-[var(--control)]">→</span>
                    {lariOf(cellsIn(late, compared))}
                  </p>
                  <p className="mt-1.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{`${early} → ${late}`}</p>
                </div>
              )}
            </div>
          </figure>
          <div className="min-w-0">
            {ranking(false)}
            <ChartFoot
              share={
                <ChartShareButton
                  title={hundredHeading}
                  caption={`${text("yearReview.cellNote")} · ${year}${where.planned ? ` · ${text("yearReview.plan")}` : ""}`}
                  source={text("main.sourceData")}
                  chart={hundredPicture}
                  period={String(year)}
                />
              }
            />
          </div>
        </div>
      </div>

      <div data-panel="change">
        {changed === null ? (
          <>
            <h3 className={`${H3} mt-10 min-[768px]:mt-[52px]`}>{text("yearReview.s2Gen")}</h3>
            <p className="mt-6 bg-[var(--tint)] px-5 py-[18px] text-sm leading-[1.55] text-[var(--body)]">{text("yearReview.s2None", { y: year })}</p>
          </>
        ) : (
          <>
            <h3 className={`${H3} mt-10 min-[768px]:mt-[52px]`}>
              {changed.heading}{" "}
              <span className={H3_META}>
                {changed.basisLine}
              </span>
            </h3>
            <dl className="mt-[22px] grid grid-cols-1 gap-x-8 gap-y-4 @min-[640px]:grid-cols-3">
              {changed.facts.map((fact) => (
                <div key={fact.key} className="border-t border-[var(--hairline)] pt-2.5">
                  <dt className="font-[family-name:var(--font-numeric)] text-[11px] leading-[1.4] text-[var(--muted)]">{text(fact.key)}</dt>
                  <dd className="m-0">
                    <b className="mt-1.5 block text-[15px] font-semibold leading-[1.35]">{withLari(fact.name)}</b>
                    <span className="mt-[3px] block font-[family-name:var(--font-numeric)] text-[12.5px] text-[var(--body)]">{withLari(fact.detail)}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {changed.chart(false)}
            <ChartFoot
              share={
                <ChartShareButton
                  title={changed.heading}
                  caption={`${lari} · ${changed.previousYear}–${year}${changed.basis === "planVsActual" ? ` · ${changed.basisLine}` : ""}`}
                  source={text("main.sourceData")}
                  chart={<div className="@container">{changed.chart(true)}</div>}
                  period={`${changed.previousYear}-${year}`}
                />
              }
            >
              {changed.notes.map((line) => <p key={line} className={FOOT_NOTE}>{line}</p>)}
            </ChartFoot>
          </>
        )}
      </div>

      <div data-panel="buys">
        <h3 className={`${H3} mt-10 min-[768px]:mt-[52px]`}>
          {buysHeading}{" "}
          <span className={`${H3_META} inline-flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>{text("yearReview.tmM", { y: buys.year, v: shortAmount(buysTotal, messages) })}</span>
            {buys.fallback ? <YearTag year={buys.year} /> : null}
          </span>
        </h3>
        {treemap(false)}
        <ChartFoot
          share={
            <ChartShareButton
              title={buysHeading}
              caption={`${text("yearReview.bn")} · ${buys.year}`}
              source={data.sources.spendingTypes}
              chart={<div className="@container">{treemap(true)}</div>}
              period={String(buys.year)}
            />
          }
        >
          <p className={FOOT_NOTE}>{text("yearReview.tmNote")}</p>
        </ChartFoot>
      </div>
    </Section>
  );
}
