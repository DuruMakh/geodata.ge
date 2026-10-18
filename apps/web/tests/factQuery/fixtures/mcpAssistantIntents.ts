/**
 * Human acceptance rubric, separate from the 48 source-checked numerical intents.
 * Supply only the chosen prompt to the client; required behaviors and evidence
 * are for the reviewer, not instructions or expected-answer hints for the model.
 * These cases have not passed until an authorized real client executes them.
 */
export type McpAssistantIntent = {
  id: string;
  promptEn: string;
  promptKa: string;
  requiredBehaviors: readonly string[];
};

/** Record actual observations for each language; never infer a pass from SDK tests. */
export type McpAssistantAcceptanceRecord = {
  intentId: string;
  language: "en" | "ka";
  date: string;
  application: string;
  applicationVersion: string;
  model: string | null;
  protocol: string | null;
  toolsUsed: readonly string[];
  evidence: {
    factsAndScope: string;
    units: string;
    originalCitations: string;
    caveatsAndMissingness: string;
    discoveryAndRecovery: string;
    dataVersion: string;
  };
  failures: readonly string[];
  outcome: "passed" | "failed" | "unverified";
};

/** Applies to every case, in addition to its own requirements below. */
export const MCP_ASSISTANT_COMMON_REQUIREMENTS = [
  "Answer in the prompt's language with reviewed human-readable names; never expose IDs as the explanation.",
  "Use discovered IDs and supported measures, keeping dataVersion consistent; rediscover after a stale-version error rather than combine releases.",
  "Check facts against the reviewed result independently; preserve units, accounting scope, basis and any applicable projections or preliminary status.",
  "Cite the returned original documents and attribute Fiscal.ge; preserve the complete relevant evidence chain.",
  "Place every severe caveat beside the figure it qualifies; missing is not zero, and unsupported data must not be invented.",
  "Record actual selected tools, answer and evidence for each language. Efficient valid discovery or bulk-file paths are acceptable; no deliberately invalid call is required.",
] as const;

