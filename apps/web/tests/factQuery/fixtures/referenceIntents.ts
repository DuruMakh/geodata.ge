// apps/web/tests/factQuery/fixtures/referenceIntents.ts
//
// The spec section 14.3 reference fixture: 20 intents, each asked in Georgian
// and English, with expected values checked against the reviewed data rather
// than recorded from whatever the code returned.
//
// "Bilingual" is the language of the QUESTION, not of the data. Labels stay
// Georgian (section 10); a client answers in the asking language by translating
// them, and this fixture pins that it can do so without corrupting figures,
// scope or caveats.
//
// Running these calls tests arithmetic and evidence, not language
// understanding. The 40 prompts go through real AI clients separately
// (section 14.4); the production service makes no inference calls.
//
// Independently checked while authoring, by summing the reviewed rows in
// data/imports/budget-facts-2004-2025.csv rather than trusting the engine:
//   - 2025 spending.health   = 2,242,454,466 GEL (single reviewed row)
//   - 2025 revenue.vat       = 10,158,086,603 GEL (single reviewed row)
//   - 2004 revenue           = exactly TEN category rows summing to
//                              2,283,035,800 GEL, and NO increase_liabilities
//                              row exists at all (grep count 0)

export type ExpectedCell = {
  /** observationId: `${datasetId}:${entityId}:${seriesId}:${year}:${measure}` */
  id: string;
  /** null means the cell must come back MISSING - never 0, never estimated. */
  value: number | null;
  unit: "GEL" | "percent" | "GEL_per_resident";
};

export type ExpectedComparison = {
  id: string;
  from: number | null;
  to: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  percentagePointChange: number | null;
  comparability: "comparable" | "limited" | "not_comparable";
};

export type ExpectedRanking = {
  /** The ordered ids that must come back, top first. */
  orderedIds: string[];
  /** The unit those values carry - a change ranking is not in the measure's currency. */
  unit: "GEL" | "percent" | "GEL_per_resident";
  candidateCount: number;
  eligibleCount: number;
};

export type ReferenceIntent = {
  id: number;
  promptKa: string;
  promptEn: string;
  call: { tool: string; arguments: Record<string, unknown> };
  expectedStatus: "ok" | "partial" | "empty" | "error";
  expectedCells?: ExpectedCell[];
  expectedComparison?: ExpectedComparison;
  expectedRanking?: ExpectedRanking;
  /** Money is exact. Ratios carry a tolerance tight enough to catch a scaling or denominator mistake. */
  allowedRounding: number;
  expectedBudgetScope: string | null;
  requiredSourceIds: string[];
  requiredDocumentIds: string[];
  requiredCaveatCodes: string[];
  /** Entities that must be reported as excluded rather than returned as a row. */
  requiredExcludedEntityIds?: string[];
  /** True when the correct behaviour is to decline or qualify rather than compute. */
  mustDeclineOrQualify: boolean;
  note: string;
};

const EXACT = 0;
const RATIO_TOLERANCE = 1e-9;

