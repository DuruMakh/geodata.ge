"use client";

import { formatShare } from "../../lib/explorer/format";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import { RegionIndex } from "../regional-economies/regional-economies-index";
import { SectionTitle } from "../ui/editorial";

const percent = (value: number) => formatShare(value / 100);

/** The regions by census share aged 65+, as a glance: the regions index without its links (the regions' own pages hold the detail). */
export function AgeSexRegions({ model, georgiaShare, sourceNote }: { model: RegionMapModel; georgiaShare: number; sourceNote: string }) {
  const { locale, messages, englishLabels } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const name = (region: RegionMapModel["regions"][number]) => publicLabel(locale, region.regionId, region.nameKa, englishLabels);
  const oldest = model.regions[0]!;
  const youngest = model.regions.at(-1)!;
  return (
    <section data-testid="age-sex-regions" className="@container">
      <SectionTitle>{t("regionsTitle")}</SectionTitle>
      <div className="mt-6">
        <RegionIndex
          model={model}
          sourceNote={sourceNote}
          metric={{
            formatValue: percent,
            mapAria: t("regionMapAria"),
            entityAria: (regionName, value) => t("regionEntityAria", { name: regionName, share: percent(value) }),
            legend: t("regionLegend"),
            testId: "age-sex-region-map",
          }}
          summary={[
            { label: t("kpiGeorgiaOld"), value: percent(georgiaShare), detail: t("censusDate") },
            { label: t("kpiOldest"), value: name(oldest), detail: percent(oldest.value) },
            { label: t("kpiYoungest"), value: name(youngest), detail: percent(youngest.value) },
          ]}
        />
      </div>
    </section>
  );
}
