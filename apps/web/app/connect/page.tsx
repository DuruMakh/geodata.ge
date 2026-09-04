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

// Menu paths, not terminal commands. Both recipes below are what the owner
// actually clicked through in each application - Claude's was used to connect
// to this very endpoint, and Codex's dialog is the one that asks for a Name, a
// Type (STDIO or Streamable HTTP) and a URL. Advertise only what has been
// seen; menu names drift, so if a step stops matching, fix the step rather
// than retreating to "see your client's docs".
const CLIENTS = [
  {
    name: "Claude",
    note: "დესკტოპის აპლიკაცია და ვებგვერდი",
    steps: [
      "პარამეტრებში გახსენით Customize → Connectors.",
      "დააჭირეთ Add → Add custom connector.",
      "ჩასვით ზემოთ მოცემული მისამართი და დაადასტურეთ.",
    ],
  },
  {
    name: "Codex / ChatGPT",
    note: "Codex-ის აპლიკაცია",
    steps: [
      "გახსენით Settings → Plugins.",
      "დააჭირეთ Add → Add MCP server.",
      "Type-ში აირჩიეთ Streamable HTTP.",
      "URL-ის ველში ჩასვით ზემოთ მოცემული მისამართი. Bearer token და Headers ცარიელი დატოვეთ.",
    ],
  },
] as const;

// Ends at the colon on purpose: the colon already invites the question, so a
// [თქვენი კითხვა] placeholder would only be something to delete before typing.
const CHAT_PROMPT = "fiscal.ge-ის გამოქვეყნებულ მონაცემებზე დაყრდნობით მიპასუხე:";

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
            <p data-testid="connect-intro" className="mt-5 max-w-[760px] text-[16px] leading-[1.7] text-[var(--body)]">
              Fiscal.ge-ის გადამოწმებული საქართველოს მონაცემები თქვენს AI ასისტენტში.
            </p>
          </header>

          {/* The one thing this page exists to hand over. It gets the weight:
              tinted panel, larger type, and the question a reader asks at
              exactly this moment - do I need an account - answered as a label
              beside it rather than as a grey paragraph they would have to read
              to find out. Read-only is stated in the technical note at the
              foot of the page instead. */}
          <section className="mt-10 bg-[var(--tint)] px-6 py-7 min-[768px]:px-8 min-[768px]:py-8">
            <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              კავშირის მისამართი
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <code
                data-testid="connect-endpoint"
                className="break-all font-[family-name:var(--font-numeric)] text-[16px] font-semibold min-[768px]:text-[21px]"
              >
                {endpoint}
              </code>
              <CopyEndpoint endpoint={endpoint} />
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-[var(--body)]">
              <li>უფასოა</li>
              <li>ავტორიზაცია არ სჭირდება</li>
            </ul>
          </section>

          <section className="mt-12 border-t border-[var(--ink)] pt-5">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">როგორ დააკავშიროთ</h2>
            <div className="mt-6 grid gap-8 min-[900px]:grid-cols-2 min-[900px]:gap-12">
              {CLIENTS.map((client) => (
                <div key={client.name} data-testid="connect-client">
                  <h3 className="font-[family-name:var(--font-display)] text-[17px] font-semibold">{client.name}</h3>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">{client.note}</p>
                  <ol className="mt-3 grid gap-2 text-[13.5px] leading-[1.7] text-[var(--body)]">
                    {client.steps.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="font-[family-name:var(--font-numeric)] text-[var(--muted)]">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-[820px] text-[13px] leading-[1.8] text-[var(--muted)]">
              სხვა კლიენტებშიც იგივე მისამართი მუშაობს — თუ პროგრამა დისტანციურ (remote) MCP სერვერებს უჭერს მხარს,
              დაამატეთ ის ავტორიზაციის გარეშე. მენიუების სახელები კლიენტისა და ვერსიის მიხედვით იცვლება.
            </p>
          </section>

          {/* Asked for directly, and worth stating carefully. Without the
              connection an assistant can still read this site over the web -
              the pages, the methodology and the published files are all
              public. What it does not get that way is per-figure source
              resolution and the caveats, so it can quote a correct number with
              the wrong meaning attached. The prompt carries its own "say so if
              the figure is not there" clause, because that instruction is what
              makes the difference between a sourced answer and a guess. */}
          <section className="mt-10 border-t border-[var(--ink)] pt-5" data-testid="connect-without">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">
              დაკავშირების გარეშე, პირდაპირ ჩატში
            </h2>
            <p className="mt-4 max-w-[820px] text-[13.5px] leading-[1.8] text-[var(--body)]">
              თუ ასისტენტს ინტერნეტში ძებნა შეუძლია, უბრალოდ დაიწყეთ ასე:
            </p>
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <p
                data-testid="connect-prompt"
                className="max-w-[640px] bg-[var(--tint)] px-4 py-3 text-[14px] font-semibold leading-[1.75]"
              >
                „{CHAT_PROMPT}“
              </p>
              <CopyEndpoint
                endpoint={CHAT_PROMPT}
                testId="connect-copy-prompt"
                copyLabel="ტექსტის კოპირება"
                copiedLabel="ტექსტი დაკოპირდა"
              />
            </div>
            <p className="mt-4 max-w-[820px] text-[13px] leading-[1.8] text-[var(--muted)]">
              ასე ასისტენტი წაიკითხავს საიტის გვერდებს, მეთოდოლოგიას და გამოქვეყნებულ ფაილებს და ნამდვილ ციფრებს
              მოგცემთ. თუმცა ამ გზით ის ვერ იღებს იმას, რასაც კავშირი აძლევს — თითოეული ციფრის მიბმას თავის წყაროსთან
              და დათქმებს, მაგალითად იმას, რომ ორი წელი ერთმანეთს არ ედრება. ზუსტი ციტირებისთვის კავშირი სჯობს.
            </p>
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

          {/* Fine print, not a third column. It answers a developer's
              question, and the reader this page is written for is not one -
              giving it equal weight to the connection steps made the page
              look harder than it is. */}
          <section className="mt-12 border-t border-[var(--hairline)] pt-4" data-testid="connect-technical">
            <p className="max-w-[900px] text-[12px] leading-[1.9] text-[var(--muted)]">
              ტექნიკური დეტალები: სერვერი მხოლოდ კითხულობს მონაცემებს. პროტოკოლი — MCP Streamable HTTP, რევიზია
              2025-11-25. მუშაობს სესიის გარეშე
              და მხოლოდ POST მოთხოვნებზე. ინსტრუმენტების სიის მისაღებად გამოიძახეთ tools/list.
            </p>
          </section>
        </main>
        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </div>
  );
}
