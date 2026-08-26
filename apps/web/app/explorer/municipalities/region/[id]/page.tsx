import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../../components/municipalities/municipal-explorer";
import { BreadcrumbJsonLd } from "../../../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../../../components/seo/json-ld";
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
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
  regionFactsFor,
} from "../../../../../lib/explorer/municipalData";
import { georgianOrdinal, REGION_GENITIVE_KA } from "../../../../../lib/explorer/municipalLabels";
import { municipalityHrefForCode } from "../../../../../lib/explorer/municipalityRoutes";
import { formatAmount, formatShare } from "../../../../../lib/explorer/format";
import { shareOfTotal } from "../../../../../lib/explorer/share";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../../../../../lib/methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../../../../../lib/seo/metadata";
import {
  adjaraDescriptionKa,
  regionBudgetTitleKa,
  regionDescriptionKa,
} from "../../../../../lib/seo/municipalMetadata";
import { explorerDatasetJsonLd } from "../../../../../lib/seo/structuredData";
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

function buildRegionPageFacts(
  servedMunicipalData: Awaited<ReturnType<typeof loadServedMunicipalData>>,
  regionId: string,
) {
  const { municipalities, regions, functions, functionFacts, totalFacts, adjaraBudgetAdjustments } =
    servedMunicipalData;
  const region = regions.find((row) => row.id === regionId);
  if (!region) notFound();

  const { firstYear, lastYear: latestYear } = coverageFromYears(totalFacts);
  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const regionLabels = new Map(regions.map((row) => [row.id, row.kaLabel]));
  const listInput = { municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year: latestYear };
  const list = buildMunicipalListRows(listInput);
  const rankByYear = years.reduce<Record<number, number>>((ranks, year) => {
    const yearList = buildMunicipalListRows({
      municipalities,
      regionLabels,
      totalFacts,
      adjaraBudgetAdjustments,
      year,
    });
    ranks[year] = yearList.regions.find((row) => row.id === regionId)?.rank ?? 0;
    return ranks;
  }, {});
  const members = regionFactsFor(regionId, municipalities, functionFacts, totalFacts);
  const rolled = aggregateFactsForEntity(regionId, members.functionFacts, members.totalFacts);
  const own =
    regionId === ADJARA_REGION_ID
      ? {
          ...rolled,
          totalFacts: applyAdjaraBudgetAdjustment(rolled.totalFacts, adjaraBudgetAdjustments),
        }
      : rolled;
  const latestTotal = own.totalFacts.find((row) => row.year === latestYear)!;
  const largestFunctionFact = own.functionFacts
    .filter((row) => row.year === latestYear)
    .sort((left, right) => right.amountGel - left.amountGel)[0]!;
  const largestFunction = functions.find((row) => row.id === largestFunctionFact.categoryId)!;

  return {
    region,
    firstYear,
    latestYear,
    regionLabels,
    listInput,
    list,
    rankByYear,
    rank: rankByYear[latestYear] ?? 0,
    members,
    own,
    latestTotal,
    largestFunctionFact,
    largestFunction,
    regionName: REGION_GENITIVE_KA[regionId] ?? region.kaLabel,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const regionId = `region.${id}`;
  const facts = buildRegionPageFacts(await loadServedMunicipalData(), regionId);
  const common = {
    nameKa: facts.regionName,
    firstYear: facts.firstYear,
    latestYear: facts.latestYear,
    latestTotalGel: facts.latestTotal.publicTotalGel,
    rank: facts.rank,
    rankOutOf: 11 as const,
  };
  const description =
    regionId === ADJARA_REGION_ID
      ? adjaraDescriptionKa(common)
      : regionDescriptionKa({
          ...common,
          largestCategoryKa: facts.largestFunction.kaLabel,
          largestCategoryShare:
            facts.largestFunctionFact.amountGel / facts.latestTotal.publicTotalGel,
        });

  return fiscalMetadata({
    title: regionBudgetTitleKa(facts.regionName, facts.firstYear, facts.latestYear),
    description,
    path: `/explorer/municipalities/region/${id}`,
  });
}

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const regionId = `region.${id}`;
  const [servedMunicipalData, landingData, functionalWorkbookSources, workbookSources, adjustmentWorkbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities", "municipal-functional"),
    loadWorkbookSources("municipalities", "municipal-total"),
    loadWorkbookSources("revenue", "revenue"),
  ]);
  const { regions, functions, countryTotalFacts } = servedMunicipalData;
  const { sourceDocuments } = landingData;
  const {
    region,
    firstYear,
    latestYear,
    listInput,
    list,
    rankByYear,
    rank,
    members,
    own,
    latestTotal,
    largestFunctionFact,
    largestFunction,
    regionName,
  } = buildRegionPageFacts(servedMunicipalData, regionId);
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
  const entityWorkbookSources = scopeMunicipalWorkbookSources(workbookSources, {
    municipalityCodes: members.memberCodes,
    includeAdjaraRepublic: regionId === ADJARA_REGION_ID,
  });
  const summary =
    regionId === ADJARA_REGION_ID
      ? `აჭარის გაერთიანებული ბიუჯეტი ${latestYear} წელს ${formatAmount(latestTotal.publicTotalGel)} იყო — ${regions.length} რეგიონს შორის ${georgianOrdinal(rank)} ადგილი. ჯამი აერთიანებს ${members.memberCodes.length} მუნიციპალიტეტსა და აჭარის ა.რ. რესპუბლიკურ ბიუჯეტს, შიდა ტრანსფერების გამოკლებით.`
      : `${regionName} მუნიციპალიტეტების ჯამური ბიუჯეტი ${latestYear} წელს ${formatAmount(latestTotal.publicTotalGel)} იყო — ${regions.length} რეგიონს შორის ${georgianOrdinal(rank)} ადგილი. ყველაზე დიდი ფუნქციური მიმართულებაა ${largestFunction.kaLabel}, რომელიც ბიუჯეტის ${formatShare(shareOfTotal(largestFunctionFact.amountGel, latestTotal.publicTotalGel))}-ს შეადგენს.`;

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
  const commonDescriptionInput = {
    nameKa: regionName,
    firstYear,
    latestYear,
    latestTotalGel: latestTotal.publicTotalGel,
    rank,
    rankOutOf: 11 as const,
  };
  const description =
    regionId === ADJARA_REGION_ID
      ? adjaraDescriptionKa(commonDescriptionInput)
      : regionDescriptionKa({
          ...commonDescriptionInput,
          largestCategoryKa: largestFunction.kaLabel,
          largestCategoryShare: largestFunctionFact.amountGel / latestTotal.publicTotalGel,
        });

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: `/explorer/municipalities/region/${id}`,
          name: `${regionName} ბიუჯეტი`,
          description,
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: region.kaLabel,
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "მუნიციპალიტეტები", path: "/explorer/municipalities" }, { name: region.kaLabel, path: `/explorer/municipalities/region/${id}` }]} />
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
          metrics={{
            kind: "ranked",
            nationalTotalByYear,
            rankByYear,
            rankOutOf: regions.length,
          }}
          workbookBasename={`region-${id}`}
          workbookSources={entityWorkbookSources}
          functionalWorkbookSources={functionalWorkbookSources}
          supplementalWorkbookSources={regionId === ADJARA_REGION_ID ? adjustmentWorkbookSources : []}
          siteOrigin={resolveSiteUrl()}
          pickerCountry={{
            id: MUNICIPAL_COUNTRY_ID,
            nameKa: "საქართველო",
            valueGel: nationalTotalByYear[latestYear] ?? 0,
            budgetCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
          }}
          pickerGroups={buildPickerGroups(listInput)}
          navigation={{
            prev: { label: prev.kaLabel, href: hrefFor(prev) },
            next: { label: next.kaLabel, href: hrefFor(next) },
          }}
          summary={summary}
          sourceNote={`${regionId === ADJARA_REGION_ID ? ADJARA_SOURCE_NOTE : SOURCE_NOTE_BASE}${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        >
          <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
            <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[22px] font-semibold">
              რეგიონის მუნიციპალიტეტები
            </h2>
            {memberRows.map((member) => (
              <a
                key={member.id}
                href={municipalityHrefForCode(member.id)}
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
