import Link from "next/link";
import type { MethodologyArchiveSummary, MethodologyContent } from "../../lib/methodology/types";
import { DecisionRecord } from "./decision-record";
import { MethodJourney } from "./method-journey";
import { SourceArchive, type PublicSourceManifestRow } from "./source-archive";

type MethodologyArticleProps = {
  content: MethodologyContent;
  coverage: { firstYear: number; lastYear: number };
  rows: readonly PublicSourceManifestRow[];
  archiveSummary: MethodologyArchiveSummary;
};

function sectionByKind(content: MethodologyContent, kind: MethodologyContent["sections"][number]["kind"]) {
  const section = content.sections.find((candidate) => candidate.kind === kind);
  if (!section) throw new Error(`Methodology content is missing the ${kind} section: ${content.id}`);
  return section;
}

function sectionAnchorId(section: MethodologyContent["sections"][number]) {
  return section.kind === "archive" ? "source-archive" : section.id;
}

export function MethodologyArticle({ content, coverage, rows, archiveSummary }: MethodologyArticleProps) {
  const journeyDescriptions = [
    sectionByKind(content, "archive").paragraphsKa[0],
    sectionByKind(content, "sources").paragraphsKa[0],
    sectionByKind(content, "classification").paragraphsKa[0],
    sectionByKind(content, "validation").paragraphsKa[0],
  ];

  return (
    <main className="@container mx-auto w-full max-w-[1240px] px-5 pt-8 min-[768px]:px-7 min-[768px]:pt-12">
      <nav aria-label="Breadcrumb" className="border-t-2 border-[var(--ink)] pt-3 text-[11px] text-[var(--muted)]">
        <Link href="/methodology" className="underline underline-offset-4 hover:text-[var(--accent)]">
          მეთოდოლოგია
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span>{content.titleKa}</span>
      </nav>

      <header className="border-b-2 border-[var(--ink)] pb-10 pt-9 min-[768px]:pb-14 min-[768px]:pt-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">მონაცემთა ტექნიკური საველე წიგნი</p>
        <h1 className="mt-4 max-w-[900px] text-balance font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.12] tracking-[-0.02em] min-[768px]:text-[52px]">
          {content.titleKa}
        </h1>
        <p className="mt-6 max-w-[790px] text-pretty text-[15px] leading-[1.8] text-[var(--body)]">{content.summaryKa}</p>
        <p className="mt-5 font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">
          ბოლო მეთოდოლოგიური განხილვა · {content.reviewedAt}
        </p>
      </header>

      <dl className="grid border-b border-[var(--ink)] min-[620px]:grid-cols-2 min-[1040px]:grid-cols-4">
        {content.keyFacts.map((fact) => (
          <div key={fact.labelKa} className="border-b border-[var(--hairline)] py-5 last:border-b-0 min-[620px]:px-4 min-[1040px]:border-b-0 min-[1040px]:border-r min-[1040px]:border-[var(--hairline)] min-[1040px]:first:pl-0 min-[1040px]:last:border-r-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{fact.labelKa}</dt>
            <dd className="mt-2 font-[family-name:var(--font-numeric)] text-[12px] leading-relaxed">
              {fact.valueKind === "coverage" ? `${coverage.firstYear}–${coverage.lastYear}` : fact.valueKa}
            </dd>
          </div>
        ))}
      </dl>

      <aside
        data-testid="methodology-disclosure"
        className="my-10 border-l-2 border-[var(--accent)] bg-[var(--tint)] px-5 py-5 min-[768px]:my-14 min-[768px]:px-7"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--accent)]">ოფიციალური ფაქტი და GeoData-ის მეთოდი</p>
        <p className="mt-3 max-w-[920px] text-[13.5px] leading-[1.75] text-[var(--body)]">{content.disclosureKa}</p>
      </aside>

      <div className="grid gap-12 @min-[1100px]:grid-cols-[220px_minmax(0,1fr)] @min-[1100px]:gap-16">
        <nav aria-label="გვერდის სარჩევი" className="border-t border-[var(--ink)] pt-4 @min-[1100px]:sticky @min-[1100px]:top-6 @min-[1100px]:self-start">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">სარჩევი</p>
          <ol className="mt-3">
            {content.sections.map((section, index) => (
              <li key={section.id} className="border-b border-[var(--hairline-soft)]">
                <a href={`#${sectionAnchorId(section)}`} className="grid grid-cols-[24px_1fr] gap-2 py-3 text-[11.5px] leading-relaxed text-[var(--body)] hover:text-[var(--accent)]">
                  <span className="font-[family-name:var(--font-numeric)] text-[9.5px] text-[var(--faint)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{section.titleKa}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0">
          {content.sections.map((section) => (
            <section
              key={section.id}
              id={sectionAnchorId(section)}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-6 border-t-2 border-[var(--ink)] py-10 first:pt-7 min-[768px]:py-14"
            >
              <h2
                id={`${section.id}-title`}
                className="scroll-mt-6 font-[family-name:var(--font-display)] text-[27px] font-semibold tracking-[-0.01em]"
              >
                {section.titleKa}
              </h2>
              <div className="mt-5 max-w-[800px] space-y-4 text-[13.5px] leading-[1.8] text-[var(--body)]">
                {section.paragraphsKa.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {section.kind === "journey" ? <MethodJourney descriptionsKa={journeyDescriptions} /> : null}
              {section.kind === "decisions" ? (
                <DecisionRecord
                  decisions={content.decisions}
                  technicalAppendix={content.technicalAppendix}
                  hiddenGroups={content.hiddenDecisionGroups}
                  showTechnicalAppendix={content.showTechnicalAppendix}
                />
              ) : null}
              {section.kind === "archive" ? (
                <SourceArchive datasetId={content.archiveManifestId} rows={rows} summary={archiveSummary} />
              ) : null}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
