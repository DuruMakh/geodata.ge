import { BreadcrumbTrail } from "../../components/seo/breadcrumb-json-ld";
import { CopyEndpoint } from "../../components/connect/copy-endpoint";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
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
 * Year ranges come from the same catalogue the endpoint serves, so this page
 * cannot advertise coverage MCP does not have. DESIGN.md section 2.1: derive
 * coverage from loaded facts, never hardcode it.
 */
function coverageRanges(): Record<DatasetId, string> {
  const response = describeCoverage(loadPackagedSnapshot(), {});
  const ranges = {} as Record<DatasetId, string>;

  if (response.kind !== "error") {
    const { datasets } = response.data as { datasets: { datasetId: DatasetId; years: [number, number] }[] };
    for (const dataset of datasets) ranges[dataset.datasetId] = `${dataset.years[0]}–${dataset.years[1]}`;
  }

  return ranges;
}

const CLIENTS = [
  {
    name: "Claude (Desktop და Web)",
    steps:
      "გახსენით პარამეტრები → Connectors → Add custom connector. ჩასვით ზემოთ მოცემული მისამართი და შეინახეთ. ავტორიზაცია არ არის საჭირო — სერვისი საჯაროა.",
  },
  {
    name: "ChatGPT",
    steps:
      "პარამეტრებში აირჩიეთ Connectors → Add. ჩასვით მისამართი, დაადასტურეთ, და ბიუჯეტის ინსტრუმენტები ხელმისაწვდომი გახდება საუბარში.",
  },
  {
    name: "სხვა MCP კლიენტები",
    steps:
      "სერვისი იყენებს MCP Streamable HTTP პროტოკოლს (რევიზია 2025-11-25). დაამატეთ მისამართი როგორც დისტანციური MCP სერვერი; სესია და ავტორიზაცია არ გამოიყენება.",
  },
] as const;

const EXAMPLES = [
  "რამდენი დაიხარჯა ჯანდაცვაზე 2025 წელს და საიდან მოდის ეს ციფრი?",
  "შეადარე განათლების ხარჯი 2015 და 2024 წლებში.",
  "რომელ მუნიციპალიტეტს აქვს ყველაზე მაღალი ბიუჯეტი ერთ მცხოვრებზე?",
  "რამდენი იყო ხულოს ბიუჯეტი 2024 წელს?",
  "როგორია ჯანდაცვის ხარჯის წილი მშპ-ში?",
] as const;

const NOT_SERVED = [
  "კვარტალური და თვიური მონაცემები — მხოლოდ წლიური ინფორმაციაა გადამოწმებული",
  "სახელმწიფო ვალი",
  "ცალკეული კაპიტალური პროექტები და შესყიდვები",
  "მიმდინარე წლის მიმდინარე შესრულება",
] as const;

export default async function ConnectPage() {
  const model = buildLandingContext(await loadServedLandingData());
  const ranges = coverageRanges();
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

          <section className="mt-10 border-t border-[var(--ink)] pt-5">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">
              შეკითხვების მაგალითები
            </h2>
            <ul className="mt-4 grid max-w-[900px] gap-2">
              {EXAMPLES.map((example) => (
                <li
                  key={example}
                  data-testid="connect-example"
                  className="text-[13.5px] leading-[1.8] text-[var(--body)]"
                >
                  „{example}“
                </li>
              ))}
            </ul>
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
                  <li>სახელმწიფო ბიუჯეტის შემოსავლები — {ranges["national-revenue"]}</li>
                  <li>სახელმწიფო ბიუჯეტის ხარჯები — {ranges["national-expenditure"]}</li>
                  <li>უწყებები და ძირითადი პროგრამები — {ranges.ministries}</li>
                  <li>მუნიციპალური ხარჯები, 64 მუნიციპალიტეტი და 11 რეგიონი — {ranges["municipal-expenditure"]}</li>
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
                  თუ შეკითხვა ამ ჩამონათვალს ეხება, ასისტენტი პასუხს არ გამოიგონებს — ის გეტყვით, რომ მონაცემი არ
                  არსებობს.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10 border-t border-[var(--ink)] pt-5">
            <h2 className="font-[family-name:var(--font-display)] text-[23px] font-semibold">
              მონაცემები ფაილების სახით
            </h2>
            <p className="mt-3 max-w-[760px] text-[13.5px] leading-[1.8] text-[var(--body)]">
              თუ AI-კავშირი არ გჭირდებათ, იგივე მონაცემები ხელმისაწვდომია ჩამოსატვირთად —{" "}
              <a
                href="/downloads/data/manifest.json"
                className="font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                მონაცემთა მანიფესტი
              </a>{" "}
              ჩამოთვლის ყველა გამოქვეყნებულ ფაილს წყაროებით, დათქმებითა და დაფარვით. ლიცენზია — CC BY 4.0.
            </p>
          </section>
        </main>
        <SiteFooter updatedAt={model.updatedAt} />
      </div>
    </div>
  );
}
