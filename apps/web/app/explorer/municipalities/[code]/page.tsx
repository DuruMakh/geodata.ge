import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../components/municipalities/municipal-explorer";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import { MUNICIPAL_COUNTRY_ID } from "../../../../lib/data/municipal/types";
import {
  buildCountryTotalByYear,
  buildMunicipalListRows,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
} from "../../../../lib/explorer/municipalData";
import { formatAmount, formatShare } from "../../../../lib/explorer/format";
import { georgianOrdinal } from "../../../../lib/explorer/municipalLabels";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../../../../lib/methodology/workbookSources";
import {
  coverageFromYears,
  fiscalMetadata,
  municipalityBudgetTitleKa,
} from "../../../../lib/seo/metadata";
import { resolveSiteUrl } from "../../../../lib/siteUrl";

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

  const { firstYear, lastYear } = coverageFromYears(totalFacts);
  return fiscalMetadata({
    title: municipalityBudgetTitleKa(municipality.nameKa, firstYear, lastYear),
    description: `${municipality.nameKa}ს ფაქტობრივი ბიუჯეტი ფუნქციების მიხედვით, ${firstYear}–${lastYear}.`,
    path: `/explorer/municipalities/${code}`,
  });
}

export default async function MunicipalityPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [servedMunicipalData, landingData, functionalWorkbookSources, workbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities", "municipal-functional"),
    loadWorkbookSources("municipalities", "municipal-total"),
  ]);
  const { municipalities, regions, functions, functionFacts, totalFacts, countryTotalFacts, adjaraBudgetAdjustments } = servedMunicipalData;
  const { sourceDocuments } = landingData;

  const municipality = municipalities.find((row) => row.code === code);
  if (!municipality) notFound();
  const entityWorkbookSources = scopeMunicipalWorkbookSources(workbookSources, {
    municipalityCodes: [code],
    includeAdjaraRepublic: false,
  });

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const region = regions.find((row) => row.id === municipality.regionId)!;
  const regionSlug = region.id.replace("region.", "");
  const regionPath = `/explorer/municipalities/region/${regionSlug}` as const;
  const regionBreadcrumbLabel = region.id === "region.tbilisi" ? "თბილისის რეგიონი" : region.kaLabel;

  const listInput = { municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year: latestYear };
  const rankByYear = years.reduce<Record<number, number>>((ranks, year) => {
    const yearList = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year });
    ranks[year] = yearList.municipalities.find((row) => row.id === code)?.rank ?? 0;
    return ranks;
  }, {});
  const rank = rankByYear[latestYear] ?? 0;
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);

  // Only this municipality's rows travel to the client: ~110 function facts and
  // 11 total facts, not the 7,744-row corpus.
  const own = {
    functionFacts: functionFacts.filter((row) => row.municipalityCode === code),
    totalFacts: totalFacts.filter((row) => row.municipalityCode === code),
  };
  const latestTotal = own.totalFacts.find((row) => row.year === latestYear)!;
  const largestFunctionFact = own.functionFacts
    .filter((row) => row.year === latestYear)
    .sort((left, right) => right.amountGel - left.amountGel)[0]!;
  const largestFunction = functions.find((row) => row.id === largestFunctionFact.categoryId)!;
  const summary =
    `${municipality.nameKa}ს ბიუჯეტი ${latestYear} წელს ${formatAmount(latestTotal.publicTotalGel)} იყო — ` +
    `${municipalities.length} მუნიციპალიტეტს შორის ${georgianOrdinal(rank)} ადგილი. ` +
    `ყველაზე დიდი ფუნქციური მიმართულებაა ${largestFunction.kaLabel}, რომელიც ბიუჯეტის ` +
    `${formatShare(largestFunctionFact.amountGel / latestTotal.publicTotalGel)}-ს შეადგენს.`;

  // Prev/next walk the registry's official sort order, which is roughly
  // region-grouped in the source, so stepping through stays geographic.
  const ordered = municipalities.slice().sort((left, right) => left.sortId - right.sortId);
  const index = ordered.findIndex((row) => row.code === code);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, own.functionFacts, own.totalFacts);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "მუნიციპალიტეტები", path: "/explorer/municipalities" }, { name: regionBreadcrumbLabel, path: regionPath }, { name: municipality.displayNameKa, path: `/explorer/municipalities/${code}` }]} />
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
            { label: regionBreadcrumbLabel, href: regionPath },
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
          metrics={{
            kind: "ranked",
            nationalTotalByYear,
            rankByYear,
            rankOutOf: municipalities.length,
          }}
          workbookBasename={`municipality-${code}`}
          workbookSources={entityWorkbookSources}
          functionalWorkbookSources={functionalWorkbookSources}
          siteOrigin={resolveSiteUrl()}
          pickerCountry={{
            id: MUNICIPAL_COUNTRY_ID,
            nameKa: "საქართველო",
            valueGel: nationalTotalByYear[latestYear] ?? 0,
            budgetCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
          }}
          pickerGroups={buildPickerGroups(listInput)}
          navigation={{
            prev: { label: prev.displayNameKa, href: `/explorer/municipalities/${prev.code}` },
            next: { label: next.displayNameKa, href: `/explorer/municipalities/${next.code}` },
          }}
          summary={summary}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო).${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
