import type { AgeingChapter as AgeingData, MunicipalChapter } from "../../../lib/landing/chapters/types";
import { BirthsMap, type BirthsMapLabels } from "./births-map";
import { decimals, signedCount } from "./chart-format";
import { MigrationChart, type MigrationLabels } from "./migration-chart";
import { PyramidChart, type PyramidLabels } from "./pyramid-chart";
import { StatCard, type StatText } from "./stat-card";

// Chapter 06: the population pyramid with four number cards beside it (women per 100 men, life expectancy,
// fertility, net migration with its bars), and the births-per-deaths map below. 7/5 columns from 1000px.

export type AgeingLabels = {
  pyramid: PyramidLabels;
  migration: MigrationLabels;
  map: BirthsMapLabels;
  women: StatText;
  life: StatText & { unit: string };
  fertility: StatText;
  migrationCard: StatText;
};

/**
 * The cards' notes, each with the numbers and year of its own measure. The migration note follows the data: which
 * way the latest year went, and whether the series total is negative or positive.
 */
export function ageingNotes(data: AgeingData, t: (key: string, values?: Record<string, string | number>) => string) {
  const { years, net } = data.migration;
  const latest = net[net.length - 1];
  const total = net.reduce((sum, v) => sum + v, 0);
  const { year, women, men } = data.lifeExpectancy;
  return {
    women: t("landing.ageing.women.note", { ratio: decimals(data.oldestWomenPerMan, 1), year: data.pyramid.year }),
    life: t("landing.ageing.life.note", { year, women: decimals(women, 1), men: decimals(men, 1) }),
    fertility: t("landing.ageing.fertility.note", { year: data.fertility.year }),
    migration:
      `${t(latest >= 0 ? "landing.ageing.migration.arrivals" : "landing.ageing.migration.departures", { year: years[years.length - 1], net: decimals(Math.abs(latest), 0) })}; ` +
      t(total < 0 ? "landing.ageing.migration.totalNegative" : "landing.ageing.migration.totalPositive", {
        firstYear: years[0],
        lastYear: years[years.length - 1],
        total: signedCount(total),
      }),
  };
}

export function AgeingChapter({ data, municipal, labels }: { data: AgeingData; municipal: MunicipalChapter; labels: AgeingLabels }) {
  const { net } = data.migration;
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-10 min-[1000px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1000px]:gap-12">
        <PyramidChart data={data} labels={labels.pyramid} />
        <div className="flex flex-col gap-[26px]">
          <StatCard label={labels.women.label} value={decimals(data.womenPer100Men, 1)} note={labels.women.note} />
          <StatCard label={labels.life.label} value={decimals(data.lifeExpectancy.total, 1)} unit={labels.life.unit} note={labels.life.note} />
          <StatCard label={labels.fertility.label} value={decimals(data.fertility.rate, 2)} note={labels.fertility.note} />
          <StatCard label={labels.migrationCard.label} value={signedCount(net[net.length - 1])} note={labels.migrationCard.note}>
            <MigrationChart data={data.migration} labels={labels.migration} />
          </StatCard>
        </div>
      </div>
      <BirthsMap births={data.births} municipal={municipal} labels={labels.map} />
    </>
  );
}
