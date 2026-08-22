"use client";

import { useEffect, useMemo } from "react";
import type { AdminSpendingCategory } from "../../lib/data/adminSpending/types";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { SourceDocumentRow } from "../../lib/data/sources";
import type {
  ServedAdminFact,
  ServedBudgetFact,
  ServedNationalGdpFact,
} from "../../lib/servedRows";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import { buildExplorerModel, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import type { ExplorerNav, ExplorerScope } from "../../lib/explorer/types";
import {
  buildWorkbookExportModel,
  type WorkbookExportInput,
  type WorkbookPublicSource,
  type WorkbookSeries,
} from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { AnalysisView } from "../analysis/analysis-view";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { PageHeader } from "../shell/page-header";
import { SeoIntroduction } from "../seo/seo-introduction";
import { analysisIntroduction, expenditureIntroduction, revenueIntroduction } from "../../lib/seo/content";
import { ExplorerView } from "./explorer-view";
import { useExplorerState } from "./use-explorer-state";

type MainExplorerProps = {
  nav: ExplorerNav;
  facts: ServedBudgetFact[];
  // Optional because the ministries scope is unreachable on the revenue route:
  // scopeFor() returns "revenue" before it consults grouping (urlState.ts), so
  // not even a #g=ministries deep link can switch. Omitting them there keeps the
  // whole admin corpus out of that route's RSC payload.
  adminFacts?: ServedAdminFact[];
  adminCategories?: AdminSpendingCategory[];
  glossaryEntries: GlossaryEntry[];
  sourceDocuments: SourceDocumentRow[];
  gdpFacts?: ServedNationalGdpFact[];
  workbookSources?: WorkbookPublicSource[];
  adminWorkbookSources?: WorkbookPublicSource[];
  gdpWorkbookSources?: WorkbookPublicSource[];
  siteOrigin?: string;
  lastUpdatedAt: string;
};

export function MainExplorer({ nav, facts, adminFacts = [], adminCategories = [], glossaryEntries, sourceDocuments, gdpFacts = [], workbookSources = [], adminWorkbookSources = [], gdpWorkbookSources = [], siteOrigin, lastUpdatedAt }: MainExplorerProps) {
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
    expandedMinistries,
    toggleMinistryExpanded,
    toggleSeries,
    setSelectedSeries,
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
        gdpFacts,
        adminFacts,
        adminCategories: adminCategoryMap,
        expenditureGrouping: grouping,
        glossary,
        sourceDocuments,
        side: explorerSide,
        selectedItemIds: selectedIds,
        startYear: range.start,
        endYear: range.end,
        measure: share ? "share_of_gdp" : "nominal",
      }),
    [facts, gdpFacts, adminFacts, adminCategoryMap, grouping, glossary, sourceDocuments, explorerSide, selectedIds, range.start, range.end, share],
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

  const isAnalysis = nav === "analysis";
  // Only the analysis route renders this, and nav is a prop fixed by the route,
  // so the other two sections were building and discarding a full snapshot model
  // on every mount. Null off-route; every read below narrows on the model itself.
  const analysisModel = useMemo(
    () =>
      isAnalysis
        ? buildSingleYearSnapshotModel({
            facts,
            adminFacts,
            adminCategories: adminCategoryMap,
            grouping: analysisGrouping,
            glossary,
            sourceDocuments,
            side: analysisSide,
            year: analysisYear ?? analysisYears.at(-1) ?? 0,
          })
        : null,
    [isAnalysis, facts, adminFacts, adminCategoryMap, analysisGrouping, glossary, sourceDocuments, analysisSide, analysisYear, analysisYears],
  );

  const deck = useMemo(() => {
    if (analysisModel) {
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
  }, [totalsByScope, scope, scopeYears, analysisSide, analysisGrouping, analysisModel]);

  const screenTitle = analysisModel
    ? `${analysisModel.year} წლის ბიუჯეტის სურათი — ${analysisSide === "expenditure" ? "სად მიდის საჯარო ფული" : "საიდან მოდის საჯარო ფული"}`
    : nav === "expenditure"
      ? "როგორ იხარჯება საქართველოს ბიუჯეტი"
      : "როგორ ივსება საქართველოს ბიუჯეტი";
  const sectionLabel = isAnalysis ? "ანალიზი" : nav === "revenue" ? "შემოსავლები" : "ხარჯები";
  const coverageYears = isAnalysis ? analysisYears : scopeYears;
  const coverage = [
    coverageYears.length > 0 ? `${coverageYears[0]}–${coverageYears.at(-1)}` : "",
    lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const seoIntroduction = isAnalysis
    ? analysisIntroduction(analysisYears.at(-1) ?? 0)
    : nav === "revenue"
      ? revenueIntroduction({ firstYear: coverageYears[0]!, lastYear: coverageYears.at(-1)! })
      : expenditureIntroduction({ firstYear: coverageYears[0]!, lastYear: coverageYears.at(-1)! });

  function buildWorkbookInput(): WorkbookExportInput {
    const labelById = new Map(model.items.map((item) => [item.id, item.kaLabel]));
    const series = model.tableRows.map<WorkbookSeries>((row) => {
      const pointsByYear: WorkbookSeries["pointsByYear"] = {};
      for (const year of model.years) {
        const amountGel = row.valuesByYear[year];
        const basis = row.basisByYear[year];
        pointsByYear[year] = amountGel === null || amountGel === undefined || basis === undefined
          ? null
          : {
              amountGel,
              measureValue: share ? row.shareByYear?.[year] : undefined,
              basis,
            };
      }

      return {
        id: row.itemId,
        kind: row.itemId === model.totalRow?.itemId ? "total" : row.level === "admin_category" ? "group" : "item",
        parentLabelKa: row.parentItemId ? labelById.get(row.parentItemId) ?? null : null,
        labelKa: row.kaLabel,
        pointsByYear,
      };
    });

    const groupLabelKa = scope === "revenue" ? "შემოსავლები" : scope === "ministries" ? "უწყებები" : "ხარჯები";
    return {
      filenameBase: scope,
      titleKa: screenTitle,
      groupLabelKa,
      years: model.years,
      measure: share
        ? { kind: "percentage", unitLabelKa: "% მშპ-ში", analysisHeaderKa: "მშპ-ის წილი (%)" }
        : { kind: "amount", unitLabelKa: "მილიონი ₾", readableScale: 1_000_000 },
      totalId: model.totalRow?.itemId ?? null,
      series,
      sources: share
        ? [...(scope === "ministries" ? adminWorkbookSources : workbookSources), ...gdpWorkbookSources]
        : scope === "ministries" ? adminWorkbookSources : workbookSources,
      siteOrigin: siteOrigin ?? window.location.origin,
    };
  }

  return (
    <main
      data-testid="explorer-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px] min-[768px]:pb-16"
    >
      {/* The workspace measures THIS column, not the viewport (DESIGN.md §12):
          the shell sidebar takes 232px off the viewport, so a viewport query
          would keep the two-column layout past the width the chart can fit. */}
      <div className="@container mx-auto max-w-[1180px]">
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

        <SeoIntroduction
          text={seoIntroduction}
          methodologyHref={nav === "revenue" ? "/methodology/revenue" : "/methodology/expenditure"}
        />

        {analysisModel ? (
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
                onDownload={() => downloadWorkbook(buildWorkbookExportModel(buildWorkbookInput()))}
              />
            }
          />
        )}
      </div>
    </main>
  );
}
