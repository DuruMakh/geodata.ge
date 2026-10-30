"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatAmount } from "../../lib/explorer/format";
import { parseExplorerHash, serializeAnalysisHash } from "../../lib/explorer/urlState";
import { message } from "../../lib/i18n/messages";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";
import type { YearReviewData } from "../../lib/yearReview/types";
import { spendTotals, type Grouping } from "../../lib/yearReview/yearView";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { Glance } from "./glance";
import { Section, type YearReviewSectionProps } from "./section";
import { YearRuler } from "./year-ruler";

type YearReviewPageProps = { data: YearReviewData; presentation: Presentation };

/** /explorer/analysis below its heading: the year ruler, then the six sections, all moved by the one chosen year. */
export function YearReviewPage({ data, presentation }: YearReviewPageProps) {
  return <I18nProvider {...presentation}><YearReviewContent data={data} /></I18nProvider>;
}

/** A section still to be built: its number and heading only. */
function PendingSection({ number, id, heading }: { number: string; id: string; heading: string }) {
  return <Section number={number} id={id} heading={heading} />;
}

function YearReviewContent({ data }: { data: YearReviewData }) {
  // The provider adds the layout's namespaces to the page's: read them from it, not from the prop.
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const { years, planned, defaultYear } = data.budget;

  const [year, setYear] = useState(defaultYear);
  const [grouping, setGrouping] = useState<Grouping>("fields");
  const [side, setSide] = useState<"expenditure" | "revenue">("expenditure");
  const [measure] = useState<"share" | "gel">("share");
  const [hover, setHover] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const hashAppliedRef = useRef(false);

  // Old Analysis links keep working: `ay` is the year, `ag` the grouping (ministries are the institutions), `as` the
  // long view's side. The hash is a one-time external input on load, so the one extra render is intended.
  useEffect(() => {
    if (hashAppliedRef.current) return;
    hashAppliedRef.current = true;
    const parsed = parseExplorerHash(window.location.hash, "analysis");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parsed.analysisYear !== undefined && years.includes(parsed.analysisYear)) setYear(parsed.analysisYear);
    if (parsed.analysisGrouping) setGrouping(parsed.analysisGrouping === "ministries" ? "institutions" : "fields");
    if (parsed.analysisSide) setSide(parsed.analysisSide);
  }, [years]);
  useReplaceHash(serializeAnalysisHash({ analysisSide: side, analysisGrouping: grouping === "institutions" ? "ministries" : "fields", analysisYear: year }));
  useAppReady();

  const spend = spendTotals(data);
  const pinned = pin === null ? null : [...data.budget.fields, ...data.budget.institutions, ...data.budget.receipts].find((category) => category.id === pin) ?? null;
  // The ruler names each year's state spending, or the picked category's amount when one is pinned.
  const series = pinned?.values ?? spend;
  const amountOf = (target: number) => series[years.indexOf(target)] ?? null;
  const yearLabel = (target: number) => {
    const amount = amountOf(target);
    const plan = planned[years.indexOf(target)] ? `, ${text("yearReview.plan")}` : "";
    return `${target}: ${amount === null ? text("yearReview.noData") : formatAmount(amount, locale)}${plan}`;
  };

  const sectionProps: YearReviewSectionProps = {
    data,
    year,
    grouping,
    side,
    measure,
    focus: hover ?? pin,
    onFocus: setHover,
    onPin: (id) => setPin((current) => (current === id ? null : id)),
  };

  return (
    <div data-testid="year-review" className="min-w-0">
      <div className="z-20 mt-5 border-b border-[var(--hairline)] bg-[var(--paper)] pt-2.5 pb-3 min-[768px]:sticky min-[768px]:top-0 min-[768px]:mt-[26px] min-[768px]:flex min-[768px]:items-center min-[768px]:gap-7">
        <YearRuler
          years={years}
          planned={planned}
          value={year}
          onChange={setYear}
          label={text("yearReview.tlAria", { what: pinned?.label ?? text("yearReview.heroExp") })}
          yearLabel={yearLabel}
          planLabel={text("yearReview.plan")}
        />
        {pinned ? (
          <button
            type="button"
            aria-label={`${text("yearReview.unpin")}: ${pinned.label}`}
            onClick={() => { setPin(null); setHover(null); }}
            className="group mt-1.5 inline-flex min-h-11 w-full items-center gap-2 border border-[var(--ink)] bg-[var(--tile)] pr-2 pl-3 text-[13px] font-semibold min-[768px]:mt-0 min-[768px]:min-h-10 min-[768px]:w-auto min-[768px]:max-w-[330px]"
          >
            <span aria-hidden="true" className="h-[3px] w-3.5 flex-none" style={{ backgroundColor: pinned.color }} />
            <span className="min-w-0 truncate">{pinned.label}</span>
            <X aria-hidden="true" size={16} className="ml-auto flex-none text-[var(--muted)] group-hover:text-[var(--ink)]" />
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {text("yearReview.said", { y: year, v: formatAmount(spend[years.indexOf(year)], locale) })}
      </p>

      <Glance {...sectionProps} />
      <PendingSection number="02" id="year-review-gives-up" heading={text("yearReview.h03")} />
      <PendingSection number="03" id="year-review-where" heading={text("yearReview.h04")} />
      <PendingSection number="04" id="year-review-debt" heading={text("yearReview.h05")} />
      <PendingSection number="05" id="year-review-country" heading={text("yearReview.h06")} />
      <PendingSection number="06" id="year-review-long" heading={`${text("yearReview.s3")}: ${years[0]}–${years.at(-1)}`} />
    </div>
  );
}
