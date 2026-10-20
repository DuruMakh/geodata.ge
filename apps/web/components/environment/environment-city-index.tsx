"use client";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { BudgetHub } from "../hub/budget-hub";

/** The City air quality page: one card per city, each opening the city's page (DESIGN.md §6.6). */
export function EnvironmentCityIndex({ cards, latest }: { cards: HubCardModel[]; latest: { measure: string; year: number; value: string; note?: string } }) {
  const { locale, messages } = useI18n();
  useAppReady();
  return <div data-testid="environment-air-quality" className="@container">
    <ExplorerHeading>{message(messages, "environment.page.air-quality.title")}</ExplorerHeading>
    <LatestValueLine testId="environment-latest" measure={latest.measure} period={latest.year} value={latest.value} note={latest.note} />
    <BudgetHub cards={cards} locale={locale} testId="environment-city-cards" />
  </div>;
}
