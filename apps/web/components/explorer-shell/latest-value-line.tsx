import { withLari } from "../ui/lari";

/**
 * "{measure} · {period}: {value}" under an explorer title (owner decision D2):
 * the sectors page's headline line, so a phone reader sees "what is it now?"
 * on the first screen. The full indicators block further down is unchanged.
 */
export function LatestValueLine({ testId, measure, period, value, note }: { testId: string; measure: string; period: string | number; value: string; note?: string }) {
  return (
    <p data-testid={testId} className="mb-2 text-[13px] text-[var(--body)]">
      {measure} · {period}:{" "}
      <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--ink)]">{withLari(value)}</span>
      {note ? ` · ${note}` : ""}
    </p>
  );
}
