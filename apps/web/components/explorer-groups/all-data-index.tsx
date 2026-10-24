import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { GROUP_ICONS } from "../shell/group-icons";
import { Sparkline } from "../ui/sparkline";
import { azAlphabet, azColumns, azGroups } from "../../lib/explorer/allDataIndex";
import { rowLabel, type SearchPage } from "../../lib/explorer/search/searchExplorer";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";

// Every page A to Z on the All data page (spec 2026-10-24-explorer-regroup §6.4, prototype `dx-idx`, `dx-az`, `dx-ix`): a letter
// bar that stays on screen, then the letters in two balanced columns, one on phones. Rendered on the server, so the whole list is
// in the page's HTML.

const NUMERIC = "font-[family-name:var(--font-numeric)]";

const pagesLabel = (messages: Messages, n: number) => message(messages, n === 1 ? "common.pagesCountOne" : "common.pagesCount", { n });

function IndexRow({ page, locale }: { page: SearchPage; locale: Locale }) {
  const Icon = GROUP_ICONS[page.group];
  return (
    <li>
      <Link
        href={pageHref(page.href, locale)}
        prefetch={false}
        data-testid="az-row"
        className="group grid min-h-[54px] grid-cols-[minmax(0,1fr)_44px_minmax(84px,auto)] items-center gap-3.5 border-b border-[var(--row-border)] py-2 text-[var(--ink)] no-underline max-[767px]:min-h-[52px] max-[767px]:grid-cols-[minmax(0,1fr)_auto] max-[767px]:gap-3 max-[767px]:py-[7px]"
      >
        <span className="min-w-0">
          <span className="block text-[14px] leading-[1.35] font-semibold group-hover:text-[var(--accent)] group-hover:underline group-hover:underline-offset-[3px]">{rowLabel(page, locale)}</span>
          <span className={`mt-[3px] flex items-center gap-1.5 ${NUMERIC} text-[10.5px] leading-[1.3] text-[var(--faint)]`}>
            <Icon aria-hidden strokeWidth={1.75} className="size-3 flex-none" />
            <span>{page.groupName[locale]}</span>
          </span>
        </span>
        <span aria-hidden className="flex justify-center text-[var(--faint)] max-[767px]:hidden [&>svg]:mt-0">
          {page.spark
            ? <Sparkline values={page.spark} color="var(--control)" width={44} height={14} />
            : page.href.endsWith("/regions") ? <MapIcon strokeWidth={1.75} className="size-3.5" /> : null}
        </span>
        <span className={`max-w-[124px] justify-self-end text-right ${NUMERIC} text-[12px] leading-[1.3] font-semibold`}>
          {page.value}
          {page.value ? <em className="block text-[10.5px] font-normal text-[var(--faint)] not-italic">{page.period}</em> : null}
        </span>
      </Link>
    </li>
  );
}

/** The A to Z list. `messages` holds `common` and `allData`. */
export function AllDataIndex({ locale, messages, pages }: { locale: Locale; messages: Messages; pages: SearchPage[] }) {
  const groups = azGroups(pages, locale);
  const present = new Map(groups.map((group) => [group.letter, group]));
  return (
    <section data-testid="az-index" aria-labelledby="az-title" className="mt-11 max-[767px]:mt-8">
      <h2 id="az-title" className="sr-only">{message(messages, "allData.indexTitle")}</h2>
      <nav
        aria-label={message(messages, "allData.alphabetLabel")}
        className="sticky top-14 z-[6] border-t-[1.5px] border-b border-t-[var(--ink)] border-b-[var(--hairline)] bg-[var(--paper)] py-2 [scrollbar-width:none] min-[900px]:top-0 max-[767px]:-mx-5 max-[767px]:overflow-x-auto max-[767px]:px-3.5 max-[767px]:py-1.5"
      >
        <div className="flex justify-between gap-0.5 max-[767px]:justify-start">
          {[...azAlphabet(locale)].map((letter) => {
            const group = present.get(letter);
            const letterClass = "inline-flex h-8 min-w-[26px] items-center justify-center px-[3px] text-[14px] leading-none max-[767px]:h-11 max-[767px]:min-w-11 max-[767px]:flex-none";
            return group ? (
              <a
                key={letter}
                href={`#${group.id}`}
                aria-label={`${letter} — ${pagesLabel(messages, group.rows.length)}`}
                data-testid="az-letter"
                className={`${letterClass} font-semibold text-[var(--ink)] no-underline hover:bg-[var(--tint)] hover:text-[var(--accent)]`}
              >
                {letter}
              </a>
            ) : (
              <span key={letter} aria-hidden className={`${letterClass} font-normal text-[var(--hairline)]`}>{letter}</span>
            );
          })}
        </div>
      </nav>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-x-12">
        {azColumns(groups).map((column, index) => (
          <div key={index}>
            {column.map((group) => (
              <section
                key={group.id}
                id={group.id}
                aria-labelledby={`${group.id}-h`}
                tabIndex={-1}
                className="scroll-mt-[116px] pt-6 focus:outline-none min-[900px]:scroll-mt-14 max-[767px]:pt-[18px]"
              >
                <h3 id={`${group.id}-h`} className="flex items-baseline gap-3 border-b border-[var(--ink)] pb-1.5">
                  <span className="font-[family-name:var(--font-display)] text-[30px] leading-[1.05] font-semibold max-[767px]:text-[24px]">{group.letter}</span>
                  <span className={`${NUMERIC} text-[11px] font-normal text-[var(--muted)]`}>{pagesLabel(messages, group.rows.length)}</span>
                </h3>
                <ul>
                  {group.rows.map((page) => <IndexRow key={page.href} page={page} locale={locale} />)}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
