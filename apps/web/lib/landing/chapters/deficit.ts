import type { ServedGeneralGovernmentBalanceFact } from "../../servedRows";
import type { DeficitChapter } from "./types";

// Chapter 05: the general-government balance as a percentage of GDP, with the
// annotations the chart marks. Annotations read actual years only, so a
// projection never becomes the deepest deficit or part of a surplus run. A
// balance of zero or more is a surplus here, as in the chart and its tooltip.

const EARLIER_GAP_YEARS = 5;

export function buildDeficitChapter(facts: ServedGeneralGovernmentBalanceFact[]): DeficitChapter {
  const sorted = [...facts].sort((a, b) => a.year - b.year);
  const actual = sorted.filter((fact) => fact.status === "actual");
  if (actual.length === 0) throw new Error("Deficit chapter needs at least one actual general-government balance year");

  const point = (fact: ServedGeneralGovernmentBalanceFact) => ({ year: fact.year, pct: fact.generalGovernmentBalancePctGdp });
  const mostNegative = (candidates: ServedGeneralGovernmentBalanceFact[]) =>
    candidates.reduce((lowest, fact) =>
      fact.generalGovernmentBalancePctGdp < lowest.generalGovernmentBalancePctGdp ? fact : lowest,
    );

  const deepestFact = mostNegative(actual);
  const earlierCandidates = actual.filter((fact) => fact.year <= deepestFact.year - EARLIER_GAP_YEARS);

  let surplusRun: DeficitChapter["surplusRun"] = null;
  let runStart: number | null = null;
  let previousYear: number | null = null;
  for (const fact of actual) {
    if (fact.generalGovernmentBalancePctGdp >= 0) {
      if (runStart === null || previousYear === null || fact.year !== previousYear + 1) runStart = fact.year;
      previousYear = fact.year;
      if (surplusRun === null || fact.year - runStart > surplusRun.last - surplusRun.first) {
        surplusRun = { first: runStart, last: fact.year };
      }
    } else {
      runStart = null;
      previousYear = null;
    }
  }

  return {
    years: sorted.map((fact) => fact.year),
    pctGdp: sorted.map((fact) => fact.generalGovernmentBalancePctGdp),
    gel: sorted.map((fact) => fact.generalGovernmentBalanceGel),
    projectionFrom: sorted.find((fact) => fact.status === "projection")?.year ?? null,
    latestActual: point(actual.at(-1)!),
    deepest: point(deepestFact),
    earlier: earlierCandidates.length === 0 ? null : point(mostNegative(earlierCandidates)),
    surplusRun,
  };
}
