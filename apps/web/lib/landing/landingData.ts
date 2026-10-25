import type { SourceDocumentRow } from "../data/sources";
import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedBudgetFact } from "../servedRows";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "../explorer/explorerData";
import { formatInUnit, UNIT_BN } from "../explorer/format";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";

// Shared page context for the homepage, Methodology and About, and the homepage's
// "Economic size" key figure; both come from the same served facts as the explorer.

export type LandingContext = {
  yearsLabel: string;
  updatedAt: string;
};

export function buildLandingContext({
  facts,
  sourceDocuments,
}: {
  facts: ServedBudgetFact[];
  sourceDocuments: SourceDocumentRow[];
}): LandingContext {
  const activeFacts = chooseActivePublicFacts(facts).filter((fact) => !isDerivedTotalItemId(fact.itemId));
  const revenueYears = Array.from(new Set(activeFacts.filter((fact) => fact.side === "revenue").map((fact) => fact.year))).sort(
    (left, right) => left - right,
  );
  const revMin = revenueYears.at(0) ?? 0;
  const revMax = revenueYears.at(-1) ?? 0;

  return {
    yearsLabel: revMin && revMax ? `${revMin}–${revMax}` : "",
    updatedAt: sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

export type LandingGdpFigure = { value: string; caption: string; mobileCaption: string };

/**
 * The landing's "Economic size" key figure: the latest nominal GDP in billion
 * GEL, with its year and preliminary status, read from the served facts, so it
 * follows the next GDP release without a maintained snapshot.
 */
export function landingGdpFigure(
  gdpFacts: readonly Pick<ServedGdpObservation, "seriesId" | "year" | "value" | "status">[],
  messages: Messages,
): LandingGdpFigure {
  const gdp = latestBy(gdpFacts.filter((fact) => fact.seriesId === "nominal_gel"), (fact) => fact.year);
  if (!gdp) throw new Error("Landing key figures need a served nominal GDP fact");
  return {
    value: formatInUnit(gdp.value, UNIT_BN),
    caption: message(messages, gdp.status === "preliminary" ? "landing.economyCaption" : "landing.economyCaptionFinal", { year: gdp.year }),
    mobileCaption: message(messages, "landing.economyMobile", { year: gdp.year }),
  };
}

function latestBy<T, K extends number | string>(rows: readonly T[], key: (row: T) => K): T | undefined {
  return rows.reduce<T | undefined>((latest, row) => (latest === undefined || key(row) > key(latest) ? row : latest), undefined);
}
