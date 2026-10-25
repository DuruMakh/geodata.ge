import Link from "next/link";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../seo/breadcrumb-json-ld";
import { PageHeader } from "../shell/page-header";
import { GROUP_ICONS } from "../shell/group-icons";
import { Sparkline } from "../ui/sparkline";
import { splitValue, type GroupHeadline } from "../../lib/explorer/groupHeadlines";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import type { RegionSpread } from "../../lib/explorer/regionSpread";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";
import type { GroupId, TopicId } from "../../lib/navigation/navTree";
import { CARD_GRID_CLASS, ExplorerCard, leadSpan } from "./explorer-card";
import { GroupTopicScroll, TOPIC_LINKS_ID } from "./group-topic-scroll";

// A group page (spec 2026-10-24-explorer-regroup §5, prototype `dx-hub-h1`, `dx-stats`, `dx-tabs`, `dx-topic`, `dx-grid`): the breadcrumb
// row with the group's meta line, the icon and H1, one line, the four headline numbers, the topic links of a group with more
// than one topic, then one section of cards per topic. Rendered on the server; only the forwarded-topic scroll runs in the browser.

/** One topic's section: its heading row and line (shown only in a group of several topics), and its cards with each Regions card's spread. */
export type GroupTopicSection = { topic: TopicId; label: string; meta: string; line: string | null; cards: HubCardModel[]; spreads: (RegionSpread | null)[] };

type GroupPageProps = {
  locale: Locale;
  /** `common` and `groups`. */
  messages: Messages;
  group: GroupId;
  href: `/${string}`;
  name: string;
  line: string;
  meta: string;
  headlines: GroupHeadline[];
  topics: GroupTopicSection[];
  /** How many regions a Regions card without a spread names. */
  regionCount: number;
};

const NUMERIC = "font-[family-name:var(--font-numeric)]";

// Four columns from 1101px, two below, each column ruled off from the next (prototype `dx-stat`).
const HEADLINE_CLASS = [
  "group block min-w-0 border-[var(--hairline-soft)] pt-4 pb-3.5 text-[var(--ink)] no-underline",
  "max-[1101px]:pr-3 max-[1101px]:odd:mr-3 max-[1101px]:odd:border-r max-[1101px]:nth-[n+3]:border-t",
  "min-[1101px]:mr-[22px] min-[1101px]:border-r min-[1101px]:pr-[22px] min-[1101px]:last:mr-0 min-[1101px]:last:border-r-0",
].join(" ");

// The topic links' edge fade, from 900px: shown where more links lie beyond that edge. It stops above the row's bottom rule.
const EDGE_FADE = "pointer-events-none absolute top-0 bottom-px w-10 from-[var(--paper)] to-transparent opacity-0 transition-opacity duration-150 motion-reduce:transition-none max-[900px]:hidden";

function Headline({ headline, locale }: { headline: GroupHeadline; locale: Locale }) {
  const { figure, unit } = splitValue(headline.value);
  return (
    <Link href={pageHref(headline.href, locale)} prefetch={false} data-testid="group-headline" className={HEADLINE_CLASS}>
      <span className="block text-[12.5px] leading-[1.35] text-[var(--body)] group-hover:text-[var(--ink)] group-hover:underline group-hover:decoration-[var(--accent)] group-hover:underline-offset-[3px] max-[1101px]:min-h-[2.7em]">
        {headline.label}
      </span>
      <span className={`mt-1.5 block ${NUMERIC} text-[27px] leading-[1.1] font-semibold tracking-[-0.02em] max-[1101px]:text-[22px]`}>
        {/* The figure and the unit each stay whole; the unit is set smaller (DESIGN.md §5.2), so the pair fits one line at 1440 and
            1024px. Only where a long unit cannot fit beside its figure does it move, whole, under it. */}
        <span data-testid="group-headline-figure" className="whitespace-nowrap">{figure}</span>
        {unit ? (
          <span className="text-[13px] font-normal tracking-normal text-[var(--body)]">
            {" "}
            <span data-testid="group-headline-unit" className="whitespace-nowrap">{unit}</span>
          </span>
        ) : null}
        {/* The period may go to the next line instead of the unit. Its gap is a leading space, not a margin, so the break takes it. */}
        <small className="text-[11.5px] font-normal tracking-normal text-[var(--faint)]">{` ${headline.period}`}</small>
      </span>
      {headline.caption ? <span className="mt-1 block text-[11.5px] leading-snug text-[var(--muted)]">{headline.caption}</span> : null}
      {headline.series ? (
        <span aria-hidden className="mt-2.5 block h-6 [&>svg]:mt-0 [&>svg]:h-full [&>svg]:w-full">
          <Sparkline values={headline.series} color="var(--control)" width={200} height={24} fluidOnMobile />
        </span>
      ) : null}
    </Link>
  );
}

