"use client";

import { useEffect, useMemo } from "react";
import type { AdminSpendingCategory, AdminSpendingFact } from "../../lib/data/adminSpending/types";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import { buildExplorerModel, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import type { ExplorerNav, ExplorerScope } from "../../lib/explorer/types";
import { AnalysisView } from "../analysis/analysis-view";
import { PageHeader } from "../shell/page-header";
import { ExplorerView } from "./explorer-view";
import { useExplorerState } from "./use-explorer-state";

type MainExplorerProps = {
  nav: ExplorerNav;
  facts: BudgetFactImportRow[];
  adminFacts: AdminSpendingFact[];
  adminCategories: AdminSpendingCategory[];
  glossaryEntries: GlossaryEntry[];
  sourceDocuments: SourceDocumentRow[];
  lastUpdatedAt: string;
};

export function MainExplorer({ nav, facts, adminFacts, adminCategories, glossaryEntries, sourceDocuments, lastUpdatedAt }: MainExplorerProps) {
  useEffect(() => {
    document.body.dataset.appReady = "true";

    return () => {
      delete document.body.dataset.appReady;
    };
  }, []);

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
    limitMessage,
    expandedMinistries,
    toggleMinistryExpanded,
    toggleSeries,
    handleGroupingChange,
    handleChartModeChange,
    analysisSide,
    setAnalysisSide,
    analysisGrouping,
    setAnalysisGrouping,
    analysisYears,
    analysisYear,
    setAnalysisYear,
  } = state;

  // Full-history totals per scope, for the deck line under the page title.
  const totalsByScope = useMemo(() => {
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
  }, [facts, adminFacts]);

  const model = useMemo(
    () =>
      buildExplorerModel({
        facts,
        adminFacts,
        adminCategories: adminCategoryMap,
        expenditureGrouping: grouping,
        glossary,
        sourceDocuments,
        side: explorerSide,
        selectedItemIds: selectedIds,
        startYear: range.start,
        endYear: range.end,
        measure: share ? "share_of_total" : "nominal",
      }),
    [facts, adminFacts, adminCategoryMap, grouping, glossary, sourceDocuments, explorerSide, selectedIds, range.start, range.end, share],
  );

  // Years whose ACTIVE values are planned (actual wins over planned), for the
  // analysis year selector's გეგმა tags. Admin facts are actual-only by contract,
  // so the ministries grouping never has planned years.
  const analysisPlannedYears = useMemo(() => {
    const planned = new Set<number>();
    if (analysisSide === "expenditure" && analysisGrouping === "ministries") return planned;
    for (const fact of chooseActivePublicFacts(facts)) {
      if (fact.side === analysisSide && fact.basis === "planned") planned.add(fact.year);
    }
    return planned;
  }, [facts, analysisSide, analysisGrouping]);

  const analysisModel = useMemo(
    () =>
      buildSingleYearSnapshotModel({
        facts,
        adminFacts,
        adminCategories: adminCategoryMap,
        grouping: analysisGrouping,
        glossary,
        sourceDocuments,
        side: analysisSide,
        year: analysisYear ?? analysisYears.at(-1) ?? 0,
      }),
    [facts, adminFacts, adminCategoryMap, analysisGrouping, glossary, sourceDocuments, analysisSide, analysisYear, analysisYears],
  );

  const isAnalysis = nav === "analysis";

  const deck = useMemo(() => {
    if (isAnalysis) {
      const totals = totalsByScope[analysisSide === "revenue" ? "revenue" : analysisGrouping === "ministries" ? "ministries" : "fields"];
      const year = analysisModel.year;
      const previousTotal = totals.get(year - 1) ?? null;
      const yoy = previousTotal ? (analysisModel.totalGel - previousTotal) / previousTotal : null;

      return {
        lead: `${year} · ${analysisModel.items.length} კატეგორია · სულ ${formatAmount(analysisModel.totalGel)}`,
        yoy,
      };
    }

    const totals = totalsByScope[scope];
    const latestYear = scopeYears.at(-1);
    const previousYear = scopeYears.at(-2);
    if (latestYear === undefined) return { lead: "", yoy: null };
    const latestTotal = totals.get(latestYear) ?? null;
    const previousTotal = previousYear === undefined ? null : totals.get(previousYear) ?? null;
    const yoy = latestTotal !== null && previousTotal ? (latestTotal - previousTotal) / previousTotal : null;

    return {
      lead: latestTotal === null ? "" : `${latestYear}: ${formatAmount(latestTotal)}`,
      yoy,
    };
  }, [isAnalysis, totalsByScope, scope, scopeYears, analysisSide, analysisGrouping, analysisModel]);

  const screenTitle = isAnalysis
    ? `${analysisModel.year} წლის ბიუჯეტის სურათი — ${analysisSide === "expenditure" ? "სად მიდის საჯარო ფული" : "საიდან მოდის საჯარო ფული"}`
    : nav === "expenditure"
      ? "როგორ იხარჯება საქართველოს ბიუჯეტი"
      : "როგორ ივსება საქართველოს ბიუჯეტი";
  const sectionLabel = isAnalysis ? "ანალიზი" : nav === "revenue" ? "შემოსავლები" : "ხარჯები";
  const coverageYears = isAnalysis ? analysisYears : scopeYears;
  const coverage = [
    coverageYears.length > 0 ? `${coverageYears[0]} — ${coverageYears.at(-1)}` : "",
    lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  function downloadCsv() {
    const csv = buildExplorerCsv(model.tableRows, model.years);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geodata-${scope}-${range.start}-${range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main
      data-testid="explorer-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px] min-[768px]:pb-16"
    >
      <div className="max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: sectionLabel },
          ]}
          coverage={coverage}
        />

        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {screenTitle}
        </h1>

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
              <span>წინა წელთან</span>
            </>
          ) : null}
        </p>

        {isAnalysis ? (
          <AnalysisView
            model={analysisModel}
            years={analysisYears}
            plannedYears={analysisPlannedYears}
            side={analysisSide}
            grouping={analysisGrouping}
            year={analysisYear}
            lastUpdatedAt={lastUpdatedAt}
            onSideChange={setAnalysisSide}
            onGroupingChange={setAnalysisGrouping}
            onYearChange={setAnalysisYear}
          />
        ) : (
          <ExplorerView
            model={model}
            scope={scope}
            showGrouping={nav === "expenditure"}
            grouping={grouping}
            chartMode={chartMode}
            share={share}
            range={range}
            scopeYears={scopeYears}
            selectedIds={selectedIds}
            limitMessage={limitMessage}
            expandedMinistries={expandedMinistries}
            lastUpdatedAt={lastUpdatedAt}
            onGroupingChange={handleGroupingChange}
            onChartModeChange={handleChartModeChange}
            onShareChange={setShare}
            onRangeChange={(patch) => setRange(scope, patch)}
            onToggleSeries={toggleSeries}
            onToggleExpanded={toggleMinistryExpanded}
            onDownloadCsv={downloadCsv}
          />
        )}
      </div>
    </main>
  );
}
