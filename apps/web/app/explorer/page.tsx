import { BudgetHub } from "../../components/hub/budget-hub";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { LegacyHashRedirect } from "../../components/shell/legacy-hash-redirect";
import { PageHeader } from "../../components/shell/page-header";
import { SourceNote } from "../../components/ui/editorial";
import { buildHubCards } from "../../lib/explorer/hubCards";
import { loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import { fiscalMetadata } from "../../lib/seo/metadata";

export const metadata = fiscalMetadata({
  title: "საქართველოს ბიუჯეტის მონაცემები | Fiscal.ge",
  description:
    "საქართველოს ბიუჯეტის გადამოწმებული მონაცემები: შემოსავლები, ხარჯები, მუნიციპალიტეტები და ერთი წლის ანალიზი.",
  path: "/explorer",
});

export default async function ExplorerHubPage() {
  const { facts, sourceDocuments } = await loadServedLandingData();
  const { countryTotalFacts } = await loadServedMunicipalData();
  const municipalTotals = new Map<number, number>();
  for (const row of countryTotalFacts) {
    municipalTotals.set(row.year, row.publicTotalGel);
  }
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const cards = buildHubCards(facts, municipalTotals);
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
        <p className="mb-[26px] max-w-[560px] text-[13.5px] leading-relaxed text-[var(--body)]">
          აირჩიეთ განყოფილება — ხარჯები, შემოსავლები, მუნიციპალიტეტების ბიუჯეტები ან ანალიზი.
        </p>
        <BudgetHub cards={cards} />
        <div className="mt-[26px] max-w-[860px]">
          <SourceNote>
            მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო).
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
