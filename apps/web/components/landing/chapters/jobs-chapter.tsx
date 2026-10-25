import type { YouthJobsChapter } from "../../../lib/landing/chapters/types";
import { RegionsChart, type RegionsLabels } from "./regions-chart";
import { WaffleChart, type WaffleLabels } from "./waffle-chart";

// Chapter 07: two 10 x 10 grids side by side from 1000px (everyone aged 15+ and the 15–29s: employed, unemployed,
// outside the labour force per 100 people), and the regional unemployment rates below, against the rate of Georgia.

export type JobsLabels = {
  all: WaffleLabels;
  youth: WaffleLabels;
  regions: RegionsLabels;
};

export function JobsChapter({ data, labels }: { data: YouthJobsChapter; labels: JobsLabels }) {
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-10 min-[1000px]:grid-cols-2 min-[1000px]:gap-12">
        <WaffleChart split={data.all} labels={labels.all} />
        <WaffleChart split={data.youth} labels={labels.youth} />
      </div>
      <RegionsChart regions={data.regions} national={data.all.rate} labels={labels.regions} />
    </>
  );
}
