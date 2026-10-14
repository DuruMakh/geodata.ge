"use client";
import { User } from "lucide-react";
import type { HouseholdMeasure } from "../../lib/data/household/types";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { SegmentedTabs } from "../ui/editorial";
import { HouseholdIcon } from "../ui/household-icon";

/** The per household / per person icon switch. */
export function MeasureTabs({ value, onChange }: { value: HouseholdMeasure; onChange: (measure: HouseholdMeasure) => void }) {
  const { messages } = useI18n();
  const t = (key: string) => message(messages, `household.${key}`);
  return <SegmentedTabs<HouseholdMeasure> ariaLabel={t("measureLabel")} value={value} onChange={onChange} options={[
    { value: "per_household", label: t("measure.per_household"), testId: "household-measure-per_household", icon: <HouseholdIcon aria-hidden="true" size={18} strokeWidth={1.5} /> },
    { value: "per_capita", label: t("measure.per_capita"), testId: "household-measure-per_capita", icon: <User aria-hidden="true" size={18} strokeWidth={1.5} /> },
  ]} />;
}
