import { queryGdpInput } from "./schemas";
import { buildResponseMeta } from "./meta";
import { buildObservationId, resolveDocumentIds } from "./observations";
import type { Observation } from "./observations";
import { selectSources } from "./sources";
import type {
  Caveat,
  Coverage,
  FactQueryResponse,
  FactQuerySnapshot,
} from "./types";

export function queryGdp(
  snapshot: FactQuerySnapshot,
  rawInput: unknown,
): FactQueryResponse {
  const error = (
    code: string,
    messageKa: string,
    messageEn: string,
  ): FactQueryResponse => ({
    kind: "error",
    status: "error",
    error: { code, messageKa, messageEn, retryable: false },
    meta: buildResponseMeta(snapshot),
  });
  const parsed = queryGdpInput.safeParse(rawInput);
  if (!parsed.success)
    return error(
      "invalid_parameters",
      "მიუთითეთ სწორი მშპ-ის სერიები და წლები.",
      "Provide valid GDP series IDs and years; the series determines its unit and price basis.",
    );
  const input = parsed.data;
  if (
    input.expectedDataVersion &&
    input.expectedDataVersion !== snapshot.dataVersion
  )
    return error(
      "data_version_changed",
      "მონაცემების ვერსია შეიცვალა.",
      "The data version changed; refresh coverage before querying again.",
    );
  const facts = snapshot.gdpOverview.facts;
  const availableYears = [...new Set(facts.map((f) => f.year))].sort(
    (a, b) => a - b,
  );
  if (
    input.years.some((y) => y < availableYears[0] || y > availableYears.at(-1)!)
  )
    return error(
      "year_out_of_range",
      "წელი მონაცემების დაფარვის ფარგლებს გარეთაა.",
      `Requested years must fall within ${availableYears[0]}-${availableYears.at(-1)}. Individual series have shorter coverage; consult describe_coverage.`,
    );
  const selected = facts.filter(
    (f) => input.seriesIds.includes(f.seriesId) && input.years.includes(f.year),
  );
  const sources = selectSources(snapshot, [
    ...new Set(selected.map((f) => f.sourceId)),
  ]);
  const observations: Observation[] = input.seriesIds.flatMap((seriesId) =>
    input.years.map((year) => {
      const f = selected.find(
          (f) => f.seriesId === seriesId && f.year === year,
        ),
        s = snapshot.gdpOverview.series[seriesId];
      return {
        observationId: buildObservationId(
          "gdp-overview",
          "country.georgia",
          seriesId,
          year,
          "value",
        ),
        datasetId: "gdp-overview",
        budgetScope: "national_accounts",
        entityId: "country.georgia",
        entityType: "country",
        entityLabelKa: "საქართველო",
        entityLabelEn: "Georgia",
        entitySlug: null,
        seriesId,
        seriesLabelKa: s.labelKa,
        seriesLabelEn: s.labelEn,
        level: "total",
        parentSeriesId: null,
        year,
        measure: "value",
        unit: s.unit,
        value: f ? Number(f.value) : null,
        availability: f ? "available" : "missing",
        missingReason: f
          ? null
          : "ამ სერიისთვის წლის მონაცემი არ არის ხელმისაწვდომი.",
        missingReasonEn: f
          ? null
          : "This year is not available for this series.",
        basis: f?.status ?? null,
        valueDefinition: s.definitionKa,
        valueDefinitionEn: s.definitionEn,
        valueDefinitionId: `gdp-overview:${seriesId}:${f?.accountingStandard ?? "world_bank"}`,
        sourceIds: f ? [f.sourceId] : [],
        documentIds: f ? resolveDocumentIds(sources, [f.sourceId]) : [],
        caveatIds: [],
      };
    }),
  );
  const caveats: Caveat[] = [];
  const add = (
    code: string,
    messageKa: string,
    messageEn: string,
    rows: Observation[],
  ) => {
    if (!rows.length) return;
    caveats.push({
      code,
      severity: "note",
      messageKa,
      messageEn,
      methodologyRef: "/methodology/gdp",
      methodologyRefEn: "/en/methodology/gdp",
      affects: rows.map((r) => `${r.seriesId}:${r.year}`),
    });
    rows.forEach((r) => r.caveatIds.push(code));
  };
  add(
    "gdp_preliminary",
    "მონაცემი წინასწარია და შეიძლება გადაიხედოს.",
    "These observations are preliminary and subject to revision.",
    observations.filter((o) => o.basis === "preliminary"),
  );
  add(
    "gdp_historical_method",
    "2009 წლის ჩათვლით გამოიყენება SNA 1993, 2010 წლიდან — SNA 2008; ისტორიული სერია ერთიანად გადახედილი არ არის.",
    "Geostat nominal series use SNA 1993 through 2009 and SNA 2008 from 2010; the historical series is not uniformly revised.",
    observations.filter(
      (o) => o.availability === "available" && !o.seriesId.startsWith("real_"),
    ),
  );
  add(
    "gdp_world_bank_history",
    "ადრეული ისტორიული მონაცემების აღდგენის დეტალები წყაროს მეტამონაცემებში მითითებული არ არის.",
    "The World Bank metadata does not specify how the earliest historical observations were reconstructed. Published values are preserved without custom rebasing or splicing.",
    observations.filter(
      (o) => o.availability === "available" && o.seriesId.startsWith("real_"),
    ),
  );
  const available = observations.filter((o) => o.availability === "available");
  const coverage: Coverage = {
    requestedYears: input.years,
    availableYears,
    returnedYears: [...new Set(available.map((o) => o.year))],
    missingCells: observations
      .filter((o) => o.availability === "missing")
      .map((o) => ({
        entityId: o.entityId,
        seriesId: o.seriesId,
        year: o.year,
        reason: o.missingReason!,
        reasonEn: o.missingReasonEn!,
      })),
    excludedEntities: [],
    returnedCount: available.length,
    expectedCount: observations.length,
  };
  return {
    kind: "observations",
    status:
      available.length === observations.length
        ? "ok"
        : available.length
          ? "partial"
          : "empty",
    data: { observations, coverage },
    meta: buildResponseMeta(snapshot, {
      sources,
      caveats,
      citedDocumentIds: [
        ...new Set(observations.flatMap((o) => o.documentIds)),
      ],
    }),
  };
}