export const REFERENCE_INTENTS: readonly ReferenceIntent[] = [
  {
    id: 1,
    promptKa: "რამდენი დაიხარჯა ჯანდაცვაზე სახელმწიფო ბიუჯეტიდან 2025 წელს?",
    promptEn: "How much did the state budget spend on health in 2025?",
    call: {
      tool: "query_national",
      arguments: { side: "expenditure", seriesIds: ["spending.health"], years: [2025], measure: "amount_gel" },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "national-expenditure:country.georgia:spending.health:2025:amount_gel", value: 2242454466, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "state_budget_expenditure",
    requiredSourceIds: ["source.mof_2025_expenditure_pdf_e11_plus_tavi6_supplement_actual"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "Correct series, correct scope, GEL, and a resolvable source. The baseline case.",
  },
  {
    id: 2,
    promptKa: "რამდენი შემოვიდა დღგ-დან 2025 წელს?",
    promptEn: "How much VAT was collected in 2025?",
    call: {
      tool: "query_national",
      arguments: { side: "revenue", seriesIds: ["revenue.vat"], years: [2025], measure: "amount_gel" },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "national-revenue:country.georgia:revenue.vat:2025:amount_gel", value: 10158086603, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    // Revenue is consolidated receipts, NOT the state-budget expenditure scope
    // of intent 1. Two different accounting boundaries in adjacent questions.
    expectedBudgetScope: "consolidated_budget_receipts",
    requiredSourceIds: ["source.mof_2025_revenue_form1_pdf"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "Correct revenue scope and category. Note the budgetScope differs from intent 1's.",
  },
  {
    id: 3,
    promptKa: "რამდენი იყო ჯამური შემოსავლები 2004 წელს?",
    promptEn: "What were total receipts in 2004?",
    call: {
      tool: "query_national",
      arguments: { side: "revenue", seriesIds: ["revenue.total"], years: [2004], measure: "amount_gel" },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "national-revenue:country.georgia:revenue.total:2004:amount_gel", value: 2283035800, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "consolidated_budget_receipts",
    requiredSourceIds: ["source.mof_2004_revenue_annual_execution_report"],
    requiredDocumentIds: [],
    // The 2004 total covers fewer components than later years, and it must say
    // so. Both are severe.
    requiredCaveatCodes: ["revenue_2004_total_scope", "budget_scopes_differ"],
    mustDeclineOrQualify: true,
    note: "Verified by summing the ten reviewed 2004 category rows by hand: 2,283,035,800 GEL exactly.",
  },
  {
    id: 4,
    promptKa: "რამდენი იყო ვალდებულებების ზრდა 2004 წელს?",
    promptEn: "What was the increase in liabilities in 2004?",
    call: {
      tool: "query_national",
      arguments: { side: "revenue", seriesIds: ["revenue.increase_liabilities"], years: [2004], measure: "amount_gel" },
    },
    expectedStatus: "empty",
    // MISSING, never zero. No such row exists in the reviewed data (verified:
    // grep count 0). Reporting 0 here would invent a fact.
    expectedCells: [
      { id: "national-revenue:country.georgia:revenue.increase_liabilities:2004:amount_gel", value: null, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "consolidated_budget_receipts",
    requiredSourceIds: [],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["revenue_2004_liabilities_unavailable"],
    mustDeclineOrQualify: true,
    note: "Missing, never zero. The severe caveat must reach the answer.",
  },
  {
    id: 5,
    promptKa: "როგორ შეიცვალა დღგ 2004-დან 2005 წლამდე?",
    promptEn: "How did VAT change between 2004 and 2005?",
    call: {
      tool: "compare",
      arguments: {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2004,
        toYear: 2005,
        measure: "amount_gel",
      },
    },
    expectedStatus: "ok",
    expectedComparison: {
      id: "national-revenue:country.georgia:revenue.vat:2004-2005:amount_gel",
      from: 628158100,
      to: 987431734,
      absoluteChange: 359273634,
      percentageChange: 57.194778511970156,
      percentagePointChange: null,
      comparability: "comparable",
    },
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.mof_2004_revenue_annual_execution_report", "source.mof_2005_revenue_form1_pdf"],
    requiredDocumentIds: [],
    // Only the nominal-price note. The 2004 TOTAL's scope limitation must NOT
    // be pinned onto an individual comparable tax category.
    requiredCaveatCodes: ["nominal_gel"],
    mustDeclineOrQualify: false,
    note: "Category-specific: comparable, with no blanket total-scope warning borrowed from intent 3.",
  },
  {
    id: 6,
    promptKa: "რამდენად გაიზარდა ჯამური შემოსავლები 2004-დან 2005 წლამდე?",
    promptEn: "How much did total receipts grow from 2004 to 2005?",
    call: {
      tool: "compare",
      arguments: {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.total"] },
        fromYear: 2004,
        toYear: 2005,
        measure: "amount_gel",
      },
    },
    expectedStatus: "partial",
    expectedComparison: {
      id: "national-revenue:country.georgia:revenue.total:2004-2005:amount_gel",
      from: 2283035800,
      to: 3289223828,
      // Both endpoint values are preserved, but NO growth is computed: the two
      // totals cover different components.
      absoluteChange: null,
      percentageChange: null,
      percentagePointChange: null,
      comparability: "not_comparable",
    },
    allowedRounding: EXACT,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.mof_2004_revenue_annual_execution_report", "source.mof_2005_revenue_form1_pdf"],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["revenue_2004_total_scope", "budget_scopes_differ", "nominal_gel"],
    mustDeclineOrQualify: true,
    note: "No like-for-like growth across changed total coverage. Both reviewed values still returned.",
  },
  {
    id: 7,
    promptKa: "როგორ შეიცვალა განათლების ხარჯი 2015-დან 2024 წლამდე?",
    promptEn: "How did education spending change between 2015 and 2024?",
    call: {
      tool: "compare",
      arguments: {
        target: { dataset: "national", side: "expenditure", seriesIds: ["spending.education"] },
        fromYear: 2015,
        toYear: 2024,
        measure: "amount_gel",
      },
    },
    expectedStatus: "ok",
    expectedComparison: {
      id: "national-expenditure:country.georgia:spending.education:2015-2024:amount_gel",
      from: 834932177,
      to: 2925471905,
      absoluteChange: 2090539728,
      percentageChange: 250.38437678992457,
      percentagePointChange: null,
      comparability: "comparable",
    },
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: null,
    requiredSourceIds: [
      "source.mof_2015_expenditure_functional_plus_programmatic_supplement_actual",
      "source.mof_2024_expenditure_pdf_e11_plus_tavi6_supplement_actual",
    ],
    requiredDocumentIds: [],
    // Fiscal.ge computes the change; the nominal-price caveat must ride with it
    // so nobody reads +250% as a real-terms increase.
    requiredCaveatCodes: ["nominal_gel"],
    mustDeclineOrQualify: false,
    note: "Fiscal.ge computes GEL and percentage change itself rather than leaving it to model arithmetic.",
  },
  {
    id: 8,
    promptKa: "რამდენი პროცენტია ჯანდაცვის ხარჯი მშპ-სთან 2025 წელს?",
    promptEn: "What share of GDP was health spending in 2025?",
    call: {
      tool: "query_national",
      arguments: { side: "expenditure", seriesIds: ["spending.health"], years: [2025], measure: "share_of_gdp_pct" },
    },
    expectedStatus: "ok",
    expectedCells: [
      {
        id: "national-expenditure:country.georgia:spending.health:2025:share_of_gdp_pct",
        value: 2.1438768639200902,
        unit: "percent",
      },
    ],
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: "state_budget_expenditure",
    // Both the budget source AND the GDP denominator source must be cited.
    requiredSourceIds: [
      "source.geostat_national_gdp_sna_2008",
      "source.mof_2025_expenditure_pdf_e11_plus_tavi6_supplement_actual",
    ],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["gdp_preliminary"],
    mustDeclineOrQualify: true,
    note: "Correct percentage scale, both sources, and the 2025 denominator flagged preliminary.",
  },
  {
    id: 9,
    promptKa: "როგორ შეიცვალა ჯანდაცვის წილი მშპ-ში 2009-დან 2010 წლამდე?",
    promptEn: "How did health spending as a share of GDP change from 2009 to 2010?",
    call: {
      tool: "compare",
      arguments: {
        target: { dataset: "national", side: "expenditure", seriesIds: ["spending.health"] },
        fromYear: 2009,
        toYear: 2010,
        measure: "share_of_gdp_pct",
      },
    },
    expectedStatus: "ok",
    expectedComparison: {
      id: "national-expenditure:country.georgia:spending.health:2009-2010:share_of_gdp_pct",
      from: 1.844223095741132,
      to: 1.8742078316108846,
      absoluteChange: null,
      percentageChange: null,
      // Percentage POINTS, not percent: the difference of two percentages.
      percentagePointChange: 0.029984735869752477,
      comparability: "limited",
    },
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.geostat_national_gdp_sna_1993", "source.geostat_national_gdp_sna_2008"],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["gdp_sna_break_2010"],
    mustDeclineOrQualify: true,
    note: "The GDP accounting standard changes between these years, so the comparison is limited, not clean.",
  },
  {
    id: 10,
    promptKa: "რამდენი იყო ბიუჯეტის დეფიციტი 2024 წელს?",
    promptEn: "What was the budget deficit in 2024?",
    call: {
      tool: "query_national",
      arguments: { side: "revenue", seriesIds: ["revenue.total"], years: [2024], measure: "amount_gel" },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "national-revenue:country.georgia:revenue.total:2024:amount_gel", value: 29744320017, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "consolidated_budget_receipts",
    requiredSourceIds: ["source.mof_2024_revenue_form1_pdf"],
    requiredDocumentIds: [],
    // The guard that stops a client subtracting this from the expenditure total
    // and calling the remainder a deficit.
    requiredCaveatCodes: ["budget_scopes_differ"],
    mustDeclineOrQualify: true,
    note: "The total carries the scope guard. The real client answer must decline the fiscal-balance reading.",
  },
  {
    id: 11,
    promptKa: "რამდენი დაიხარჯა ჯანდაცვასა და განათლებაზე ბათუმსა და ქუთაისში 2024 წელს?",
    promptEn: "How much did Batumi and Kutaisi spend on health and education in 2024?",
    call: {
      tool: "query_municipal",
      arguments: {
        entityIds: ["06", "20"],
        seriesIds: ["municipal.health", "municipal.education"],
        years: [2024],
        measure: "amount_gel",
      },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "municipal-expenditure:06:municipal.health:2024:amount_gel", value: 8583359.06, unit: "GEL" },
      { id: "municipal-expenditure:06:municipal.education:2024:amount_gel", value: 40069946.61, unit: "GEL" },
      { id: "municipal-expenditure:20:municipal.health:2024:amount_gel", value: 2394326.03, unit: "GEL" },
      { id: "municipal-expenditure:20:municipal.education:2024:amount_gel", value: 22527512.91, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "municipal_budget_expenditure",
    requiredSourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["municipal_financing_outside_functional"],
    mustDeclineOrQualify: false,
    note: "Entity and series are separate dimensions: four distinct cells, each with its own sources.",
  },
  {
    id: 12,
    promptKa: "რამდენი იყო ხულოს ბიუჯეტი 2024 წელს?",
    promptEn: "What was Khulo's budget in 2024?",
    call: {
      tool: "query_municipal",
      arguments: { entityIds: ["11"], seriesIds: ["municipal.total"], years: [2024], measure: "amount_gel" },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "municipal-expenditure:11:municipal.total:2024:amount_gel", value: 30969077.43, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "municipal_budget_expenditure",
    requiredSourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
    requiredDocumentIds: [
      "source.mof.municipalities.2016_2025.budget_history_11",
      "source.mof.municipalities.2024.functional_classification",
    ],
    // Spec 2.4's headline case: show_warning=false on the display flag, but a
    // real quality problem underneath. The engine reads quality state, not the
    // flag, so the severe caveat fires.
    requiredCaveatCodes: ["municipal_source_actual_missing"],
    mustDeclineOrQualify: true,
    note: "Documented functional-total fallback, not a claimed payment actual. The single case most needing a warning.",
  },
  {
    id: 13,
    promptKa: "რამდენად გაიზარდა მუნიციპალიტეტების ჯამური ბიუჯეტი 2015-დან 2024 წლამდე?",
    promptEn: "How much did total municipal budgets grow from 2015 to 2024?",
    call: {
      tool: "compare",
      arguments: {
        target: { dataset: "municipal", entityIds: ["country.georgia"], seriesIds: ["municipal.total"] },
        fromYear: 2015,
        toYear: 2024,
        measure: "amount_gel",
      },
    },
    expectedStatus: "partial",
    expectedComparison: {
      id: "municipal-expenditure:country.georgia:municipal.total:2015-2024:amount_gel",
      from: 2186717489.17,
      to: 5553107287.81,
      absoluteChange: null,
      percentageChange: null,
      percentagePointChange: null,
      comparability: "not_comparable",
    },
    allowedRounding: EXACT,
    expectedBudgetScope: null,
    requiredSourceIds: [],
    requiredDocumentIds: [],
    // The 2015 figure and the later one are not the same measurement. Without
    // this, the pair publishes a +154% "growth" that is a definition change.
    requiredCaveatCodes: ["municipal_total_definition_changed", "municipal_country_scope", "nominal_gel"],
    mustDeclineOrQualify: true,
    note: "Detects the definition change between the 2015 fallback basis and the later payment total.",
  },
  {
    id: 14,
    promptKa: "რამდენია აჭარის უახლესი გადამოწმებული რეგიონული ჯამი?",
    promptEn: "What is Adjara's latest reviewed regional total?",
    call: {
      tool: "query_municipal",
      arguments: { entityIds: ["region.adjara"], seriesIds: ["municipal.total"], years: [2025], measure: "amount_gel" },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "municipal-expenditure:region.adjara:municipal.total:2025:amount_gel", value: 1212519508.44, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "municipal_budget_expenditure",
    // All three sources survive the consolidation; none is dropped.
    requiredSourceIds: [
      "source.adjara_republic_budget_actual",
      "source.municipal_mof_annual_and_history_workbooks",
      "source.treasury_consolidated_revenue_actual",
    ],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["adjara_consolidation_applied"],
    mustDeclineOrQualify: false,
    note: "The net republican adjustment is applied exactly once, and every source is retained.",
  },
  {
    id: 15,
    promptKa: "რამდენია საქართველოს მუნიციპალიტეტების უახლესი ჯამური ბიუჯეტი?",
    promptEn: "What is Georgia's latest reviewed municipal aggregate?",
    call: {
      tool: "query_municipal",
      arguments: {
        entityIds: ["country.georgia"],
        seriesIds: ["municipal.total"],
        years: [2025],
        measure: "amount_gel",
      },
    },
    expectedStatus: "ok",
    expectedCells: [
      { id: "municipal-expenditure:country.georgia:municipal.total:2025:amount_gel", value: 6110301258.08, unit: "GEL" },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "municipal_budget_expenditure",
    requiredSourceIds: ["source.adjara_consolidated_budget"],
    requiredDocumentIds: [],
    // The aggregate's scope is explained rather than presented as a plain sum
    // of 64 municipalities.
    requiredCaveatCodes: ["municipal_country_scope"],
    mustDeclineOrQualify: true,
    note: "Uses the already-consolidated total; the Adjara adjustment is not added a second time.",
  },
  {
    id: 16,
    promptKa: "რამდენი დაიხარჯა განათლებაზე საქართველოს მუნიციპალიტეტებში 2025 წელს?",
    promptEn: "How much did Georgia's municipalities spend on education in 2025?",
    call: {
      tool: "query_municipal",
      arguments: {
        entityIds: ["country.georgia"],
        seriesIds: ["municipal.education"],
        years: [2025],
        measure: "amount_gel",
      },
    },
    expectedStatus: "ok",
    expectedCells: [
      {
        id: "municipal-expenditure:country.georgia:municipal.education:2025:amount_gel",
        value: 793005387.44,
        unit: "GEL",
      },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "municipal_budget_expenditure",
    requiredSourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
    requiredDocumentIds: [],
    // Municipal functional coverage only. The republican budget has no
    // reviewed functional crosswalk, so none is invented.
    requiredCaveatCodes: ["municipal_country_scope", "municipal_functions_no_republican_crosswalk"],
    mustDeclineOrQualify: true,
    note: "Municipal-only functional coverage; no invented republican split.",
  },
  {
    id: 17,
    promptKa: "რომელ მუნიციპალიტეტს აქვს ყველაზე მაღალი ბიუჯეტი ერთ მცხოვრებზე 2025 წელს?",
    promptEn: "Which municipality had the highest budget per resident in 2025?",
    call: {
      tool: "rank",
      arguments: {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2025,
        measure: "gel_per_resident",
        metric: "value",
        order: "descending",
        limit: 5,
      },
    },
    expectedStatus: "ok",
    expectedRanking: {
      // Oni, Mestia, Kazbegi, Lentekhi, Ambrolauri.
      orderedIds: ["71", "36", "68", "70", "69"],
      unit: "GEL_per_resident",
      // All 64 served municipalities are eligible; the aggregate-only codes,
      // the regions and the country aggregate never enter the population.
      candidateCount: 64,
      eligibleCount: 64,
    },
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.geostat_municipal_population", "source.municipal_mof_annual_and_history_workbooks"],
    requiredDocumentIds: [],
    requiredCaveatCodes: [],
    mustDeclineOrQualify: false,
    note: "Ranks valid peers only, using the reviewed population denominator.",
  },
  {
    id: 18,
    promptKa: "რამდენია საქართველოს მუნიციპალური ბიუჯეტი ერთ მცხოვრებზე?",
    promptEn: "What is Georgia's municipal budget per resident?",
    call: {
      tool: "query_municipal",
      arguments: {
        entityIds: ["country.georgia"],
        seriesIds: ["municipal.total"],
        years: [2025],
        measure: "gel_per_resident",
      },
    },
    expectedStatus: "empty",
    expectedCells: [
      {
        id: "municipal-expenditure:country.georgia:municipal.total:2025:gel_per_resident",
        value: null,
        unit: "GEL_per_resident",
      },
    ],
    allowedRounding: EXACT,
    expectedBudgetScope: "municipal_budget_expenditure",
    requiredSourceIds: [],
    requiredDocumentIds: [],
    // Unsupported: the aggregate's numerator includes five budgets with no
    // territorial population. No denominator is invented to fill the gap.
    requiredCaveatCodes: ["per_resident_coverage_limited", "municipal_country_scope"],
    mustDeclineOrQualify: true,
    note: "Unsupported combination. Missing with an explanation, never a computed number.",
  },
  {
    id: 19,
    promptKa: "რამდენი დაიხარჯა 05 კოდის მუნიციპალიტეტში 2024 წელს?",
    promptEn: "How much was spent in municipal code 05 in 2024?",
    call: {
      tool: "query_municipal",
      arguments: { entityIds: ["05"], seriesIds: ["municipal.total"], years: [2024], measure: "amount_gel" },
    },
    expectedStatus: "empty",
    // No observation row at all - not a zero, not a masked value.
    expectedCells: [],
    allowedRounding: EXACT,
    expectedBudgetScope: null,
    requiredSourceIds: [],
    requiredDocumentIds: [],
    requiredCaveatCodes: ["municipality_not_territorial"],
    requiredExcludedEntityIds: ["05"],
    mustDeclineOrQualify: true,
    note: "Excluded with an explanation; no numeric territorial row is ever produced for the five excluded codes.",
  },
  {
    id: 20,
    promptKa: "რომელი ძირითადი პროგრამები გაიზარდა ყველაზე სწრაფად 2017-დან 2024 წლამდე?",
    promptEn: "Which major programs grew fastest between 2017 and 2024?",
    call: {
      tool: "rank",
      arguments: {
        datasetId: "ministries",
        dimension: "series",
        level: "major_program",
        fromYear: 2017,
        toYear: 2024,
        measure: "amount_gel",
        metric: "percentage_change",
        order: "descending",
        limit: 5,
      },
    },
    expectedStatus: "partial",
    expectedRanking: {
      orderedIds: [
        "admin_program.24_07.28016cec",
        "admin_program.25_04.eee6b72f",
        "admin_program.29_05.a7ad04fb",
      ],
      // A percentage change is reported in percent, NOT in the measure's
      // currency. Published as "GEL" until the fixture caught it.
      unit: "percent",
      candidateCount: 48,
      eligibleCount: 31,
    },
    allowedRounding: RATIO_TOLERANCE,
    expectedBudgetScope: null,
    requiredSourceIds: ["source.mof_2017_programmatic_fact_actual", "source.mof_2024_programmatic_fact_actual"],
    requiredDocumentIds: [],
    // These are reviewed programs, not every government program, and the
    // ranking says so.
    requiredCaveatCodes: ["program_coverage_partial", "nominal_gel"],
    mustDeclineOrQualify: true,
    note: "Reviewed subset with comparable endpoints; missing coverage reported and Georgian names returned intact.",
  },
] as const;
