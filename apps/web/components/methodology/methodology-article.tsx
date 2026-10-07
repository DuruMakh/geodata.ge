import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale } from "../../lib/i18n/types";
import { METHODOLOGY_TRANSLATION_REVIEWED_AT } from "../../lib/methodology/content/en/revisions";
import { message } from "../../lib/i18n/messages";
import type { Messages } from "../../lib/i18n/types";
import type { MethodologyArchiveSummary, MethodologyContent } from "../../lib/methodology/types";
import type { BreadcrumbItem } from "../../lib/seo/structuredData";
import { BreadcrumbTrail } from "../seo/breadcrumb-json-ld";
import { DecisionRecord } from "./decision-record";
import { MethodJourney } from "./method-journey";
import { SourceArchive, type PublicSourceManifestRow } from "./source-archive";

type MethodologyArticleProps = {
  locale: Locale;
  messages: Messages;
  content: MethodologyContent;
  coverage: { firstYear: number; lastYear: number };
  rows: readonly PublicSourceManifestRow[];
  archiveSummary: MethodologyArchiveSummary;
  processedDataHref: `/downloads/data/${string}.csv` | null;
  processedDataJsonLinks: readonly { href: `/downloads/data/${string}.json`; label: string }[];
  breadcrumbItems: readonly BreadcrumbItem[];
};

function firstParagraphByKind(
  content: MethodologyContent,
  kind: MethodologyContent["sections"][number]["kind"],
  fallback: string,
) {
  return content.sections.find((candidate) => candidate.kind === kind)?.paragraphs[0] ?? fallback;
}

function sectionAnchorId(section: MethodologyContent["sections"][number]) {
  return section.kind === "archive" ? "source-archive" : section.id;
}