export function GroupPage({ locale, messages, group, href, name, line, meta, headlines, topics, regionCount }: GroupPageProps) {
  const Icon = GROUP_ICONS[group];
  const home = message(messages, "common.home");
  const data = message(messages, "common.data");
  const multi = topics.length > 1;

  return (
    <ExplorerPage containerQueries={false}>
      <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: data, path: pageHref("/explorer", locale) }, { name, path: pageHref(href, locale) }]} />
      <PageHeader locale={locale} messages={messages} crumbs={[{ label: home, href: "/" }, { label: data, href: "/explorer" }, { label: name }]} coverage={meta} />
      <ExplorerHeading>
        <span className="flex items-center gap-3.5">
          <Icon aria-hidden strokeWidth={1.5} className="size-7 flex-none text-[var(--accent)] min-[1101px]:size-9" />
          <span>{name}</span>
        </span>
      </ExplorerHeading>
      <p className="max-w-[760px] text-[15px] leading-[1.55] text-[var(--body)]">{line}</p>
      <div data-testid="group-headlines" className="mt-[22px] grid grid-cols-2 border-y border-[var(--hairline)] min-[1101px]:mt-[30px] min-[1101px]:grid-cols-4">
        {headlines.map((headline) => <Headline key={headline.href} headline={headline} locale={locale} />)}
      </div>
      {multi ? (
        // One row at every width, sticky, that scrolls sideways (prototype `dx-tabs`). From 900px a thin scrollbar shows, and a
        // fade marks each edge with more links beyond it (`data-more-start`, `data-more-end`, kept by `GroupTopicScroll`).
        <div data-testid="group-topic-row" className="group/topics sticky top-14 z-[6] mt-[26px] min-[900px]:top-0 max-[768px]:-mx-5">
          <nav
            aria-label={message(messages, "groups.topicsNav")}
            id={TOPIC_LINKS_ID}
            data-testid="group-topic-links"
            className="flex gap-2 overflow-x-auto bg-[var(--paper)] py-2.5 [scrollbar-width:none] min-[900px]:[scrollbar-color:var(--control)_transparent] min-[900px]:[scrollbar-width:thin] data-[scrollbar]:pb-1 max-[768px]:px-5"
          >
            {topics.map((section) => (
              <a
                key={section.topic}
                href={`#t-${section.topic}`}
                data-testid="group-topic-link"
                className="inline-flex min-h-[42px] flex-none items-center border border-[var(--hairline)] px-3.5 text-[13px] font-semibold whitespace-nowrap text-[var(--ink)] no-underline transition-colors duration-150 hover:border-[var(--ink)] hover:bg-[var(--tile)] motion-reduce:transition-none"
              >
                {section.label}
              </a>
            ))}
          </nav>
          <span aria-hidden data-testid="group-topic-fade-start" className={`${EDGE_FADE} left-0 bg-linear-to-r group-data-[more-start]/topics:opacity-100`} />
          <span aria-hidden data-testid="group-topic-fade-end" className={`${EDGE_FADE} right-0 bg-linear-to-l group-data-[more-end]/topics:opacity-100`} />
        </div>
      ) : null}
      {topics.map((section) => {
        const headingId = `th-${section.topic}`;
        const lead = leadSpan(section.cards.length);
        return (
          <section
            key={section.topic}
            id={`t-${section.topic}`}
            aria-labelledby={headingId}
            tabIndex={-1}
            className="mt-9 scroll-mt-[124px] focus:outline-none min-[768px]:mt-11 min-[900px]:scroll-mt-[76px]"
          >
            {multi ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-x-[18px] gap-y-1.5 border-t-[1.5px] border-[var(--ink)] pt-3">
                  <h2 id={headingId} className="font-[family-name:var(--font-display)] text-[23px] leading-[1.2] font-semibold min-[768px]:text-[28px]">{section.label}</h2>
                  <p className={`${NUMERIC} text-[11.5px] text-[var(--muted)]`}>{section.meta}</p>
                </div>
                <p className="mt-1.5 text-[14px] text-[var(--body)]">{section.line}</p>
              </>
            ) : (
              <h2 id={headingId} className="sr-only">{section.label}</h2>
            )}
            <div className={`${CARD_GRID_CLASS} ${multi ? "mt-5" : "mt-[30px]"}`}>
              {section.cards.map((card, index) => (
                <ExplorerCard key={card.href ?? card.index} card={card} locale={locale} lead={index === 0 ? lead : undefined} spread={section.spreads[index]} regionCount={regionCount} />
              ))}
            </div>
          </section>
        );
      })}
      <GroupTopicScroll locale={locale} group={group} />
    </ExplorerPage>
  );
}
