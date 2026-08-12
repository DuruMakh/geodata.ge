import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../../components/municipalities/municipal-explorer";
import { PageHeader } from "../../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../../lib/data/servedData";
import {
  aggregateFactsForEntity,
  buildMunicipalListRows,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  regionFactsFor,
} from "../../../../../lib/explorer/municipalData";
import { georgianOrdinal, REGION_GENITIVE_KA } from "../../../../../lib/explorer/municipalLabels";
import { formatAmount } from "../../../../../lib/explorer/format";

const SOURCE_NOTE_BASE =
  "მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). " +
  "რეგიონის ჯამი მხოლოდ საჯაროდ მოწოდებულ მუნიციპალურ ბიუჯეტებს აერთიანებს: " +
  "აჭარის ავტონომიური რესპუბლიკის საკუთარი ბიუჯეტი მასში არ შედის, ხოლო შიდა ქართლსა და " +
  "მცხეთა-მთიანეთს ოკუპირებულ ტერიტორიებთან დაკავშირებული ერთეულები აკლია.";

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
  const title = `${region.kaLabel} — მუნიციპალიტეტები — GeoData`;
  const description = `${REGION_GENITIVE_KA[region.id] ?? region.kaLabel} მუნიციპალური ბიუჯეტები ფუნქციების მიხედვით, ${years[0]}–${years.at(-1)}.`;

  return {
    title,
    description,
    alternates: { canonical: `/explorer/municipalities/region/${id}` },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
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
  const { municipalities, regions, functions, functionFacts, totalFacts } = await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const region = regions.find((row) => row.id === regionId);
  if (!region) notFound();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((row) => [row.id, row.kaLabel]));

  const listInput = { municipalities, regionLabels, totalFacts, year: latestYear };
  const list = buildMunicipalListRows(listInput);
  const rankByYear = years.reduce<Record<number, number>>((ranks, year) => {
    const yearList = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year });
    ranks[year] = yearList.regions.find((row) => row.id === regionId)?.rank ?? 0;
    return ranks;
  }, {});
  const rank = rankByYear[latestYear] ?? 0;
  const nationalTotalByYear = totalFacts.reduce<Record<number, number>>((totals, row) => {
    totals[row.year] = (totals[row.year] ?? 0) + row.publicTotalGel;
    return totals;
  }, {});

  const members = regionFactsFor(regionId, municipalities, functionFacts, totalFacts);
  // Collapse the members' rows into one entity's on the SERVER, so this page
  // ships ~110 function rows like a municipality page rather than up to 12×.
  const own = aggregateFactsForEntity(regionId, members.functionFacts, members.totalFacts);

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
    members.totalFacts,
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
          title="როგორ ხარჯავს ბიუჯეტს"
          triggerLabel={region.kaLabel}
          entityId={regionId}
          metaLine={`${members.memberCodes.length} მუნიციპალიტეტი · ${georgianOrdinal(rank)} ადგილი ${regions.length}-დან`}
          functions={functions}
          functionFacts={own.functionFacts}
          totalFacts={own.totalFacts}
          sourceDocuments={sourceDocuments}
          nationalTotalByYear={nationalTotalByYear}
          rankByYear={rankByYear}
          rankOutOf={regions.length}
          csvBasename={`region-${id}`}
          pickerGroups={buildPickerGroups(listInput)}
          prev={{ label: prev.kaLabel, href: hrefFor(prev) }}
          next={{ label: next.kaLabel, href: hrefFor(next) }}
          sourceNote={`${SOURCE_NOTE_BASE}${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
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