export function MethodologyArticle({ locale, messages, content, coverage, rows, archiveSummary, processedDataHref, processedDataJsonLinks, breadcrumbItems }: MethodologyArticleProps) {
  const journeyDescriptions = [
    firstParagraphByKind(content, "archive", content.summary),
    firstParagraphByKind(content, "sources", content.summary),
    firstParagraphByKind(content, "classification", content.disclosure),
    firstParagraphByKind(content, "validation", content.summary),
  ];

  return (
    <main className="@container mx-auto w-full max-w-[1240px] px-5 pt-8 min-[768px]:px-7 min-[768px]:pt-12">
      <BreadcrumbTrail items={breadcrumbItems} />

      <header className="border-b-2 border-[var(--ink)] pb-10 pt-9 min-[768px]:pb-14 min-[768px]:pt-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "methodology.articleOverline")}</p>
        <h1 className="mt-4 max-w-[900px] text-balance font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.12] tracking-[-0.02em] min-[768px]:text-[52px]">
          {content.title}
        </h1>
        <p className="mt-6 max-w-[790px] text-pretty text-[15px] leading-[1.8] text-[var(--body)]">{content.summary}</p>
        <p className="mt-5 font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10px] text-[var(--faint)]">
          {message(messages, "methodology.methodologyReviewed", { date: content.reviewedAt })}
        </p>
        {locale === "en" ? <p className="mt-2 font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10px] text-[var(--faint)]">{message(messages, "methodology.translationReviewed", { date: METHODOLOGY_TRANSLATION_REVIEWED_AT[content.id] })}</p> : null}
      </header>

      <dl className="grid border-b border-[var(--ink)] min-[620px]:grid-cols-2 min-[1040px]:grid-cols-4">
        {content.keyFacts.map((fact) => (
          <div key={fact.label} className="border-b border-[var(--hairline)] py-5 last:border-b-0 min-[620px]:px-4 min-[1040px]:border-b-0 min-[1040px]:border-r min-[1040px]:border-[var(--hairline)] min-[1040px]:first:pl-0 min-[1040px]:last:border-r-0">
            <dt className="text-[11px] min-[768px]:text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{fact.label}</dt>
            <dd className="mt-2 font-[family-name:var(--font-numeric)] text-[12px] leading-relaxed">
              {fact.valueKind === "coverage" ? `${coverage.firstYear}–${coverage.lastYear}` : fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {processedDataHref ? <div className="border-b border-[var(--ink)] py-6">
        <a
          data-testid="processed-dataset-download"
          href={processedDataHref}
          download
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)] underline underline-offset-4"
        >
          {message(messages, "methodology.processedDownload")}
        </a>
        <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
          {message(messages, "methodology.processedNote")}
        </p>
        {/* A dataset with no JSON publication would otherwise render this
            as a bare " - JSON: ..." trailer with nothing before the dash. */}
        {processedDataJsonLinks.length > 0 ? (
        <p data-testid="processed-dataset-json" className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
          {processedDataJsonLinks.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? " · " : null}
              {/* The visible text is the reviewed dataset name, not the Latin
                  file name: a link whose only accessible name is
                  "ministries.json" tells a screen-reader user nothing about
                  what they are downloading (DESIGN.md:624). */}
              <a href={link.href} download className="font-semibold text-[var(--accent)] underline underline-offset-4">
                {link.label}
              </a>
            </span>
          ))}
          {message(messages, "methodology.jsonNote")}
        </p>
        ) : null}
      </div> : null}

      <aside
        data-testid="methodology-disclosure"
        className="my-10 border-l-2 border-[var(--accent)] bg-[var(--tint)] px-5 py-5 min-[768px]:my-14 min-[768px]:px-7"
      >
        <p className="text-[11px] min-[768px]:text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--accent)]">{message(messages, "methodology.disclosureTitle")}</p>
        <p className="mt-3 max-w-[920px] text-[13.5px] leading-[1.75] text-[var(--body)]">{content.disclosure}</p>
      </aside>

      <div className="grid gap-12 @min-[1100px]:grid-cols-[220px_minmax(0,1fr)] @min-[1100px]:gap-16">
        <nav id="methodology-contents" aria-label={message(messages, "methodology.contentsAria")} className="scroll-mt-6 border-t border-[var(--ink)] pt-4 @min-[1100px]:sticky @min-[1100px]:top-6 @min-[1100px]:self-start">
          <p className="text-[11px] min-[768px]:text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{message(messages, "methodology.contents")}</p>
          <ol className="mt-3">
            {content.sections.map((section, index) => (
              <li key={section.id} className="border-b border-[var(--hairline-soft)]">
                <a href={`#${sectionAnchorId(section)}`} className="grid grid-cols-[24px_1fr] gap-2 py-3 text-[11.5px] leading-relaxed text-[var(--body)] hover:text-[var(--accent)]">
                  <span className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9.5px] text-[var(--faint)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{section.title}</span>
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
                {section.title}
              </h2>
              <div className="mt-5 max-w-[800px] space-y-4 text-[13.5px] leading-[1.8] text-[var(--body)]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {section.kind === "journey" ? <MethodJourney descriptions={journeyDescriptions} messages={messages} /> : null}
              {section.kind === "decisions" ? (
                <DecisionRecord
                  messages={messages}
                  decisions={content.decisions}
                  technicalAppendix={content.technicalAppendix}
                  hiddenGroups={content.hiddenDecisionGroups}
                  showTechnicalAppendix={content.showTechnicalAppendix}
                />
              ) : null}
              {section.kind === "archive" ? (
                <I18nProvider locale={locale} messages={messages}>
                  <SourceArchive datasetId={content.archiveManifestId} datasetLabel={content.title} rows={rows} summary={archiveSummary} />
                </I18nProvider>
              ) : null}
            </section>
          ))}
          {/* Below 1100px the contents list is not sticky and sits above a long
              article (DESIGN.md §21 asks for sticky contents), so a small button
              stays at the bottom of the screen while the article scrolls and
              jumps back to it. The zero-height wrapper sticks; the link sits above it. */}
          <div className="pointer-events-none sticky bottom-4 z-20 flex h-0 justify-end @min-[1100px]:hidden">
            <a
              href="#methodology-contents"
              data-testid="methodology-contents-jump"
              className="pointer-events-auto inline-flex min-h-11 -translate-y-full items-center border border-[var(--ink)] bg-[var(--paper)] px-3.5 text-[12px] font-semibold text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {message(messages, "methodology.contentsJump")}
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
