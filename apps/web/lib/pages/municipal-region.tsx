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
import { ADJARA_REGION_ID, MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import {
  applyAdjaraBudgetAdjustment,
  aggregateFactsForEntity,
  buildCountryTotalByYear,
  buildMunicipalListRows,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
  regionFactsFor,
} from "../explorer/municipalData";
import { municipalRankLabel, REGION_GENITIVE_KA } from "../explorer/municipalLabels";
import { municipalityHrefForCode } from "../explorer/municipalityRoutes";
import { formatAmount, formatShare, formatDisplayDate } from "../explorer/format";
import { shareOfTotal } from "../explorer/share";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import {
  adjaraDescription,
  regionBudgetTitle,
  regionDescription,
} from "../seo/municipalMetadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// The 11 region ids are the complete, closed set.

export async function municipalRegionStaticParams() {
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

export async function municipalRegionMetadata(id: string, locale: Locale): Promise<Metadata> {
  const regionId = `region.${id}`;
  const data = await loadServedMunicipalData();
  const facts = buildRegionPageFacts(data, regionId);
  const presentation = await getMunicipalPresentation(data, locale);
  const { englishLabels } = presentation;
  const name = publicLabel(locale, facts.region.id, facts.regionName, englishLabels);
  const common = {
    name,
    firstYear: facts.firstYear,
    latestYear: facts.latestYear,
    latestTotalGel: facts.latestTotal.publicTotalGel,
    rank: facts.rank,
    rankOutOf: 11 as const,
  };
  const description =
    regionId === ADJARA_REGION_ID
      ? adjaraDescription({
          ...common,
          municipalityCount: facts.members.memberCodes.length,
        }, presentation)
      : regionDescription({
          ...common,
          largestCategory: publicLabel(locale, facts.largestFunction.id, facts.largestFunction.kaLabel, englishLabels),
          largestCategoryShare:
            facts.largestFunctionFact.amountGel / facts.latestTotal.publicTotalGel,
        }, presentation);

  return fiscalMetadata({ locale,
    title: regionBudgetTitle(name, facts.firstYear, facts.latestYear, presentation),
    description,
    path: `/explorer/municipalities/region/${id}`,
  });
}

export async function renderMunicipalRegion(id: string, locale: Locale) {
  const regionId = `region.${id}`;
  const [servedMunicipalData, landingData, functionalWorkbookSources, workbookSources, adjustmentWorkbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities", "municipal-functional", locale),
    loadWorkbookSources("municipalities", "municipal-total", locale),
    loadWorkbookSources("revenue", "revenue", locale),
  ]);
  const presentation = await getMunicipalPresentation(servedMunicipalData, locale);
  const { messages, englishLabels } = presentation;
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
  const name = publicLabel(locale, region.id, region.kaLabel, englishLabels);
  const grammaticalName = publicLabel(locale, region.id, regionName, englishLabels);
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
  const entityWorkbookSources = scopeMunicipalWorkbookSources(workbookSources, {
    municipalityCodes: members.memberCodes,
    includeAdjaraRepublic: regionId === ADJARA_REGION_ID,
  });
  const summary = regionId === ADJARA_REGION_ID
    ? message(messages, "municipal.adjaraSummary", { year: latestYear, amount: formatAmount(latestTotal.publicTotalGel, locale), count: regions.length, rank: municipalRankLabel(rank, locale), members: members.memberCodes.length })
    : message(messages, "municipal.regionSummary", { name: grammaticalName, year: latestYear, amount: formatAmount(latestTotal.publicTotalGel, locale), count: regions.length, rank: municipalRankLabel(rank, locale), function: publicLabel(locale, largestFunction.id, largestFunction.kaLabel, englishLabels), share: formatShare(shareOfTotal(largestFunctionFact.amountGel, latestTotal.publicTotalGel)) });

  const memberRows = list.municipalities
    .filter((row) => row.regionId === regionId)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const ordered = regions.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  const index = ordered.findIndex((row) => row.id === regionId);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;
  const hrefFor = (target: { id: string }) => pageHref(`/explorer/municipalities/region/${target.id.replace("region.", "")}`, locale);

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(
    sourceDocuments,
    members.functionFacts,
    own.totalFacts,
  );
  const commonDescriptionInput = {
    name: grammaticalName,
    firstYear,
    latestYear,
    latestTotalGel: latestTotal.publicTotalGel,
    rank,
    rankOutOf: 11 as const,
  };
  const description =
    regionId === ADJARA_REGION_ID
      ? adjaraDescription({
          ...commonDescriptionInput,
          municipalityCount: members.memberCodes.length,
        }, presentation)
      : regionDescription({
          ...commonDescriptionInput,
          largestCategory: publicLabel(locale, largestFunction.id, largestFunction.kaLabel, englishLabels),
          largestCategoryShare: largestFunctionFact.amountGel / latestTotal.publicTotalGel,
        }, presentation);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          origin: resolveSiteUrl(),
          path: `/explorer/municipalities/region/${id}`,
          name: message(messages, "municipal.regionDatasetName", { name: grammaticalName }),
          description,
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: name,
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }, { name: message(messages, "common.municipalities"), path: pageHref("/explorer/municipalities", locale) }, { name, path: pageHref(`/explorer/municipalities/region/${id}`, locale) }]} />
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
            { label: message(messages, "common.municipalities"), href: pageHref("/explorer/municipalities", locale) },
            { label: name },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? message(messages, "municipal.updated", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          presentation={presentation}
          title={message(messages, regionId === ADJARA_REGION_ID ? "municipal.adjaraHeading" : "municipal.howSpent")}
          triggerLabel={name}
          entityId={regionId}
          metaLine={message(messages, members.memberCodes.length === 1 ? "municipal.regionMetaOne" : "municipal.regionMeta", { members: members.memberCodes.length, rank: municipalRankLabel(rank, locale), count: regions.length }) + (regionId === ADJARA_REGION_ID ? message(messages, "municipal.adjaraMetaSuffix") : "")}
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
            prev: { label: publicLabel(locale, prev.id, prev.kaLabel, englishLabels), href: hrefFor(prev) },
            next: { label: publicLabel(locale, next.id, next.kaLabel, englishLabels), href: hrefFor(next) },
          }}
          summary={summary}
          sourceNote={message(messages, regionId === ADJARA_REGION_ID ? "municipal.adjaraSource" : "municipal.regionSource") + (lastUpdatedAt ? message(messages, "municipal.updatedNote", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : "")}
        >
          <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
            <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[22px] font-semibold">
              {message(messages, "municipal.regionMembers")}
            </h2>
            {memberRows.map((member) => (
              <a
                key={member.id}
                href={pageHref(municipalityHrefForCode(member.id), locale)}
                data-testid="region-member-row"
                className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2 text-[var(--ink)] no-underline hover:bg-[var(--tint)]"
              >
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
                  {String(member.rank).padStart(2, "0")}
                </span>
                <span className="truncate text-[12.5px]">{publicLabel(locale, member.id, member.nameKa, englishLabels)}</span>
                <span className="font-[family-name:var(--font-numeric)] text-[11.5px]">{formatAmount(member.valueGel, locale)}</span>
              </a>
            ))}
          </div>
        </MunicipalExplorer>
      </div>
    </main>
  );
}
