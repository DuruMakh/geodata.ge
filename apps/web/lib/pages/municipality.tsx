import type { Locale } from "../i18n/types";
import { getMunicipalPresentation } from "./municipal-presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../components/municipalities/municipal-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import {
  buildCountryTotalByYear,
  buildMunicipalListRows,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
  MUNICIPAL_PUBLIC_PAGE_COUNT,
} from "../explorer/municipalData";
import { formatAmount, formatShare, formatDisplayDate } from "../explorer/format";
import { municipalRankLabel } from "../explorer/municipalLabels";
import {
  MUNICIPALITY_ROUTES,
  municipalityCodeForSlug,
  municipalityHrefForCode,
} from "../explorer/municipalityRoutes";
import { shareOfTotal } from "../explorer/share";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../methodology/workbookSources";
import {
  coverageFromYears,
  fiscalMetadata,
  municipalityBudgetTitleKa,
} from "../seo/metadata";
import { municipalityDescription } from "../seo/municipalMetadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// The 64 public slugs are the complete, closed set. Without this, an unknown
// slug is left to request-time rendering instead of failing at build.

export async function municipalityStaticParams() {
  return MUNICIPALITY_ROUTES.map(({ slug }) => ({ slug }));
}

function requiredMunicipalityCode(slug: string): string {
  const code = municipalityCodeForSlug(slug);
  if (!code) notFound();
  return code;
}

function buildMunicipalityPageFacts(
  servedMunicipalData: Awaited<ReturnType<typeof loadServedMunicipalData>>,
  code: string,
) {
  const { municipalities, regions, functions, functionFacts, totalFacts } = servedMunicipalData;
  const municipality = municipalities.find((row) => row.code === code);
  if (!municipality) notFound();

  const { firstYear, lastYear: latestYear } = coverageFromYears(totalFacts);
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const rankByYear = Array.from(new Set(totalFacts.map((row) => row.year))).reduce<Record<number, number>>(
    (ranks, year) => {
      const yearList = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year });
      ranks[year] = yearList.municipalities.find((row) => row.id === code)?.rank ?? 0;
      return ranks;
    },
    {},
  );
  const own = {
    functionFacts: functionFacts.filter((row) => row.municipalityCode === code),
    totalFacts: totalFacts.filter((row) => row.municipalityCode === code),
  };
  const latestTotal = own.totalFacts.find((row) => row.year === latestYear)!;
  const largestFunctionFact = own.functionFacts
    .filter((row) => row.year === latestYear)
    .sort((left, right) => right.amountGel - left.amountGel)[0]!;
  const largestFunction = functions.find((row) => row.id === largestFunctionFact.categoryId)!;

  return {
    municipality,
    firstYear,
    latestYear,
    regionLabels,
    rankByYear,
    rank: rankByYear[latestYear] ?? 0,
    own,
    latestTotal,
    largestFunctionFact,
    largestFunction,
  };
}

export async function municipalityMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const code = requiredMunicipalityCode(slug);
  const data = await loadServedMunicipalData();
  const facts = buildMunicipalityPageFacts(data, code);
  const presentation = await getMunicipalPresentation(data, locale, code);
  const { messages, englishLabels } = presentation;
  return fiscalMetadata({ locale,
    title: locale === "ka" ? municipalityBudgetTitleKa(facts.municipality.nameKa, facts.firstYear, facts.latestYear) : message(messages, "municipal.metaMunicipalityTitle", { name: publicLabel(locale, `${code}.official-name`, facts.municipality.nameKa, englishLabels), first: facts.firstYear, last: facts.latestYear }),
    description: municipalityDescription({
      name: publicLabel(locale, `${code}.official-name`, facts.municipality.nameKa, englishLabels),
      firstYear: facts.firstYear,
      latestYear: facts.latestYear,
      latestTotalGel: facts.latestTotal.publicTotalGel,
      rank: facts.rank,
      rankOutOf: MUNICIPAL_PUBLIC_PAGE_COUNT,
      largestCategory: publicLabel(locale, facts.largestFunction.id, facts.largestFunction.kaLabel, englishLabels),
      largestCategoryShare: facts.largestFunctionFact.amountGel / facts.latestTotal.publicTotalGel,
    }, presentation),
    path: municipalityHrefForCode(code),
  });
}

