import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useId } from "react";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import type { RegionSpread } from "../../lib/explorer/regionSpread";
import { getCommonMessages } from "../../lib/i18n/common.server";
import { getGroupsMessages } from "../../lib/i18n/groups.server";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";
import { BarsGraphic, LeadGraphic, LineGraphic, MapGraphic, PairGraphic, SpreadGraphic } from "./card-graphics";

// The explorer group pages' card (spec 2026-10-24-explorer-regroup §5, prototype `dx-card`): index and arrow, title, a graphic, the latest
// value with its caption and period, and the years covered. A topic's first card is its lead: wider, with a larger area chart and the
// page's description.

export type LeadSpan = "lead3" | "lead2" | "lead2x2";

/** A topic's lead card spans the row, two columns, or two columns by two rows, whichever leaves the grid of three full. */
export function leadSpan(pageCount: number): LeadSpan {
  const rest = (pageCount - 1) % 3;
  return rest === 1 ? "lead2" : rest === 2 ? "lead2x2" : "lead3";
}

/** The grid a topic's cards sit in: three columns from 1101px, two from 768px, one on phones. */
export const CARD_GRID_CLASS = "grid grid-cols-1 gap-3 min-[768px]:grid-cols-2 min-[768px]:gap-4 min-[1101px]:grid-cols-3";

const NUMERIC = "font-[family-name:var(--font-numeric)]";

// Cells per lead span: always the whole row below 1101px (two columns and phones), and at 1101px the lead3 and lead2 cards become
// two columns of their own, text left and chart right.
const SPAN_CLASS: Record<LeadSpan, string> = {
  lead3: "col-span-full min-[1101px]:grid min-[1101px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[1101px]:grid-rows-[auto_auto_1fr_auto_auto] min-[1101px]:gap-x-8 min-[1101px]:gap-y-2",
  lead2: "col-span-full min-[1101px]:col-span-2 min-[1101px]:grid min-[1101px]:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] min-[1101px]:grid-rows-[auto_auto_1fr_auto_auto] min-[1101px]:gap-x-8 min-[1101px]:gap-y-2",
  lead2x2: "col-span-full min-[1101px]:col-span-2 min-[1101px]:row-span-2",
};

const LEAD_BAND: Record<LeadSpan, string> = {
  lead3: "mb-6 h-[150px] max-[767px]:h-[130px] min-[1101px]:col-start-2 min-[1101px]:row-[1/span_5] min-[1101px]:mt-1 min-[1101px]:mb-[22px] min-[1101px]:h-auto min-[1101px]:min-h-[160px] min-[1101px]:self-stretch",
  lead2: "mb-6 h-[150px] max-[767px]:h-[130px] min-[1101px]:col-start-2 min-[1101px]:row-[1/span_5] min-[1101px]:mt-1 min-[1101px]:mb-[22px] min-[1101px]:h-auto min-[1101px]:min-h-[160px] min-[1101px]:self-stretch",
  lead2x2: "mb-6 h-[220px] max-[767px]:h-[150px]",
};

// A split lead card's text column, one child per row, so a missing description or value leaves its row empty instead of shifting the rest up.
const ROW = {
  top: "min-[1101px]:row-start-1",
  title: "min-[1101px]:row-start-2",
  description: "min-[1101px]:row-start-3",
  value: "min-[1101px]:row-start-4",
  footer: "min-[1101px]:row-start-5",
} as const;

type CardProps = {
  card: HubCardModel;
  locale: Locale;
  /** Set on a topic's first card. */
  lead?: LeadSpan;
  /** The Regions page's region values, when the page has them. */
  spread?: RegionSpread | null;
  /** How many regions the "Map and list" text states. */
  regionCount: number;
};

function Band({ card, locale, lead, spread, regionCount }: CardProps) {
  const { graphic, series, seriesColor } = card;
  const onRegionsPage = card.href?.endsWith("/regions") ?? false;
  const flows = graphic?.kind === "pair";
  const size = lead ? LEAD_BAND[lead] : "h-[58px]";
  const band = ["relative mt-auto", flows ? "flex h-auto min-h-[58px] flex-col justify-end" : `block ${size}`, lead && flows ? "mb-6" : ""].filter(Boolean).join(" ");

  return (
    <span aria-hidden data-testid="explorer-card-graphic" className={band}>
      {graphic?.kind === "bars" ? <BarsGraphic graphic={graphic} /> : null}
      {graphic?.kind === "pair" ? <PairGraphic graphic={graphic} /> : null}
      {!graphic && spread ? <SpreadGraphic spread={spread} /> : null}
      {!graphic && !spread && series && seriesColor ? (
        lead ? (
          <LeadGraphic series={series} color={seriesColor} endLabel={card.latest?.value ?? null} years={card.years} />
        ) : (
          <LineGraphic series={series} color={seriesColor} />
        )
      ) : null}
      {!graphic && !spread && !(series && seriesColor) && onRegionsPage ? (
        <MapGraphic text={message(getGroupsMessages(locale), "groups.mapAndList", { n: regionCount })} />
      ) : null}
    </span>
  );
}

