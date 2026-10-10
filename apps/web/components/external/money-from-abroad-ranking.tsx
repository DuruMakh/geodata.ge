"use client";
import type { MoneyTransferMeasure } from "../../lib/data/externalFlows/types";
import type { MoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExternalRanking } from "./external-ranking";

export function MoneyFromAbroadRanking({ model, measure }: { model: MoneyTransfersModel; measure: MoneyTransferMeasure }) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `external.money.${key}`, values);
  return <ExternalRanking testId="money-from-abroad" data={{ "end-year": model.range.end, measure }} title={t("rankingTitle", { measure: message(messages, `external.measure.${measure}`), year: model.range.end })} itemLabel={t("country")} shareLabel={t("share")} note={t("shareNote")} empty={t("noRanking")} rows={model.ranking} other={model.other} monthsLabel={count => t("months", { count })} />;
}
