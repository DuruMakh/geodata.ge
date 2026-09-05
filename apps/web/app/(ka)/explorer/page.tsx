import { BudgetHub } from "../../../components/hub/budget-hub";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { LegacyHashRedirect } from "../../../components/shell/legacy-hash-redirect";
import { PageHeader } from "../../../components/shell/page-header";
import { SourceNote } from "../../../components/ui/editorial";
import { buildHubCards } from "../../../lib/explorer/hubCards";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../../../lib/data/servedData";
import { fiscalMetadata } from "../../../lib/seo/metadata";

export const metadata = fiscalMetadata({
  title: "საქართველოს ბიუჯეტის მონაცემები | Fiscal.ge",
  description:
    "საქართველოს ბიუჯეტის გადამოწმებული მონაცემები: შემოსავლები, ხარჯები, მუნიციპალიტეტები, ვალი, დეფიციტი და ერთი წლის ანალიზი.",
  path: "/explorer",
});

export default async function ExplorerHubPage() {
  const [{ facts, sourceDocuments }, { countryTotalFacts }, { facts: debtFacts }, { facts: balanceFacts }] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
  ]);
  const municipalTotals = new Map<number, number>();
  for (const row of countryTotalFacts) {
    municipalTotals.set(row.year, row.publicTotalGel);
  }
  const lastUpdatedAt = [
    ...sourceDocuments.map((source) => source.lastReviewedAt),
    ...debtFacts.map((fact) => fact.lastReviewedAt),
    ...balanceFacts.map((fact) => fact.lastReviewedAt),
  ].sort().at(-1) ?? "";
  const cards = buildHubCards(facts, municipalTotals, debtFacts, balanceFacts);
  const years = Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b);
  const coverage = [
    years.length > 0 ? `${years[0]}–${years.at(-1)}` : "",
    lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      data-testid="explorer-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]"
    >
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }]} />
      <div className="mx-auto max-w-[1180px]">
        <LegacyHashRedirect />
        <PageHeader
          crumbs={[{ label: "მთავარი", href: "/" }, { label: "მონაცემები" }, { label: "ბიუჯეტი" }]}
          coverage={coverage}
        />
        <h1 className="mt-[22px] mb-2 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.15] tracking-[-0.01em]">
          საქართველოს ბიუჯეტი
        </h1>
        <p
          data-testid="explorer-hub-introduction"
          className="mb-[26px] max-w-[640px] text-[13.5px] leading-relaxed text-[var(--body)]"
        >
          Fiscal.ge აერთიანებს საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების, მთავრობის ვალისა და ზოგადი მთავრობის დეფიციტის გადამოწმებულ მონაცემებს.
          {" "}შეადარეთ წლები და მაჩვენებლები, ან ჩამოტვირთეთ მონაცემები Excel ფორმატში.
        </p>
        <BudgetHub cards={cards} />
        <div className="mt-[26px] max-w-[860px]">
          <SourceNote>
            მონაცემები: საქართველოს ფინანსთა სამინისტროს ოფიციალური დოკუმენტები და IMF-ის World Economic Outlook.
            {lastUpdatedAt ? (
              <>
                {" "}ბოლო განახლება: <span className="font-[family-name:var(--font-numeric)]">{lastUpdatedAt}</span>.
              </>
            ) : null}
          </SourceNote>
        </div>
      </div>
    </main>
  );
}
