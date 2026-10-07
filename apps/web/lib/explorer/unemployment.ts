import type { ClientUnemploymentObservation, UnemploymentGroupDefinition } from "../data/unemployment/types";
import { unemploymentIsRate } from "../data/unemployment/types";
import { colorForItem, colorForProgram, EDITORIAL_PALETTE, INK } from "./colors";
import { resolveRange } from "./periodRange";
import type { UnemploymentState } from "./unemploymentState";
import { unemploymentFactSeriesId, unemploymentOverviewDefinitions, unemploymentOverviewIndicators, unemploymentUsesIndicatorSeries } from "./unemploymentOverview";
import { UNEMPLOYMENT_AGE_FIRST_YEAR } from "./unemploymentAge";

export function unemploymentReferenceId(state: Pick<UnemploymentState, "breakdown" | "educationSex" | "overview" | "regional" | "regionId">): string {
  if (state.breakdown === "age") return "";
  if (state.regional) return `${state.regionId ?? "georgia"}:unemployment_rate`;
  if (state.overview && state.breakdown !== "education") return `georgia:${state.breakdown === "long_term" ? "long_term_unemployment_rate" : "unemployment_rate"}`;
  return state.breakdown === "education" && state.educationSex !== "total" ? state.educationSex : "georgia";
}
function primaryFacts(facts: readonly ClientUnemploymentObservation[], state: UnemploymentState): ClientUnemploymentObservation[] {
  return facts.filter(f => f.dimension === state.breakdown && (!state.regionId || f.groupId === state.regionId) && f.indicatorId === state.indicator && (state.breakdown !== "education" || f.sex === state.educationSex) && (state.breakdown !== "age" || f.year >= UNEMPLOYMENT_AGE_FIRST_YEAR));
}
export function unemploymentCoverage(facts: readonly ClientUnemploymentObservation[], state: UnemploymentState) {
  const selectedIndicators = new Set(state.selectedIds.map(id => id.split(":")[1]));
  const selectedFacts = state.regional && state.selectedIds.length ? facts.filter(f =>
    (f.dimension === "region" && (!state.regionId || f.groupId === state.regionId) && (state.regionId ? state.selectedIds.includes(unemploymentFactSeriesId(f, state)) : selectedIndicators.has(f.indicatorId))) ||
    (!state.regionId && f.dimension === "national" && state.selectedIds.includes(unemploymentFactSeriesId(f, state)))) : primaryFacts(facts, state);
  const availableYears = [...new Set(selectedFacts.map(f => f.year))].sort((a, b) => a - b);
  if (!availableYears.length) throw new Error(`No unemployment source years for ${state.breakdown}:${state.indicator}`);
  return { min: availableYears[0], max: availableYears.at(-1)!, availableYears };
}
export function unemploymentScopeFacts(facts: readonly ClientUnemploymentObservation[], state: UnemploymentState): ClientUnemploymentObservation[] {
  if (unemploymentUsesIndicatorSeries(state)) {
    const indicators = unemploymentOverviewIndicators(state.breakdown);
    const years = new Set(state.regional ? unemploymentCoverage(facts, state).availableYears : primaryFacts(facts, state).map(f => f.year));
    return facts.filter(f => (f.dimension === state.breakdown && (!state.regionId || f.groupId === state.regionId) && indicators.includes(f.indicatorId)) || (!state.regionId && ["settlement", "region"].includes(state.breakdown) && f.dimension === "national" && indicators.includes(f.indicatorId) && (state.breakdown === "region" || f.indicatorId === "unemployment_rate") && years.has(f.year)));
  }
  const primary = primaryFacts(facts, state);
  if (state.breakdown === "national" || state.breakdown === "long_term" || state.breakdown === "age") return primary;
  const years = new Set(primary.map(f => f.year)), referenceId = unemploymentReferenceId(state);
  const reference = facts.filter(f => f.dimension === (referenceId === "georgia" ? "national" : "sex") && f.groupId === referenceId && f.indicatorId === state.indicator && years.has(f.year));
  return [...primary, ...reference];
}
export function unemploymentGroupColor(group: UnemploymentGroupDefinition): string {
  if (group.id === "georgia") return INK;
  // Use the existing editorial shade helper when this registry exceeds the palette.
  return colorForProgram(colorForItem(`unemployment.${group.id}`, group.sortOrder), Math.floor(group.sortOrder / EDITORIAL_PALETTE.length));
}
export function buildUnemploymentModel(facts: readonly ClientUnemploymentObservation[], registry: readonly UnemploymentGroupDefinition[], state: UnemploymentState) {
  const coverage = unemploymentCoverage(facts, state), range = resolveRange(state.range, coverage);
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const scope = unemploymentScopeFacts(facts, state), ids = new Set(scope.map(f => unemploymentFactSeriesId(f, state)));
  const referenceId = unemploymentReferenceId(state);
  const active = scope.filter(f => f.year >= range.start && f.year <= range.end);
  const byCell = new Map(active.map(f => [`${unemploymentFactSeriesId(f, state)}:${f.year}`, f]));
  const endValues: Record<string, number | null> = Object.fromEntries([...ids].map(id => [id, byCell.get(`${id}:${range.end}`)?.value ?? null]));
  const definitions = unemploymentUsesIndicatorSeries(state) ? unemploymentOverviewDefinitions(scope, registry, state) : registry.filter(group => ids.has(group.id)).map(group => ({ ...group, groupId: group.id, indicatorId: state.indicator })).sort((a, b) => {
    if (state.breakdown === "age") return a.sortOrder - b.sortOrder;
    if (a.id === referenceId) return -1; if (b.id === referenceId) return 1;
    const av = endValues[a.id], bv = endValues[b.id];
    if (av === null && bv !== null) return 1; if (bv === null && av !== null) return -1;
    return (av !== null && bv !== null ? bv - av : 0) || a.sortOrder - b.sortOrder;
  });
  const percent = unemploymentIsRate(state.indicator);
  const selected = definitions.filter(group => state.selectedIds.includes(group.id) && unemploymentIsRate(group.indicatorId) === percent);
  const selectedIds = new Set(selected.map(group => group.id));
  const activeFacts = active.filter(f => selectedIds.has(unemploymentFactSeriesId(f, state)));
  const color = (group: typeof definitions[number]) => unemploymentUsesIndicatorSeries(state) && group.id === referenceId ? INK : unemploymentGroupColor(group);
  const rows = selected.map(group => ({
    itemId: group.id, kaLabel: group.labelKa, color: color(group),
    valuesByYear: Object.fromEntries(years.map(year => { const value = byCell.get(`${group.id}:${year}`)?.value; return [year, value === undefined ? null : percent ? value / 100 : value]; })),
  }));
  return {
    range, availableYears: coverage.availableYears, years, definitions, referenceId, rows, percent,
    series: selected.map(group => ({ id: group.id, label: group.labelKa, color: color(group), vals: years.map(year => byCell.get(`${group.id}:${year}`)?.value ?? null), planned: years.map(() => false) })),
    endValues, headline: active.filter(f => unemploymentFactSeriesId(f, state) === referenceId).sort((a, b) => a.year - b.year).at(-1) ?? null,
    activeFacts, sourceIds: [...new Set(activeFacts.map(f => f.sourceId))], hasData: activeFacts.length > 0,
  };
}
export function buildUnemploymentComposition(facts: readonly ClientUnemploymentObservation[], years: readonly number[]) {
  const national = new Map(facts.filter(f => f.dimension === "national").map(f => [`${f.indicatorId}:${f.year}`, f.value]));
  return {
    periods: [...years], overlay: null,
    segments: [
      { id: "employed", label: "დასაქმებული", color: "#1F6E56" },
      { id: "unemployed", label: "უმუშევარი", color: "#B3402A" },
      { id: "outside_labour_force", label: "შრომის ძალის გარეთ", color: "#8A7B65" },
    ].map(segment => ({ ...segment, values: years.map(year => national.get(`${segment.id}:${year}`) ?? null) })),
  };
}
