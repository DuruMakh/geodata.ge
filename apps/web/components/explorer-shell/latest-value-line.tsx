import type { ReactNode } from "react";
import { withLari } from "../ui/lari";

/** The budget, debt and deficit deck under the title: latest value, then its change or note. */
export const DECK_LINE_CLASS = "mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]";

/**
 * "{measure} · {period}: {value}" under an explorer title (owner decision D2):
 * the sectors page's headline line, so a phone reader sees "what is it now?"
 * on the first screen. The full indicators block further down is unchanged.
 */
type LineParts = { measure: string; period: string | number; value: string; note?: string };
/** A whole translated sentence in place of the parts, for a page whose line is one template; it sets its figures with `LatestFigure`. */
type LineSentence = { sentence: ReactNode };

/** A figure in the line: the value of "{measure} · {period}: {value}", or each figure of a `sentence`. */
export function LatestFigure({ value }: { value: string }) {
  return <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--ink)]">{withLari(value)}</span>;
}

function LineText(line: LineParts | LineSentence) {
  if ("sentence" in line) return <>{line.sentence}</>;
  const { measure, period, value, note } = line;
  return (
    <>
      {measure} · {period}:{" "}
      <LatestFigure value={value} />
      {note ? ` · ${note}` : ""}
    </>
  );
}

/**
 * `reserve`, optional: a line the block keeps room for, stacked invisibly in the same grid cell, so a page whose
 * line changes with a control (the sectors measures) keeps one height and never moves what follows. Without it the
 * output is the plain paragraph.
 */
export function LatestValueLine({ testId, reserve, ...line }: (LineParts | LineSentence) & { testId: string; reserve?: LineParts }) {
  if (!reserve) {
    return (
      <p data-testid={testId} className="mb-2 text-[0.8125rem] text-[var(--body)]">
        <LineText {...line} />
      </p>
    );
  }
  return (
    <div className="mb-2 grid text-[0.8125rem] text-[var(--body)]">
      <p data-testid={testId} className="self-start [grid-area:1/1]">
        <LineText {...line} />
      </p>
      <p aria-hidden="true" className="invisible [grid-area:1/1]">
        <LineText {...reserve} />
      </p>
    </div>
  );
}
