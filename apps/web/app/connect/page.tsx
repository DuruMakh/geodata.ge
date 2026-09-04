import { BreadcrumbTrail } from "../../components/seo/breadcrumb-json-ld";
import { CopyEndpoint } from "../../components/connect/copy-endpoint";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import type { CoverageData } from "../../lib/factQuery/describeCoverage";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { loadServedLandingData } from "../../lib/data/servedData";
import { buildLandingContext } from "../../lib/landing/landingData";
import { fiscalMetadata } from "../../lib/seo/metadata";
import { resolveSiteUrl } from "../../lib/siteUrl";
import type { DatasetId } from "../../lib/factQuery/types";

export const metadata = fiscalMetadata({
  title: "AI-კავშირი — საქართველოს ბიუჯეტის მონაცემები თქვენს ასისტენტში",
  description:
    "დააკავშირეთ თქვენი AI ასისტენტი Fiscal.ge-ის გადამოწმებულ საბიუჯეტო მონაცემებთან: ყოველი ციფრი წყაროთი, დათქმებითა და ზუსტად მითითებული დაფარვით.",
  path: "/connect",
});

/**
 * Everything this page claims about coverage comes from the same catalogue the
 * endpoint serves, so it cannot advertise something MCP does not have.
 * DESIGN.md section 2.1: derive coverage from loaded facts, never hardcode it.
 * That applies to the counts as much as to the years - a stale "64
 * municipalities" is the same class of error as a stale year range.
 */
function coverage(): {
  ranges: Record<DatasetId, string>;
  municipalities: number;
  regions: number;
  excludedCodes: string[];
} {
  const snapshot = loadPackagedSnapshot();
  const response = describeCoverage(snapshot, {});
  // The input is a literal `{}`, so this cannot fail today. Throwing rather
  // than falling back to blank years means that if it ever can, the build
  // stops instead of quietly publishing a coverage claim with the numbers
  // missing from it.
  if (response.kind === "error") throw new Error(`coverage unavailable: ${response.error.code}`);

  const { datasets, exclusions } = response.data as CoverageData;
  const ranges = {} as Record<DatasetId, string>;
  for (const dataset of datasets) ranges[dataset.datasetId] = `${dataset.years[0]}–${dataset.years[1]}`;

  return {
    ranges,
    municipalities: snapshot.municipal.municipalities.length,
    regions: snapshot.municipal.regions.length,
    excludedCodes: exclusions.map((exclusion) => exclusion.entityId),
  };
}

// Deliberately not a per-client click-path. Plan Task 9 Step 3: advertise only
// tested compatibility, and no client has yet been tested against the deployed
// endpoint. Menu names also differ by client, plan and version, so a confident
// three-step recipe that turns out to be wrong is worse than an honest one
// that says where to look.
const CLIENTS = [
  {
    name: "კლიენტები, რომლებსაც MCP-ის მხარდაჭერა აქვთ",
    steps:
      "ასეთი კლიენტები — მაგალითად Claude და ChatGPT — დისტანციურ სერვერებს პარამეტრებში, განყოფილებაში Connectors, ამატებენ. ზუსტი გზა და ხელმისაწვდომობა კლიენტისა და გეგმის მიხედვით განსხვავდება; იხილეთ კლიენტის დოკუმენტაცია.",
  },
  {
    name: "რა უნდა დაამატოთ",
    steps:
      "დაამატეთ ზემოთ მოცემული მისამართი როგორც დისტანციური (remote) MCP სერვერი. ავტორიზაცია და API-გასაღები არ გამოიყენება.",
  },
  {
    name: "ტექნიკური დეტალები",
    steps:
      "პროტოკოლი — MCP Streamable HTTP, რევიზია 2025-11-25. მუშაობს სესიის გარეშე და მხოლოდ POST მოთხოვნებზე. ინსტრუმენტების სიის მისაღებად გამოიძახეთ tools/list.",
  },
] as const;

const NOT_SERVED = [
  "კვარტალური და თვიური მონაცემები — მხოლოდ წლიური ინფორმაციაა გადამოწმებული",
  "სახელმწიფო ვალი",
  "ცალკეული კაპიტალური პროექტები და შესყიდვები",
  "მიმდინარე წლის მიმდინარე შესრულება",
] as const;

