import type { DeathsChapter as DeathsChapterModel } from "../../../lib/landing/chapters/types";
import { UnitChart, type UnitLabels } from "./unit-chart";

// Chapter 10: what Georgians die of, as one chart of squares (each 100 deaths) in rows by cause.

export type DeathsLabels = UnitLabels;

export function DeathsChapter({ data, labels }: { data: DeathsChapterModel; labels: DeathsLabels }) {
  if (!data.groups.length) throw new Error("Deaths chapter: no groups");
  return (
    <div className="mt-8">
      <UnitChart data={data} labels={labels} />
    </div>
  );
}
