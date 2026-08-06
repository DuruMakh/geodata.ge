import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../components/municipalities/municipal-explorer";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import {
  buildMunicipalListRows,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
} from "../../../../lib/explorer/municipalData";
import { georgianOrdinal } from "../../../../lib/explorer/municipalLabels";

// The 64 codes are the complete, closed set. Without this, an unknown code is
// left to request-time rendering instead of failing at build.
export const dynamicParams = false;

export async function generateStaticParams() {
  const { municipalities } = await loadServedMunicipalData();
  return municipalities.map((municipality) => ({ code: municipality.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { municipalities, totalFacts } = await loadServedMunicipalData();
  const municipality = municipalities.find((row) => row.code === code);
  if (!municipality) return {};

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const title = `${municipality.displayNameKa} — მუნიციპალიტეტები — GeoData`;
  const description = `${municipality.nameKa}ს ბიუჯეტი ფუნქციების მიხედვით, ${years[0]}–${years.at(-1)}.`;

  return {
    title,
    description,
    alternates: { canonical: `/explorer/municipalities/${code}` },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: `/explorer/municipalities/${code}`,
      title,
      description,
    },
  };
}

export default async function MunicipalityPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { municipalities, regions, functions, functionFacts, totalFacts } = await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const municipality = municipalities.find((row) => row.code === code);
  if (!municipality) notFound();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));

  const listInput = { municipalities, regionLabels, totalFacts, year: latestYear };
  const list = buildMunicipalListRows(listInput);
  const rank = list.municipalities.find((row) => row.id === code)?.rank ?? 0;
  const nationalTotalByYear = totalFacts.reduce<Record<number, number>>((totals, row) => {
    totals[row.year] = (totals[row.year] ?? 0) + row.publicTotalGel;
    return totals;
  }, {});

  // Only this municipality's rows travel to the client: ~110 function facts and
  // 11 total facts, not the 7,744-row corpus.
  const own = {
    functionFacts: functionFacts.filter((row) => row.municipalityCode === code),
    totalFacts: totalFacts.filter((row) => row.municipalityCode === code),
  };

  // Prev/next walk the registry's official sort order, which is roughly
  // region-grouped in the source, so stepping through stays geographic.
  const ordered = municipalities.slice().sort((left, right) => left.sortId - right.sortId);
  const index = ordered.findIndex((row) => row.code === code);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, own.functionFacts, own.totalFacts);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
            { label: municipality.displayNameKa },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          title="როგორ ხარჯავს ბიუჯეტს"
          triggerLabel={municipality.displayNameKa}
          entityId={code}
          metaLine={`${regionLabels.get(municipality.regionId) ?? ""} · ${georgianOrdinal(rank)} ადგილი ${municipalities.length}-დან ${latestYear} წელს`}
          functions={functions}
          functionFacts={own.functionFacts}
          totalFacts={own.totalFacts}
          sourceDocuments={sourceDocuments}
          nationalTotalByYear={nationalTotalByYear}
          rank={rank}
          rankOutOf={municipalities.length}
          showWarnings
          csvBasename={`municipality-${code}`}
          pickerGroups={buildPickerGroups(listInput)}
          prev={{ label: prev.displayNameKa, href: `/explorer/municipalities/${prev.code}` }}
          next={{ label: next.displayNameKa, href: `/explorer/municipalities/${next.code}` }}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). ოფიციალური ჯამი (ფინანსთა სამინისტრო) და ათი ფუნქციის ჯამი ორი განსხვავებული საზომია.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