export async function renderMunicipality(slug: string, locale: Locale) {
  const code = requiredMunicipalityCode(slug);
  const [servedMunicipalData, landingData, functionalWorkbookSources, workbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities", "municipal-functional", locale),
    loadWorkbookSources("municipalities", "municipal-total", locale),
  ]);
  const presentation = await getMunicipalPresentation(servedMunicipalData, locale, code);
  const { messages, englishLabels } = presentation;
  const { municipalities, regions, functions, totalFacts, countryTotalFacts, adjaraBudgetAdjustments } = servedMunicipalData;
  const { sourceDocuments } = landingData;
  const {
    municipality,
    firstYear,
    latestYear,
    regionLabels,
    rankByYear,
    rank,
    own,
    latestTotal,
    largestFunctionFact,
    largestFunction,
  } = buildMunicipalityPageFacts(servedMunicipalData, code);
  const entityWorkbookSources = scopeMunicipalWorkbookSources(workbookSources, {
    municipalityCodes: [code],
    includeAdjaraRepublic: false,
  });

  const region = regions.find((row) => row.id === municipality.regionId)!;
  const regionSlug = region.id.replace("region.", "");
  const regionPath = `/explorer/municipalities/region/${regionSlug}` as const;
  const name = publicLabel(locale, code, municipality.displayNameKa, englishLabels);
  const officialName = publicLabel(locale, `${code}.official-name`, municipality.nameKa, englishLabels);
  const regionName = publicLabel(locale, region.id, region.kaLabel, englishLabels);
  const regionBreadcrumbLabel = region.id === "region.tbilisi" ? message(messages, "municipal.tbilisiRegion") : regionName;

  const listInput = { municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year: latestYear };
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
  const summary = message(messages, "municipal.municipalitySummary", { name: officialName, year: latestYear, amount: formatAmount(latestTotal.publicTotalGel, locale), count: municipalities.length, rank: municipalRankLabel(rank, locale), function: publicLabel(locale, largestFunction.id, largestFunction.kaLabel, englishLabels), share: formatShare(shareOfTotal(largestFunctionFact.amountGel, latestTotal.publicTotalGel)) });

  // Prev/next walk the registry's official sort order, which is roughly
  // region-grouped in the source, so stepping through stays geographic.
  const ordered = municipalities.slice().sort((left, right) => left.sortId - right.sortId);
  const index = ordered.findIndex((row) => row.code === code);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, own.functionFacts, own.totalFacts);
  const description = municipalityDescription({
    name: officialName,
    firstYear,
    latestYear,
    latestTotalGel: latestTotal.publicTotalGel,
    rank,
    rankOutOf: MUNICIPAL_PUBLIC_PAGE_COUNT,
    largestCategory: publicLabel(locale, largestFunction.id, largestFunction.kaLabel, englishLabels),
    largestCategoryShare: largestFunctionFact.amountGel / latestTotal.publicTotalGel,
  }, presentation);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          origin: resolveSiteUrl(),
          path: municipalityHrefForCode(code),
          datasetId: "municipal-expenditure",
          partOfPath: "/explorer/municipalities",
          withinGeorgia: true,
          name: message(messages, "municipal.municipalityDatasetName", { name: officialName }),
          description,
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: officialName,
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }, { name: message(messages, "common.municipalities"), path: pageHref("/explorer/municipalities", locale) }, { name: regionBreadcrumbLabel, path: pageHref(regionPath, locale) }, { name, path: pageHref(municipalityHrefForCode(code), locale) }]} />
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
            { label: message(messages, "common.municipalities"), href: pageHref("/explorer/municipalities", locale) },
            { label: regionBreadcrumbLabel, href: pageHref(regionPath, locale) },
            { label: name },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? message(messages, "municipal.updated", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          presentation={presentation}
          title={message(messages, "municipal.howSpent")}
          triggerLabel={name}
          entityId={code}
          metaLine={message(messages, "municipal.municipalityMeta", { region: regionName, rank: municipalRankLabel(rank, locale), count: municipalities.length, year: latestYear })}
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
            prev: { label: publicLabel(locale, prev.code, prev.displayNameKa, englishLabels), href: pageHref(municipalityHrefForCode(prev.code), locale) },
            next: { label: publicLabel(locale, next.code, next.displayNameKa, englishLabels), href: pageHref(municipalityHrefForCode(next.code), locale) },
          }}
          summary={summary}
          sourceNote={message(messages, "municipal.source") + (lastUpdatedAt ? message(messages, "municipal.updatedNote", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : "")}
        />
      </div>
    </main>
  );
}