export const MCP_ASSISTANT_INTENTS: readonly McpAssistantIntent[] = [
  {
    id: "latest-national-inflation",
    promptEn: "What was Georgia's annual inflation in the latest reviewed month? A search for 'annual inflation' returned no matches. Can you still find it and cite the original source?",
    promptKa: "რამდენი იყო საქართველოს წლიური ინფლაცია ბოლო გადამოწმებულ თვეში? ძიებამ „წლიური ინფლაცია“ შედეგი ვერ იპოვა. შეგიძლია მაინც მოძებნო და მიუთითო ორიგინალი წყარო?",
    requiredBehaviors: [
      "Recover from the reported empty phrase match using a meaningful short keyword or browsing inflation, rather than claim the dataset is absent.",
      "Discover the actual latest headline annual period; do not assume the current calendar month or substitute monthly/12-month-average inflation.",
      "Report the rate as percent, not a fraction, with the period and original national CPI source.",
    ],
  },
  {
    id: "city-inflation-source",
    promptEn: "What was Batumi's annual inflation in the latest reviewed month, and which original document supports it?",
    promptKa: "რამდენი იყო ბათუმის წლიური ინფლაცია ბოლო გადამოწმებულ თვეში და რომელი ორიგინალი დოკუმენტი ადასტურებს მას?",
    requiredBehaviors: [
      "Discover city-supported headline annual inflation and the actual available city period before querying.",
      "Obtain the shared city original through city-filtered source resolution and cite it; do not substitute a national-only source.",
      "Use percent and explain applicable city-price-collection limitations without treating city inflation as regional inflation or a cost-of-living level.",
    ],
  },
  {
    id: "city-subgroup-limitation",
    promptEn: "What was annual bread-and-cereals inflation in Batumi in the latest reviewed month? If that detail is unavailable, what can you show instead?",
    promptKa: "რამდენი იყო პურისა და ბურღულეულის წლიური ინფლაცია ბათუმში ბოლო გადამოწმებულ თვეში? თუ ასეთი დეტალი არ არის, რას შემომთავაზებ მის ნაცვლად?",
    requiredBehaviors: [
      "Explain that national subgroups are not published by city; never present a national subgroup as a Batumi figure.",
      "Offer a discovered city-supported division such as food and non-alcoholic beverages, naming its broader scope and supported measure.",
    ],
  },
  {
    id: "spending-share-change-ranking",
    promptEn: "Which five state-budget spending fields had the largest increase in their share of total expenditure from 2023 to 2025? Show the size of the change and sources.",
    promptKa: "სახელმწიფო ბიუჯეტის რომელ ხუთ სფეროს გაეზარდა ყველაზე მეტად წილი მთლიან ხარჯებში 2023 წლიდან 2025 წლამდე? მიუთითე ცვლილების სიდიდე და წყაროები.",
    requiredBehaviors: [
      "Rank changes in share of total expenditure, not nominal GEL, relative percent growth or share of GDP.",
      "Report changes in percentage points and preserve the 2023-to-2025 endpoints and returned order/evidence.",
    ],
  },
  {
    id: "georgia-combined-municipal-total",
    promptEn: "What was Georgia's combined municipal-budget expenditure total in 2025? Explain what it includes and cite all the underlying source evidence.",
    promptKa: "რამდენი იყო საქართველოს მუნიციპალური ბიუჯეტების ნაერთი ხარჯი 2025 წელს? ახსენი, რას მოიცავს ის, და მიუთითე ყველა საფუძვლად გამოყენებული წყარო.",
    requiredBehaviors: [
      "Explain the combined total includes all 69 reviewed municipal budgets and the net Adjara republican adjustment once, while only 64 budgets support territorial attribution.",
      "Preserve the complete underlying history, republican-payment and same-year transfer evidence; do not equate the total with national state-budget spending.",
      "Do not provide a country per-resident figure or silently add municipal functions to recover the combined total.",
    ],
  },
  {
    id: "adjara-combined-total",
    promptEn: "What was Adjara's combined expenditure total in 2025? Explain how transfers between its budgets are handled and cite the supporting originals.",
    promptKa: "რამდენი იყო აჭარის ნაერთი ხარჯი 2025 წელს? ახსენი, როგორ არის გათვალისწინებული მის ბიუჯეტებს შორის ტრანსფერები, და მიუთითე ორიგინალი წყაროები.",
    requiredBehaviors: [
      "Explain six municipal budgets plus Adjara republican actual payments minus same-year transfers to territorial budgets.",
      "Use the already adjusted returned total; do not subtract transfers twice or allocate the republican adjustment across functions.",
      "Cite municipal, republican and same-year Treasury transfer evidence with correct roles.",
    ],
  },
  {
    id: "khulo-total-and-education",
    promptEn: "How much did Khulo spend in total and on education in 2024? Explain any limitations separately for each figure and cite the originals.",
    promptKa: "რამდენი დახარჯა ხულომ ჯამურად და განათლებაზე 2024 წელს? თითოეული ციფრის შეზღუდვა ცალ-ცალკე ახსენი და მიუთითე ორიგინალი წყაროები.",
    requiredBehaviors: [
      "Explain beside the total that a functional-total substitute is used because the source actual total is missing; do not hide the severe comparability limitation.",
      "Do not attach that total-only warning to the separately reviewed education amount; preserve any caveats that actually apply to education.",
      "Use GEL and distinguish each figure's original-source evidence.",
    ],
  },
  {
    id: "cumulative-product-change",
    promptEn: "How much did rice prices change cumulatively during calendar year 2025? Explain the comparison base, any history limits and the original inputs.",
    promptKa: "რამდენით შეიცვალა ბრინჯის ფასი კუმულაციურად 2025 კალენდარული წლის განმავლობაში? ახსენი შედარების ბაზა, ისტორიის შეზღუდვები და ორიგინალი საწყისი მონაცემები.",
    requiredBehaviors: [
      "Search and discover the reviewed rice identity; fix start year 2025 and December 2025 endpoint with December 2024 as calculation base.",
      "Compound all required monthly inputs, never sum rates or substitute an annual-index value; report percent and identify Fiscal.ge as the derived calculation's author.",
      "Cite monthly original inputs and preserve applicable identity/history and bilingual-label limitations without inventing continuous brand/specification history.",
    ],
  },
  {
    id: "early-product-period",
    promptEn: "How did plum prices change cumulatively from January 2015 through August 2026? Is the history complete enough to answer?",
    promptKa: "რამდენით შეიცვალა ქლიავის ფასი კუმულაციურად 2015 წლის იანვრიდან 2026 წლის აგვისტომდე? საკმარისად სრულია ისტორია პასუხის გასაცემად?",
    requiredBehaviors: [
      "Discover the reviewed product's actual start and identity/history limits; query the requested baseline rather than silently choosing a later one.",
      "Report missing with the returned late-start reason; never zero, bridge an identity split, interpolate or report a partial accumulated value.",
      "Distinguish a product starting late from a genuinely absent monthly input; do not claim a source gap that the reviewed data does not have.",
    ],
  },
  {
    id: "broad-catalogue-and-sources",
    promptEn: "I want the full inflation-product catalogue and all its original source documents for bulk analysis. If that is too large for a response, help me obtain complete data and evidence another way.",
    promptKa: "მასობრივი ანალიზისთვის მინდა ინფლაციის პროდუქტების სრული კატალოგი და ყველა ორიგინალი წყარო. თუ ეს ერთ პასუხში ვერ ეტევა, დამეხმარე სრული მონაცემებისა და წყაროების სხვა გზით მიღებაში.",
    requiredBehaviors: [
      "Use relevant smaller discovery/source requests or the published bulk files; a direct valid bulk path is acceptable without provoking a refusal.",
      "If result_too_large occurs, follow its catalogue/source-specific recovery, preserving complete derived evidence; never claim a truncated success or describe a source catalogue as zero cells.",
      "Provide usable returned static-file links and distinguish raw index inputs from calculated rates.",
    ],
  },
  {
    id: "outside-mcp-scope",
    promptEn: "What was Georgia's unemployment rate in 2025? Can this connection answer it, and where can I find the reviewed figure if it cannot?",
    promptKa: "რამდენი იყო საქართველოში უმუშევრობის დონე 2025 წელს? შეუძლია ამ კავშირს პასუხის გაცემა და, თუ არა, სად ვნახო გადამოწმებული მაჩვენებელი?",
    requiredBehaviors: [
      "State unemployment is outside the approved MCP datasets; do not invent a tool or a factual value from unrelated data.",
      "Point to the documented website unemployment explorer as the alternative; do not promise an unsupported MCP or bulk dataset.",
    ],
  },
];
