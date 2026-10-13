"use client";

import type { ReactNode } from "react";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import type { ClientAdminFact, ClientBudgetFact } from "../../lib/explorer/clientData";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { formatShare } from "../../lib/explorer/format";
import type { ExplorerScope } from "../../lib/explorer/types";
import { message } from "../../lib/i18n/messages";
import type { Messages } from "../../lib/i18n/types";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { PageHeader } from "../shell/page-header";

// The budget explorer (expenditure, revenue) and the single-year analysis are
// separate client entries, so neither route ships the other's view; this is
// what the two share.

/** The years each scope offers. */
export function budgetYearsByScope(facts: ClientBudgetFact[], adminFacts: ClientAdminFact[]): Record<ExplorerScope, number[]> {
  const collect = (values: Iterable<number>) => Array.from(new Set(values)).sort((a, b) => a - b);

  return {
    // Chartable field/revenue years follow category-detail coverage. Derived
    // totals remain selectable, but total-only years are not offered.
    fields: collect(
      facts.filter((fact) => fact.side === "expenditure" && !isDerivedTotalItemId(fact.itemId)).map((fact) => fact.year),
    ),
    revenue: collect(
      facts.filter((fact) => fact.side === "revenue" && !isDerivedTotalItemId(fact.itemId)).map((fact) => fact.year),
    ),
    ministries: collect(adminFacts.map((fact) => fact.year)),
  };
}

/** Full-history totals per scope, for the deck line under the page title. */
export function budgetTotalsByScope(facts: ClientBudgetFact[], adminFacts: ClientAdminFact[]): Record<ExplorerScope, Map<number, number>> {
  const totals: Record<ExplorerScope, Map<number, number>> = {
    fields: new Map(),
    ministries: new Map(),
    revenue: new Map(),
  };

  for (const fact of chooseActivePublicFacts(facts)) {
    if (isDerivedTotalItemId(fact.itemId)) continue;
    const scopeKey: ExplorerScope = fact.side === "revenue" ? "revenue" : "fields";
    totals[scopeKey].set(fact.year, (totals[scopeKey].get(fact.year) ?? 0) + fact.amountGel);
  }
  for (const fact of adminFacts) {
    if (fact.level !== "admin_category") continue;
    totals.ministries.set(fact.year, (totals.ministries.get(fact.year) ?? 0) + fact.amountGel);
  }

  return totals;
}

/** The page header, title and deck line every budget route opens with. */
export function BudgetExplorerFrame({ messages, sectionLabel, coverage, title, deck, children }: {
  messages: Messages;
  sectionLabel: string;
  coverage: string;
  title: string;
  deck: { lead: string; yoy: number | null };
  children: ReactNode;
}) {
  return (
    <ExplorerPage testId="explorer-shell" repeatDesktopBottomPadding>
      <PageHeader
        crumbs={[
          { label: message(messages, "common.home"), href: "/" },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.budget"), href: "/explorer" },
          { label: sectionLabel },
        ]}
        coverage={coverage}
      />

      <ExplorerHeading>{title}</ExplorerHeading>

      <p className="mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]">
        <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">{deck.lead}</span>
        {deck.yoy !== null ? (
          <>
            <span
              className="font-[family-name:var(--font-numeric)] text-[13px]"
              style={{ color: deck.yoy < 0 ? NEGATIVE : POSITIVE }}
            >
              {formatShare(deck.yoy, true)}
            </span>
            <span>{message(messages, "main.previousYear")}</span>
          </>
        ) : null}
      </p>

      {children}
    </ExplorerPage>
  );
}
