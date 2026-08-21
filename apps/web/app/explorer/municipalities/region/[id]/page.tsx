import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../../components/municipalities/municipal-explorer";
import { PageHeader } from "../../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../../lib/data/servedData";
import { ADJARA_REGION_ID, MUNICIPAL_COUNTRY_ID } from "../../../../../lib/data/municipal/types";
import {
  applyAdjaraBudgetAdjustment,
  aggregateFactsForEntity,
  buildCountryTotalByYear,
  buildMunicipalListRows,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  regionFactsFor,
} from "../../../../../lib/explorer/municipalData";
import { georgianOrdinal, REGION_GENITIVE_KA } from "../../../../../lib/explorer/municipalLabels";
import { formatAmount } from "../../../../../lib/explorer/format";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../../../../../lib/methodology/workbookSources";
import { resolveSiteUrl } from "../../../../../lib/siteUrl";

const SOURCE_NOTE_BASE =
  "მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). " +
  "რეგიონის ჯამი მხოლოდ საჯაროდ მოწოდებულ მუნიციპალურ ბიუჯეტებს აერთიანებს: " +
  "შიდა ქართლსა და მცხეთა-მთიანეთს ოკუპირებულ ტერიტორიებთან დაკავშირებული ერთეულები აკლია.";

const ADJARA_SOURCE_NOTE =
  "აჭარის გაერთიანებული ბიუჯეტი აერთიანებს აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივ გადასახდელებსა და ექვსი მუნიციპალიტეტის ბიუჯეტებს; მუნიციპალიტეტებზე გადაცემული ტრანსფერები გამოკლებულია, რათა თანხა ორჯერ არ დაითვალოს. ფუნქციური სერიები მხოლოდ მუნიციპალიტეტების კლასიფიცირებულ ხარჯებს ასახავს.";

// The 11 region ids are the complete, closed set.
export const dynamicParams = false;

export async function generateStaticParams() {
  const { regions } = await loadServedMunicipalData();
  return regions.map((region) => ({ id: region.id.replace("region.", "") }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { regions, totalFacts } = await loadServedMunicipalData();
  const region = regions.find((row) => row.id === `region.${id}`);
  if (!region) return {};

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const title = `${region.kaLabel} — მუნიციპალიტეტები — Fiscal.ge`;
  const description =
    region.id === ADJARA_REGION_ID
      ? `აჭარის გაერთიანებული ბიუჯეტი — რესპუბლიკური და მუნიციპალური გადასახდელები შიდა ტრანსფერების გამოკლებით, ${years[0]}–${years.at(-1)}.`
      : `${REGION_GENITIVE_KA[region.id] ?? region.kaLabel} მუნიციპალური ბიუჯეტები ფუნქციების მიხედვით, ${years[0]}–${years.at(-1)}.`;

  return {
    title,
    description,
    alternates: { canonical: `/explorer/municipalities/region/${id}` },
    openGraph: {
      type: "website",
      siteName: "Fiscal.ge",
      locale: "ka_GE",
      url: `/explorer/municipalities/region/${id}`,
      title,
      description,
    },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const regionId = `region.${id}`;
  const [servedMunicipalData, landingData, workbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities"),
  ]);
  const { municipalities, regions, functions, functionFacts, totalFacts, countryTotalFacts, adjaraBudgetAdjustments } = servedMunicipalData;
  const { sourceDocuments } = landingData;

  const region = regions.find((row) => row.id === regionId);
  if (!region) notFound();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((row) => [row.id, row.kaLabel]));

  const listInput = { municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year: latestYear };
  const list = buildMunicipalListRows(listInput);
  const rankByYear = years.reduce<Record<number, number>>((ranks, year) => {
    const yearList = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year });
    ranks[year] = yearList.regions.find((row) => row.id === regionId)?.rank ?? 0;
    return ranks;
  }, {});
  const rank = rankByYear[latestYear] ?? 0;
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);

  const members = regionFactsFor(regionId, municipalities, functionFacts, totalFacts);
  const entityWorkbookSources = scopeMunicipalWorkbookSources(workbookSources, {
    municipalityCodes: members.memberCodes,
    includeAdjaraRepublic: regionId === ADJARA_REGION_ID,
  });
  // Collapse the members' rows into one entity's on the SERVER, so this page
  // ships ~110 function rows like a municipality page rather than up to 12×.
  const rolled = aggregateFactsForEntity(regionId, members.functionFacts, members.totalFacts);
  const own =
    regionId === ADJARA_REGION_ID
      ? {
          ...rolled,
          totalFacts: applyAdjaraBudgetAdjustment(rolled.totalFacts, adjaraBudgetAdjustments),
        }
      : rolled;

  const memberRows = list.municipalities
    .filter((row) => row.regionId === regionId)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const ordered = regions.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  const index = ordered.findIndex((row) => row.id === regionId);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;
  const hrefFor = (target: { id: string }) => `/explorer/municipalities/region/${target.id.replace("region.", "")}`;

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(
    sourceDocuments,
    members.functionFacts,
    own.totalFacts,
  );

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
            { label: region.kaLabel },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          title={regionId === ADJARA_REGION_ID ? "გაერთიანებული ბიუჯეტი —" : "როგორ ხარჯავს ბიუჯეტს"}
          triggerLabel={region.kaLabel}
          entityId={regionId}
          metaLine={`${members.memberCodes.length} მუნიციპალიტეტი · ${georgianOrdinal(rank)} ადგილი ${regions.length}-დან${regionId === ADJARA_REGION_ID ? " · შიდა ტრანსფერების გარეშე" : ""}`}
          functions={functions}
          functionFacts={own.functionFacts}
          totalFacts={own.totalFacts}
          sourceDocuments={sourceDocuments}
          metrics={{
            kind: "ranked",
            nationalTotalByYear,
            rankByYear,
            rankOutOf: regions.length,
          }}
          workbookBasename={`region-${id}`}
          workbookSources={entityWorkbookSources}
          siteOrigin={resolveSiteUrl()}
          pickerCountry={{
            id: MUNICIPAL_COUNTRY_ID,
            nameKa: "საქართველო",
            valueGel: nationalTotalByYear[latestYear] ?? 0,
            budgetCount: 69,
          }}
          pickerGroups={buildPickerGroups(listInput)}
          navigation={{
            prev: { label: prev.kaLabel, href: hrefFor(prev) },
            next: { label: next.kaLabel, href: hrefFor(next) },
          }}
          sourceNote={`${regionId === ADJARA_REGION_ID ? ADJARA_SOURCE_NOTE : SOURCE_NOTE_BASE}${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        >
          <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
            <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[22px] font-semibold">
              რეგიონის მუნიციპალიტეტები
            </h2>
            {memberRows.map((member) => (
              <a
                key={member.id}
                href={`/explorer/municipalities/${member.id}`}
                data-testid="region-member-row"
                className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2 text-[var(--ink)] no-underline hover:bg-[var(--tint)]"
              >
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
                  {String(member.rank).padStart(2, "0")}
                </span>
                <span className="truncate text-[12.5px]">{member.nameKa}</span>
                <span className="font-[family-name:var(--font-numeric)] text-[11.5px]">{formatAmount(member.valueGel)}</span>
              </a>
            ))}
          </div>
        </MunicipalExplorer>
      </div>
    </main>
  );
}
