"use client";

import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { Callout } from "../ui/editorial";

/** Stands in for a view while its page data (use-page-data.ts) loads, or says it failed: the load-error Callout of DESIGN.md §7.9. */
export function PageDataStatus({ status }: { status: "loading" | "error" }) {
  const { messages } = useI18n();
  return <div role={status === "error" ? "alert" : "status"} className="mt-5">
    <Callout testId={`page-data-${status}`}>{message(messages, status === "error" ? "common.dataLoadError" : "common.dataLoading")}</Callout>
  </div>;
}