export default async function ConnectPage() {
  const model = buildLandingContext(await loadServedLandingData());
  const { ranges, municipalities, regions, excludedCodes } = coverage();
  const endpoint = `${resolveSiteUrl()}/mcp`;

  return (
    <div className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]">
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader yearsLabel={model.yearsLabel} testId="connect-header" />
        <main className="pt-10 min-[768px]:pt-16">
          <BreadcrumbTrail items={[{ name: "მთავარი", path: "/" }, { name: "AI-კავშირი", path: "/connect" }]} />

          <header className="border-t-2 border-[var(--ink)] pt-8">
            <h1 className="max-w-[860px] font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.12] min-[768px]:text-[52px]">
              დააკავშირეთ თქვენი AI ასისტენტი
            </h1>
            <p
              data-testid="connect-intro"
              className="mt-5 max-w-[760px] text-[15px] leading-[1.8] text-[var(--body)]"
            >
              Fiscal.ge-ის გადამოწმებული საბიუჯეტო მონაცემები პირდაპირ თქვენს AI ასისტენტში. დასვით შეკითხვა ჩვეულებრივი
              ენით — პასუხი დაეყრდნობა მხოლოდ ოფიციალურ, გადამოწმებულ ციფრებს, და თითოეულ მათგანს თან ახლავს წყარო და
              შესაბამისი შეზღუდვები. სერვისი უფასოა და ავტორიზაციას არ საჭიროებს.
            </p>
          </header>

          <section className="mt-12 border-t border-[var(--ink)] pt-5">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">კავშირის მისამართი</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <code
                data-testid="connect-endpoint"
                className="break-all bg-[var(--tint)] px-3 py-2 font-[family-name:var(--font-numeric)] text-[13px]"
              >
                {endpoint}
              </code>
              <CopyEndpoint endpoint={endpoint} />
            </div>
            <p className="mt-3 max-w-[760px] text-[13px] leading-relaxed text-[var(--muted)]">
              მისამართი მუშაობს MCP Streamable HTTP პროტოკოლით. ის მხოლოდ კითხულობს მონაცემებს — ჩაწერა, წაშლა ან
              რაიმე სხვა ცვლილება შეუძლებელია.
            </p>
          </section>

          <section className="mt-10 border-t border-[var(--ink)] pt-5">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">როგორ დააკავშიროთ</h2>
            <div className="mt-5 grid gap-8 min-[900px]:grid-cols-3">
              {CLIENTS.map((client) => (
                <div key={client.name} data-testid="connect-client">
                  <h3 className="text-[14px] font-semibold">{client.name}</h3>
                  <p className="mt-2 text-[13px] leading-[1.8] text-[var(--body)]">{client.steps}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Spec 12.3: naming what is NOT served is what stops someone asking
              for quarterly data, getting nothing, and concluding the tool is
              broken. It belongs beside the coverage, not in a FAQ. */}
          <section className="mt-10 border-t border-[var(--ink)] pt-5">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">რა მონაცემები მოიცავს</h2>
            <div className="mt-5 grid gap-8 min-[900px]:grid-cols-2">
              <div data-testid="connect-coverage-served">
                <h3 className="text-[14px] font-semibold">ხელმისაწვდომია</h3>
                <ul className="mt-2 grid gap-1.5 text-[13px] leading-[1.8] text-[var(--body)]">
                  {/* "ნაერთი ბიუჯეტის შემოსულობები", not "სახელმწიფო ბიუჯეტის
                      შემოსავლები": revenue is consolidated budget receipts while
                      expenditure is state-budget expenditure. Two different accounting
                      boundaries - which is exactly why subtracting one total from the
                      other does not give a deficit, the distinction budget_scopes_differ
                      exists to carry. The page addressing AI clients is the last place
                      that should blur it. Wording matches
                      lib/methodology/content/revenue.ts. */}
                  <li>ნაერთი ბიუჯეტის შემოსულობები — {ranges["national-revenue"]}</li>
                  <li>სახელმწიფო ბიუჯეტის ხარჯები — {ranges["national-expenditure"]}</li>
                  <li>უწყებები და ძირითადი პროგრამები — {ranges.ministries}</li>
                  <li>
                    მუნიციპალური ხარჯები, {municipalities} მუნიციპალიტეტი და {regions} რეგიონი —{" "}
                    {ranges["municipal-expenditure"]}
                  </li>
                </ul>
              </div>
              <div data-testid="connect-coverage-excluded">
                <h3 className="text-[14px] font-semibold">არ მოიცავს</h3>
                <ul className="mt-2 grid gap-1.5 text-[13px] leading-[1.8] text-[var(--body)]">
                  {NOT_SERVED.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  ასევე კოდები {excludedCodes.join(", ")} — ამ კოდების ბიუჯეტი ტერიტორიულად მიკუთვნებადი ხარჯი არ
                  არის, ამიტომ ასეთ კოდზე დასმულ შეკითხვას ციფრის ნაცვლად განმარტება უბრუნდება.
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  თუ შეკითხვა ამ ჩამონათვალს ეხება, ასისტენტი პასუხს არ გამოიგონებს — ის გეტყვით, რომ მონაცემი არ
                  არსებობს.
                </p>
              </div>
            </div>
          </section>
        </main>
        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </div>
  );
}