export function ExplorerCard(props: CardProps) {
  const { card, locale, lead, spread } = props;
  const groups = getGroupsMessages(locale);
  const base = useId();
  const ids = { title: `${base}-title`, value: `${base}-value`, detail: `${base}-detail`, footer: `${base}-footer` };

  // A spread states the Regions page's range, in place of the one latest figure.
  const caption = spread ? spread.caption : [card.latest?.caption, card.latest?.period].filter(Boolean).join(" · ");
  const value = spread ? spread.value : card.latest?.value;
  const footer = card.years ? (card.latest?.period ? card.years : `${card.years} · ${message(groups, "groups.annual")}`) : null;
  // What only the decorative band shows, for assistive technology: the pair's rows, the bars' first and last band, the spread's extremes.
  const detail = card.graphic?.kind === "pair" ? card.graphic.rows.map((row) => `${row.label} ${row.text}`).join(", ")
    : card.graphic?.kind === "bars" ? [card.graphic.first, card.graphic.last].join(", ")
    : !card.graphic && spread ? [spread.low, spread.high].join(", ")
    : null;
  const described = [value ? ids.value : null, detail ? ids.detail : null, footer ? ids.footer : null].filter(Boolean).join(" ");
  const split = lead !== undefined && lead !== "lead2x2";
  const row = (name: keyof typeof ROW) => (split ? ` ${ROW[name]}` : "");

  const body = (
    <>
      <span className={`flex items-center justify-between ${NUMERIC} text-[11px]${row("top")}`}>
        <b aria-hidden className="font-medium text-[var(--accent)]">{card.index}</b>
        {card.comingSoon ? (
          <span className={`rounded-[2px] border border-[var(--control)] px-1.5 py-px ${NUMERIC} text-[10.5px] text-[var(--muted)] max-[767px]:text-[11px]`}>
            {message(getCommonMessages(locale), "common.comingSoon")}
          </span>
        ) : (
          <ArrowUpRight
            aria-hidden
            size={14}
            strokeWidth={1.75}
            className="text-[var(--faint)] transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent)] motion-reduce:transition-none"
          />
        )}
      </span>
      <h3
        id={ids.title}
        className={`block font-[family-name:var(--font-display)] ${lead ? "text-[21px]" : "text-[17px]"} leading-[1.32] font-semibold ${card.comingSoon ? "text-[var(--muted)]" : "text-[var(--ink)]"}${row("title")}`}
      >
        {card.title}
      </h3>
      {lead && card.description ? <span className={`block max-w-[560px] text-[12.5px] leading-normal text-[var(--muted)]${row("description")}`}>{card.description}</span> : null}
      <Band {...props} />
      {detail ? <span id={ids.detail} className="sr-only">{detail}</span> : null}
      {value ? (
        <span id={ids.value} className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5${row("value")}`}>
          <b className={`${NUMERIC} ${lead ? "text-[32px] max-[767px]:text-[26px]" : "text-[20px]"} leading-tight font-semibold tracking-[-0.015em] text-[var(--ink)]`}>{value}</b>
          {caption ? <span className="text-[11.5px] leading-snug text-[var(--muted)]">{caption}</span> : null}
          {spread?.georgiaLabel ? (
            <span className="text-[11.5px] leading-snug text-[var(--muted)] before:mr-1.5 before:inline-block before:h-2.5 before:border-l-[1.5px] before:border-dashed before:border-[var(--accent)] before:align-[-1px] before:content-['']">
              {spread.georgiaLabel}
            </span>
          ) : null}
        </span>
      ) : null}
      {footer ? (
        <span id={ids.footer} className={`block border-t border-[var(--row-border)] pt-[9px] ${NUMERIC} text-[10.5px] text-[var(--faint)] max-[767px]:text-[11px]${lead ? " mt-4" : ""}${row("footer")}`}>{footer}</span>
      ) : null}
    </>
  );

  // Every child but the chart band stays in the text column of a split lead card.
  const frame = [
    "group relative flex min-h-[216px] min-w-0 flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-4 pb-[13px] no-underline transition-colors duration-150 max-[767px]:min-h-0 motion-reduce:transition-none",
    lead ? SPAN_CLASS[lead] : "",
    lead && lead !== "lead2x2" ? "min-[1101px]:[&>*:not([data-testid=explorer-card-graphic])]:col-start-1" : "",
  ].filter(Boolean).join(" ");

  return card.href === null ? (
    <div data-testid="explorer-card" className={frame}>{body}</div>
  ) : (
    <Link
      href={pageHref(card.href, locale)}
      prefetch={false}
      data-testid="explorer-card"
      aria-labelledby={ids.title}
      aria-describedby={described || undefined}
      className={`${frame} hover:border-[var(--ink)]`}
    >
      {body}
    </Link>
  );
}
