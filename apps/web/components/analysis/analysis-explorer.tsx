"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSpendingCategory } from "../../lib/data/adminSpending/types";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import type { PublicGlossaryEntry } from "../../lib/data/glossary";
import { unpackFacts, type FactsInput } from "../../lib/data/packedFacts";
import { coverageLabel } from "../../lib/explorer/coverageLabel";
import type { ClientAdminFact, ClientBudgetFact } from "../../lib/explorer/clientData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import type { ExpenditureGrouping, ExplorerSide } from "../../lib/explorer/types";
import { parseExplorerHash, scopeFor, serializeAnalysisHash } from "../../lib/explorer/urlState";
import { message } from "../../lib/i18n/messages";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { BudgetExplorerFrame, budgetTotalsByScope, budgetYearsByScope } from "../main-explorer/budget-explorer-frame";
import { AnalysisView } from "./analysis-view";

type AnalysisExplorerProps = {
  presentation: Presentation;
  facts: FactsInput<ClientBudgetFact>;
  adminFacts: FactsInput<ClientAdminFact>;
  adminCategories: AdminSpendingCategory[];
  glossaryEntries: PublicGlossaryEntry[];
  lastUpdatedAt: string;
};

/** /explorer/analysis: one year's budget, by side and grouping. */
export function AnalysisExplorer(props: AnalysisExplorerProps) {
  return <I18nProvider {...props.presentation}><AnalysisExplorerContent {...props} /></I18nProvider>;
}

function AnalysisExplorerContent({ facts: shippedFacts, adminFacts: shippedAdminFacts, adminCategories, glossaryEntries, lastUpdatedAt }: AnalysisExplorerProps) {
  const facts = unpackFacts(shippedFacts), adminFacts = unpackFacts(shippedAdminFacts);
  // The provider adds the layout's namespaces to the page's: read them from it, not from the prop.
  const presentation = useI18n();
  const { locale, messages } = presentation;
  useAppReady();

  const glossary = useMemo(() => new Map(glossaryEntries.map((entry) => [entry.id, entry])), [glossaryEntries]);
  const adminCategoryMap = useMemo(() => new Map(adminCategories.map((category) => [category.id, category])), [adminCategories]);
  const yearsByScope = useMemo(() => budgetYearsByScope(facts, adminFacts), [facts, adminFacts]);
  const totalsByScope = useMemo(() => budgetTotalsByScope(facts, adminFacts), [facts, adminFacts]);

  const [side, setSide] = useState<ExplorerSide>("expenditure");
  const [grouping, setGrouping] = useState<ExpenditureGrouping>("fields");
  const [chosenYear, setYear] = useState<number | null>(null);
  const hashAppliedRef = useRef(false);

  const years = yearsByScope[scopeFor(side, grouping)];
  const year = chosenYear !== null && years.includes(chosenYear) ? chosenYear : years.at(-1) ?? null;

  // Restore shareable state from the URL hash once, after mount (the server render
  // always shows defaults; unknown values are dropped by the parser).
  // The hash is a one-time external input on load, so the one extra render is intended.
  useEffect(() => {
    if (hashAppliedRef.current) return;
    hashAppliedRef.current = true;
    const parsed = parseExplorerHash(window.location.hash, "analysis");

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parsed.analysisSide) setSide(parsed.analysisSide);
    if (parsed.analysisGrouping) setGrouping(parsed.analysisGrouping);
    if (parsed.analysisYear !== undefined) setYear(parsed.analysisYear);
  }, []);

  useReplaceHash(serializeAnalysisHash({ analysisSide: side, analysisGrouping: grouping, analysisYear: year }));

  // Years whose ACTIVE values are planned (actual wins over planned), for the
  // year selector's გეგმა tags. The ministries grouping reads the admin facts,
  // which resolve actual over planned per year when they are loaded.
  const plannedYears = useMemo(() => {
    const planned = new Set<number>();
    if (side === "expenditure" && grouping === "ministries") {
      for (const fact of adminFacts) if (fact.basis === "planned") planned.add(fact.year);
      return planned;
    }
    for (const fact of chooseActivePublicFacts(facts)) {
      if (fact.side === side && fact.basis === "planned") planned.add(fact.year);
    }
    return planned;
  }, [facts, adminFacts, side, grouping]);

  const model = useMemo(
    () => buildSingleYearSnapshotModel({
      facts,
      adminFacts,
      adminCategories: adminCategoryMap,
      grouping,
      glossary,
      side,
      year: year ?? 0,
    }, presentation),
    [facts, adminFacts, adminCategoryMap, grouping, glossary, side, year, presentation],
  );

  const deck = useMemo(() => {
    const totals = totalsByScope[side === "revenue" ? "revenue" : grouping === "ministries" ? "ministries" : "fields"];
    const previousTotal = totals.get(model.year - 1) ?? null;
    const yoy = previousTotal ? (model.totalGel - previousTotal) / previousTotal : null;

    // Only the change on the year before: the year, category count and total are the first headline card,
    // directly below (U05-14).
    return { lead: "", yoy };
  }, [totalsByScope, side, grouping, model]);

  return (
    <BudgetExplorerFrame
      locale={locale}
      messages={messages}
      sectionLabel={message(messages, "common.analysis")}
      coverage={coverageLabel(messages, locale, years[0], years.at(-1), lastUpdatedAt || undefined)}
      title={message(messages, side === "expenditure" ? "analysis.expenditureHeading" : "analysis.revenueHeading", { year: model.year })}
      deck={deck}
    >
      <AnalysisView
        model={model}
        years={years}
        plannedYears={plannedYears}
        side={side}
        grouping={grouping}
        year={year}
        lastUpdatedAt={lastUpdatedAt}
        onSideChange={setSide}
        onGroupingChange={setGrouping}
        onYearChange={setYear}
      />
    </BudgetExplorerFrame>
  );
}
