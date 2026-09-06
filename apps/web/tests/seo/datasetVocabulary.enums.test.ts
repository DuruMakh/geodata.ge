import { describe, expect, it } from "vitest";
import { DATASETS } from "../../lib/seo/datasetVocabulary";
import {
  debtMeasure,
  deficitMeasure,
  municipalMeasure,
  nationalMeasure,
} from "../../lib/factQuery/schemas";

// schemas.ts warns that a second hand-maintained copy of the measure lists
// silently drifts from what the query functions accept. The SEO vocabulary is
// such a copy, so this locks the two together rather than trusting a comment.
describe("SEO dataset measures match the measures the query layer serves", () => {
  it.each([
    ["national-expenditure", nationalMeasure],
    ["national-revenue", nationalMeasure],
    ["municipal-expenditure", municipalMeasure],
    ["government-debt", debtMeasure],
    ["general-government-balance", deficitMeasure],
  ] as const)("%s", (datasetId, enumeration) => {
    expect([...DATASETS[datasetId].measures]).toEqual([...enumeration.options]);
  });
});
