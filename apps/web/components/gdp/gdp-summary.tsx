import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { GdpIndicator } from "../../lib/explorer/gdpOverview";

export function GdpSummary({ indicator }: { indicator: GdpIndicator }) {
  return (
    <>
      {(["real", "nominal", "growth", "per_capita"] as const).map((id) => (
        <IndicatorSummary key={id} indicator={id} hidden={id !== indicator} />
      ))}
    </>
  );
}

function IndicatorSummary({
  indicator,
  hidden,
}: {
  indicator: GdpIndicator;
  hidden: boolean;
}) {
  const { messages } = useI18n();
  const prefix = indicator === "real" ? "summary" : `${indicator}Summary`;
  const t = (key: string) => message(messages, `gdp.${prefix}.${key}`);
  const common = (key: string) => message(messages, `gdp.summary.${key}`);
  const periods =
    indicator === "real"
      ? ["1994–2003", "2003–2012", "2012–2025"]
      : ["2003–2012", "2012–2025"];
  const columns =
    indicator === "growth" ? ["annual", "total"] : ["total", "annual"];
  return (
    <section
      hidden={hidden}
      aria-labelledby={`${indicator}-gdp-summary-heading`}
      data-testid={`${indicator}-gdp-summary`}
      className="mt-8 border-t border-[var(--hairline)] pt-6"
    >
      <h2
        id={`${indicator}-gdp-summary-heading`}
        className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--ink)]"
      >
        {common("heading")}
      </h2>
      <div className="max-w-[800px] space-y-4 text-sm leading-7 text-[var(--body)]">
        <p>{t("intro")}</p>
        <p>{t("recent")}</p>
        {indicator === "real" || indicator === "growth" ? (
          <>
            <p>{t("periodsIntro")}</p>
            <table className="w-full border-collapse text-left text-[13px] leading-6">
              <caption className="sr-only">{t("periodsIntro")}</caption>
              <thead className="border-b border-[var(--ink)] text-[var(--ink)]">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {common("period")}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="py-2 pl-2 text-right font-medium"
                    >
                      {common(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period, index) => (
                  <tr
                    key={period}
                    className="border-b border-[var(--hairline-soft)]"
                  >
                    <th
                      scope="row"
                      className="whitespace-nowrap py-3 pr-3 font-normal"
                    >
                      {period}
                    </th>
                    {columns.map((column) => (
                      <td
                        key={column}
                        className="py-3 pl-2 text-right font-[family-name:var(--font-numeric)]"
                      >
                        {common(
                          `${column}${indicator === "growth" ? index + 1 : index}`,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{t("comparison")}</p>
          </>
        ) : (
          <p>{t("periods")}</p>
        )}
        {indicator === "real" ? (
          <>
            <p>{t("peak")}</p>
            <p>{t("sovietGrowth")}</p>
          </>
        ) : (
          <>
            {indicator !== "nominal" ? <p>{t("context")}</p> : null}
            <p>{t("interpretation")}</p>
          </>
        )}
        <p className="text-xs leading-6 text-[var(--muted)]">{t("note")}</p>
      </div>
    </section>
  );
}
