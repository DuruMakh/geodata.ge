"use client";
import type { ReactNode } from "react";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";

/** The City air quality page: one card per city, each opening the city's page (DESIGN.md §6.6). The cards are the server-rendered hub cards. */
export function EnvironmentCityIndex({ latest, children }: { latest: { measure: string; year: number; value: string; note?: string }; children: ReactNode }) {
  const { messages } = useI18n();
  useAppReady();
  return <div data-testid="environment-air-quality" className="@container">
    <ExplorerHeading>{message(messages, "environment.page.air-quality.title")}</ExplorerHeading>
    <LatestValueLine testId="environment-latest" measure={latest.measure} period={latest.year} value={latest.value} note={latest.note} />
    {children}
  </div>;
}
