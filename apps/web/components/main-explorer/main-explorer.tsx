"use client";

import { coverageLabel } from "../../lib/explorer/coverageLabel";
import { useMemo } from "react";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import type { Presentation } from "../../lib/i18n/types";
import type { AdminSpendingCategory } from "../../lib/data/adminSpending/types";
import type { PublicGlossaryEntry } from "../../lib/data/glossary";
import type {
  ClientAdminFact,
  ClientBudgetFact,
  ClientNationalGdpFact,
} from "../../lib/explorer/clientData";
import { unpackFacts, type FactsInput } from "../../lib/data/packedFacts";
import { buildExplorerModel } from "../../lib/explorer/explorerData";
import { buildBudgetWorkbookInput } from "../../lib/explorer/budgetWorkbook";
import { formatAmount, unitFor, unitsFor } from "../../lib/explorer/format";
import { useAppReady } from "../explorer-shell/use-app-ready";
import type { ExplorerSide } from "../../lib/explorer/types";
import { buildWorkbookExportModel, type WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { BudgetExplorerFrame, budgetTotalsByScope } from "./budget-explorer-frame";
import { ExplorerView } from "./explorer-view";
import { useExplorerState } from "./use-explorer-state";

type MainExplorerProps = {
  presentation: Presentation;
  /** The route: /explorer/analysis has its own client entry (AnalysisExplorer). */
  nav: ExplorerSide;
  facts: FactsInput<ClientBudgetFact>;
  // Optional because the ministries scope is unreachable on the revenue route:
  // scopeFor() returns "revenue" before it consults grouping (urlState.ts), so
  // not even a #g=ministries deep link can switch. Omitting them there keeps the
  // whole admin corpus out of that route's RSC payload.
  adminFacts?: FactsInput<ClientAdminFact>;
  adminCategories?: AdminSpendingCategory[];
  glossaryEntries: PublicGlossaryEntry[];
  gdpFacts?: ClientNationalGdpFact[];
  workbookSources?: WorkbookPublicSource[];
  adminWorkbookSources?: WorkbookPublicSource[];
  gdpWorkbookSources?: WorkbookPublicSource[];
  siteOrigin?: string;
  lastUpdatedAt: string;
};

export function MainExplorer(props: MainExplorerProps) {
  return <I18nProvider {...props.presentation}><MainExplorerContent {...props} /></I18nProvider>;
}

function MainExplorerContent({ nav, facts: shippedFacts, adminFacts: shippedAdminFacts = [], adminCategories = [], glossaryEntries, gdpFacts = [], workbookSources = [], adminWorkbookSources = [], gdpWorkbookSources = [], siteOrigin, lastUpdatedAt }: MainExplorerProps) {
  const facts = unpackFacts(shippedFacts), adminFacts = unpackFacts(shippedAdminFacts);
  // The provider adds the layout's namespaces to the page's: read them from it, not from the prop.
  const presentation = useI18n();
  const { locale, messages } = presentation;
  useAppReady();

  const glossary = useMemo(() => new Map(glossaryEntries.map((entry) => [entry.id, entry])), [glossaryEntries]);
  const adminCategoryMap = useMemo(() => new Map(adminCategories.map((category) => [category.id, category])), [adminCategories]);
  const state = useExplorerState({ facts, adminFacts, nav });
  const {
    explorerSide,
    scope,
    grouping,
    chartMode,
    share,
    setShare,
    scopeYears,
    range,
    setRange,
    selectedIds,
    expandedMinistries,
    toggleMinistryExpanded,
    toggleSeries,
    setSelectedSeries,
    handleGroupingChange,
    handleChartModeChange,
  } = state;

  const totalsByScope = useMemo(() => budgetTotalsByScope(facts, adminFacts), [facts, adminFacts]);

  // Decided once per scope from the whole corpus, not from the visible range or
  // the selection: the chart axis and every table cell share one unit, so the
  // precision has to hold still while the reader drags the range strip.
  //
  // Fields and revenue cap at one decimal: they are genuinely billions-scale, so
  // a second decimal lengthens every cell to resolve a handful of outliers, and
  // the smallest rows floor to "<0.1" instead — still legible as funded.
  //
  // Ministries keeps two. Its drill-down programs are billions-scale only in
  // name (most sit between 0.02 and 0.5), so one decimal collapses 45 of them
  // into 16 distinct values and floors 126 of 852 rows — a ranked table that
  // cannot rank. The two scopes never share a table, so the difference is never
  // visible side by side.
  const unit = useMemo(
    () =>
      scope === "ministries"
        ? unitFor(adminFacts.map((fact) => fact.amountGel), unitsFor(locale).bn, 2)
        : unitFor(
            facts.filter((fact) => fact.side === explorerSide).map((fact) => fact.amountGel),
            unitsFor(locale).bn,
            1,
          ),
    [facts, adminFacts, scope, explorerSide, locale],
  );

  const model = useMemo(() => buildExplorerModel({
    facts,
    gdpFacts,
    adminFacts,
    adminCategories: adminCategoryMap,
    expenditureGrouping: grouping,
    glossary,
    side: explorerSide,
    selectedItemIds: selectedIds,
    startYear: range.start,
    endYear: range.end,
    measure: share ? "share_of_gdp" : "nominal",
  }, presentation), [facts, gdpFacts, adminFacts, adminCategoryMap, grouping, glossary, explorerSide, selectedIds, range.start, range.end, share, presentation]);

  const deck = useMemo(() => {
    const totals = totalsByScope[scope];
    const latestYear = scopeYears.at(-1);
    const previousYear = scopeYears.at(-2);
    if (latestYear === undefined) return { lead: "", yoy: null };
    const latestTotal = totals.get(latestYear) ?? null;
    const previousTotal = previousYear === undefined ? null : totals.get(previousYear) ?? null;
    const yoy = latestTotal !== null && previousTotal ? (latestTotal - previousTotal) / previousTotal : null;

    return {
      lead: latestTotal === null ? "" : `${latestYear}: ${formatAmount(latestTotal, locale)}`,
      yoy,
    };
  }, [totalsByScope, scope, scopeYears, locale]);

  const screenTitle = nav === "expenditure"
    ? message(messages, "main.expenditureHeading")
    : message(messages, "main.revenueHeading");
  const sectionLabel = message(messages, nav === "revenue" ? "common.revenue" : "common.expenditure");
  const coverage = coverageLabel(messages, locale, scopeYears[0], scopeYears.at(-1), lastUpdatedAt || undefined);

  return (
    <BudgetExplorerFrame locale={locale} messages={messages} sectionLabel={sectionLabel} coverage={coverage} title={screenTitle} deck={deck}>
      <ExplorerView
        model={model}
        scope={scope}
        unit={unit}
        showGrouping={nav === "expenditure"}
        grouping={grouping}
        chartMode={chartMode}
        share={share}
        range={range}
        scopeYears={scopeYears}
        selectedIds={selectedIds}
        expandedMinistries={expandedMinistries}
        lastUpdatedAt={lastUpdatedAt}
        onGroupingChange={handleGroupingChange}
        onChartModeChange={handleChartModeChange}
        onShareChange={setShare}
        onRangeChange={(patch) => setRange(scope, patch)}
        onSelectionChange={setSelectedSeries}
        onToggleSeries={toggleSeries}
        onToggleExpanded={toggleMinistryExpanded}
        downloadAction={
          <ExcelDownloadButton
            testId="series-excel"
            disabled={model.tableRows.length === 0}
            onDownload={() => downloadWorkbook(buildWorkbookExportModel(buildBudgetWorkbookInput({
              model,
              presentation,
              scope,
              share,
              title: screenTitle,
              sources: { budget: workbookSources, admin: adminWorkbookSources, gdp: gdpWorkbookSources },
              siteOrigin: siteOrigin ?? window.location.origin,
            })))}
          />
        }
      />
    </BudgetExplorerFrame>
  );
}
